// ============================================================================
// Vision scoring adapter for task_submissions.ai_confidence_score
// (plan.md Open Item 1 / Phase 0.5 "Scoring approach", decided 2026-09-11).
//
// Scope of this file, deliberately narrow: given an evidence image + a task
// name, ask a multimodal model "how confident are you this screenshot shows
// the task done?" and return a 0..1 score + one-line reasoning. It does NOT
// decide auto-approve/auto-reject -- that threshold design is Open Item 5,
// still blocked pending real-world score distributions from this pipeline.
// Every submission still lands in the manual-hold queue regardless of score;
// the score is purely an aid shown to Review Console.
//
// Two axes of configurability:
//   1. CASCADE ORDER -- vision-cascade.config.ts lists an ordered sequence of
//      (provider, model) steps, changed 2026-09-11 per explicit user request
//      to try Google's models first (real free tier), then fall back through
//      OpenAI's cheapest vision-capable models. Each step is tried in order;
//      the first step whose provider has keys configured AND whose call
//      succeeds wins. This replaces the old single VISION_PROVIDER env var
//      swap -- editing the cascade config file is now how you reorder, add,
//      or remove providers/models, no env var or secret redeploy needed for
//      that part.
//   2. KEY ROTATION -- each provider's key env var is still a comma-separated
//      list (VISION_OPENAI_API_KEYS="key1,key2,key3"). One is picked at
//      random per call. Workers are stateless per-request with no cheap
//      shared counter (no KV/DO binding exists for this yet), so random
//      selection is used instead of strict round-robin -- it still spreads
//      load/quota evenly across keys over many requests, without needing new
//      infra.
// ============================================================================

import type { Env } from "../types";
import { VISION_CASCADE, type CascadeStep } from "./vision-cascade.config";
import { downloadEvidenceImage } from "./storage";

export interface VisionScoreResult {
  confidenceScore: number; // 0..1, clamped
  reasoning: string;
  provider: string;
  model: string;
}

interface ImagePayload {
  base64: string;
  mimeType: string;
}

export interface VisionProvider {
  readonly name: string;
  scoreImage(image: ImagePayload, prompt: string): Promise<VisionScoreResult>;
}

// ============================================================================
// Key rotation helper
// ============================================================================

function pickKey(csv: string | undefined): string | null {
  if (!csv) return null;
  const keys = csv
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (keys.length === 0) return null;
  return keys[Math.floor(Math.random() * keys.length)];
}

// ============================================================================
// Shared prompt + response parsing
// ============================================================================

function buildPrompt(taskName: string): string {
  return (
    `You are reviewing evidence a customer submitted to prove they completed ` +
    `a marketing task called "${taskName}" for a business loyalty campaign. ` +
    `Look at the attached screenshot and judge, on a scale of 0 to 1, how ` +
    `confident you are that it genuinely shows this task completed (not a ` +
    `stock photo, not unrelated content, not an obviously reused or edited ` +
    `screenshot). Respond with ONLY a JSON object and nothing else: ` +
    `{"confidence": <number between 0 and 1>, "reasoning": "<one short sentence>"}`
  );
}

function parseScoreResponse(text: string, provider: string, model: string): VisionScoreResult {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`${provider}: no JSON object found in model response`);
  }
  const parsed = JSON.parse(match[0]) as { confidence?: unknown; reasoning?: unknown };
  const raw = typeof parsed.confidence === "number" ? parsed.confidence : Number(parsed.confidence);
  if (Number.isNaN(raw)) {
    throw new Error(`${provider}: confidence value missing or not a number`);
  }
  const confidenceScore = Math.max(0, Math.min(1, raw));
  const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning : "";
  return { confidenceScore, reasoning, provider, model };
}

// ============================================================================
// OpenAI (Chat Completions, image_url content part with a data: URI)
// ============================================================================

class OpenAIVisionProvider implements VisionProvider {
  readonly name = "openai";
  constructor(private apiKey: string, private model: string) {}

  async scoreImage(image: ImagePayload, prompt: string): Promise<VisionScoreResult> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.base64}` } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`openai vision call failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    const text = data.choices?.[0]?.message?.content ?? "";
    return parseScoreResponse(text, this.name, this.model);
  }
}

// ============================================================================
// Anthropic (Messages API, image content block, base64 source)
// ============================================================================

class AnthropicVisionProvider implements VisionProvider {
  readonly name = "anthropic";
  constructor(private apiKey: string, private model: string) {}

  async scoreImage(image: ImagePayload, prompt: string): Promise<VisionScoreResult> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: image.mimeType, data: image.base64 } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`anthropic vision call failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
    const text = data.content?.find((b) => b.type === "text")?.text ?? "";
    return parseScoreResponse(text, this.name, this.model);
  }
}

// ============================================================================
// Google (Gemini generateContent, inline_data base64 part)
// ============================================================================

class GoogleVisionProvider implements VisionProvider {
  readonly name = "google";
  constructor(private apiKey: string, private model: string) {}

  async scoreImage(image: ImagePayload, prompt: string): Promise<VisionScoreResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }, { inline_data: { mime_type: image.mimeType, data: image.base64 } }],
          },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`google vision call failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as {
      candidates: Array<{ content: { parts: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return parseScoreResponse(text, this.name, this.model);
  }
}

// ============================================================================
// Cascade support -- for a given cascade step (provider + specific model,
// from vision-cascade.config.ts), build a provider instance with a rotated
// key, or null if that provider has no keys configured at all (caller skips
// the step rather than treating it as a failure).
// ============================================================================

function buildProviderForStep(step: CascadeStep, env: Env): VisionProvider | null {
  switch (step.provider) {
    case "openai": {
      const key = pickKey(env.VISION_OPENAI_API_KEYS);
      if (!key) return null;
      return new OpenAIVisionProvider(key, step.model);
    }
    case "anthropic": {
      const key = pickKey(env.VISION_ANTHROPIC_API_KEYS);
      if (!key) return null;
      return new AnthropicVisionProvider(key, step.model);
    }
    case "google": {
      const key = pickKey(env.VISION_GOOGLE_API_KEYS);
      if (!key) return null;
      return new GoogleVisionProvider(key, step.model);
    }
    default:
      return null;
  }
}

// ============================================================================
// Image fetch + base64 encode (shared across providers so the adapter
// interface stays uniform -- all three APIs above take inline base64 rather
// than mixing url-source and base64-source code paths).
// ============================================================================

async function fetchImageAsBase64(env: Env, evidenceKey: string): Promise<ImagePayload> {
  const { bytes, contentType } = await downloadEvidenceImage(env, evidenceKey);
  const buf = bytes;
  const bytesArray = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytesArray.length; i += chunkSize) {
    binary += String.fromCharCode(...bytesArray.subarray(i, i + chunkSize));
  }
  return { base64: btoa(binary), mimeType: contentType };
}

// ============================================================================
// Public entry point used by routes/customer.ts
// ============================================================================

export async function scoreTaskSubmission(
  env: Env,
  evidenceKey: string,
  taskName: string
): Promise<VisionScoreResult | null> {
  const prompt = buildPrompt(taskName);
  // Fetched lazily on the first step that actually has a configured
  // provider, then reused across any further cascade attempts -- the image
  // itself doesn't change between providers/models, only the scoring call
  // does. If fetching fails, `image` stays null and the next step retries
  // the fetch; a bad/unreachable evidence storage key will fail identically on
  // every step either way, so the cascade is still allowed to exhaust
  // itself rather than special-casing that failure mode.
  let image: ImagePayload | null = null;

  for (const step of VISION_CASCADE) {
    const provider = buildProviderForStep(step, env);
    if (!provider) continue; // this provider has no keys configured -- skip, not a failure

    try {
      if (!image) {
        image = await fetchImageAsBase64(env, evidenceKey);
      }
      return await provider.scoreImage(image, prompt);
    } catch (err) {
      console.error(`vision cascade step ${step.provider}/${step.model} failed:`, err);
      // Fall through to the next step in the cascade.
    }
  }

  return null; // no provider configured, or every configured step failed
}
