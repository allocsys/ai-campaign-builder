// ============================================================================
// Natural-language campaign-editing request parser (plan.md Open Item 20,
// Part A). Lets a business owner type a free-text request (e.g. "کمپین رو
// ۵ روز دیگه تمدید کن" or "امتیاز تسک اول رو بیشتر کن") and turns it into a
// structured, human-reviewable proposal -- reusing the EXISTING
// CAMPAIGN_COPY_CASCADE from ai-models.config.ts (same Google-Flash-first,
// OpenAI-fallback cascade campaign-generator.ts already uses for copy).
// No new AI infra, no new provider, no new env vars.
//
// SAFETY, LOAD-BEARING: this file only ever *proposes* a change -- it never
// writes to campaigns/campaign_tasks/campaign_rewards and never calls
// applyCampaignUpdate (routes/business.ts) directly. Its output is shaped to
// become a `pending` row in the EXISTING suggested_changes table (see
// migrations/0001_init.sql), so every change -- whether it originated here
// or from Phase 2/3's analysis-driven insights -- goes through the exact
// same human Apply/Dismiss confirmation in SuggestionsTab.tsx. The actual
// INSERT into suggested_changes is the caller's responsibility (plan.md
// Part B, not yet built) -- this file's job stops at producing a validated,
// well-typed suggestion (or a clarifying question) for that caller to
// persist.
//
// If the model is unsure, or the request references something ambiguous or
// nonexistent (e.g. "بهترش کن" with no clear target, or a task that doesn't
// exist), this returns { needsClarification: true, clarifyingQuestion }
// instead of guessing -- guessing is explicitly rejected here since these
// changes touch real discounts/points/durations. Unlike
// campaign-generator.ts's copy generation (which safely falls back to
// static default copy on total AI failure, since worst case is bland
// wording), there is no safe "default guess" for a money-affecting change,
// so a total cascade failure here also surfaces as a (generic) clarifying
// response rather than a fabricated confident suggestion.
// ============================================================================

import type { Env } from "../types";
import type { serializeCampaign } from "../routes/business";
import { CAMPAIGN_COPY_CASCADE, pickKey } from "./ai-models.config";

// Mirrors suggested_changes.change_type's CHECK constraint exactly
// (migrations/0001_init.sql) -- these are the only values a caller can
// legally insert into that column.
export type CampaignChangeType =
  | "task_points"
  | "reward_threshold"
  | "add_task"
  | "remove_task"
  | "campaign_duration"
  | "reward_depth";

export type RiskTier = "low" | "high";

// The current campaign, exactly as GET /campaign / businessRouter's
// serializeCampaign already returns it -- reused as-is (type-only import,
// no runtime dependency on routes/business.ts) rather than redefining an
// equivalent shape that could drift from the real one.
export type CampaignState = Awaited<ReturnType<typeof serializeCampaign>>;

export interface ParsedCampaignChangeSuggestion {
  needsClarification: false;
  changeType: CampaignChangeType;
  /**
   * campaign_tasks.id / campaign_rewards.id this change targets, when the
   * change_type applies to a specific existing row (task_points,
   * remove_task, reward_threshold, reward_depth). Omitted for add_task
   * (there's no existing row yet) and campaign_duration (campaign-level,
   * not row-level).
   */
  targetId?: string;
  /** Human-readable current value, e.g. "۵۰ امتیاز" or "۱۴ روز". Stored as-is in suggested_changes.current_value (TEXT). */
  currentValue: string;
  /**
   * Human-readable proposed value, same TEXT-column convention as
   * currentValue. For add_task, this is a compact JSON string describing
   * the new task ({"pattern":"...","name":"...","points":N}) since there's
   * no existing row to describe a single scalar diff against.
   */
  suggestedValue: string;
  /** Persian, shown to the owner alongside the suggestion (mirrors insights.suggested_action / suggested_changes.rationale). */
  rationale: string;
  riskTier: RiskTier;
  /** Model's self-reported confidence, 0-1. Suggestions below CLARIFICATION_CONFIDENCE_THRESHOLD are converted to a clarification instead (see below), so a caller never sees a low-confidence suggestion here. */
  confidence: number;
}

export interface ClarificationNeeded {
  needsClarification: true;
  clarifyingQuestion: string;
}

export type ParsedCampaignChangeResult = ParsedCampaignChangeSuggestion | ClarificationNeeded;

/** One prior turn in the chat -- optional context for a follow-up message answering a clarifying question. Storage/persistence of this history (plan.md: Workers KV, keyed chat:{campaignId}:{sessionId}, short TTL) is Part B's concern, not this file's -- this function is stateless per call and simply accepts whatever turns the caller already has in hand. */
export interface ChatTurn {
  role: "owner" | "assistant";
  content: string;
}

// Below this confidence, the model's own opinion of itself isn't trusted
// enough to hand a real money-affecting change straight to the owner for a
// one-tap Apply -- forced into a clarifying question instead, even if the
// model didn't flag needsClarification itself.
const CLARIFICATION_CONFIDENCE_THRESHOLD = 0.55;

// riskTier is computed HERE, deterministically, from change_type -- never
// trusted from the model's own JSON. Same philosophy as
// campaign-generator.ts: every money/points-consequence value is
// deterministic code, only copy/wording is LLM-generated. campaign_duration
// is the one low-risk type (a date/duration extension is easy for an owner
// to sanity-check and reverse); every other type touches points, reward
// depth/threshold, or the task/reward set itself, so all of them are high --
// matches SuggestionsTab.tsx's existing high/low badge distinction.
function computeRiskTier(changeType: CampaignChangeType): RiskTier {
  return changeType === "campaign_duration" ? "low" : "high";
}

function buildPrompt(text: string, state: CampaignState, history: ChatTurn[]): string {
  const stateSummary = {
    goal: state.goal,
    pointMultiplier: state.pointMultiplier,
    startDate: state.startDate,
    endDate: state.endDate,
    tasks: state.tasks.map((t) => ({ id: t.id, name: t.name, pattern: t.pattern, points: t.points })),
    rewards: state.rewards.map((r) => ({ id: r.id, name: r.name, pattern: r.pattern, threshold: r.threshold })),
  };

  const historyBlock =
    history.length > 0
      ? ` Prior conversation turns (oldest first, for context on a follow-up answer): ${JSON.stringify(
          history.map((h) => ({ role: h.role, content: h.content }))
        )}.`
      : "";

  return (
    `You are a careful campaign-editing assistant for a small-business loyalty-campaign platform. ` +
    `The owner writes a request in Persian (Farsi) or English describing a change they want made to ` +
    `their CURRENT campaign, shown below as JSON. You do NOT apply anything yourself -- you only ever ` +
    `propose ONE specific, concrete change for a human to review and approve.` +
    historyBlock +
    ` Current campaign state: ${JSON.stringify(stateSummary)}. ` +
    `Owner's request: "${text.replace(/"/g, '\\"')}". ` +
    `Rules, all mandatory: ` +
    `(1) If the request is ambiguous, underspecified, or you are not reasonably confident what specific ` +
    `change is wanted (e.g. "بهترش کن" / "make it better" with no clear target or direction), do NOT guess -- ` +
    `respond with {"needsClarification": true, "clarifyingQuestion": "<one short Persian question that would resolve the ambiguity>"}. ` +
    `(2) If the request refers to a task or reward that does not appear in the current campaign state's tasks/rewards arrays above, ` +
    `treat that the same as an ambiguous request (needsClarification) rather than inventing a targetId. ` +
    `(3) If the request is clear and maps to exactly one concrete change, respond with ONLY a JSON object in this exact shape: ` +
    `{"needsClarification": false, "changeType": "<one of: task_points, reward_threshold, add_task, remove_task, campaign_duration, reward_depth>", ` +
    `"targetId": "<the matching id from tasks/rewards above -- omit entirely for add_task and campaign_duration>", ` +
    `"currentValue": "<short human-readable Persian description of the current value>", ` +
    `"suggestedValue": "<short human-readable Persian description of the proposed value -- for add_task, instead put a JSON string like {\\"pattern\\":\\"referral\\",\\"name\\":\\"...\\",\\"points\\":30}>", ` +
    `"rationale": "<1 short Persian sentence explaining why this change addresses the request>", ` +
    `"confidence": <number between 0 and 1 reflecting how sure you are this is exactly what the owner wants>}. ` +
    `(4) Respond with ONLY the JSON object (one of the two shapes above) and nothing else -- no markdown, no commentary.`
  );
}

interface RawModelResponse {
  needsClarification?: boolean;
  clarifyingQuestion?: string;
  changeType?: string;
  targetId?: string;
  currentValue?: string;
  suggestedValue?: string;
  rationale?: string;
  confidence?: number;
}

const VALID_CHANGE_TYPES: CampaignChangeType[] = [
  "task_points",
  "reward_threshold",
  "add_task",
  "remove_task",
  "campaign_duration",
  "reward_depth",
];

// Change types that must reference an existing campaign_tasks/campaign_rewards row.
const REQUIRES_TARGET_ID: CampaignChangeType[] = ["task_points", "remove_task", "reward_threshold", "reward_depth"];

function parseAndValidate(rawText: string, state: CampaignState): ParsedCampaignChangeResult {
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("no JSON object found in model response");
  const parsed = JSON.parse(match[0]) as RawModelResponse;

  if (parsed.needsClarification === true) {
    if (typeof parsed.clarifyingQuestion !== "string" || !parsed.clarifyingQuestion.trim()) {
      throw new Error("needsClarification response missing clarifyingQuestion");
    }
    return { needsClarification: true, clarifyingQuestion: parsed.clarifyingQuestion.trim() };
  }

  if (
    typeof parsed.changeType !== "string" ||
    !VALID_CHANGE_TYPES.includes(parsed.changeType as CampaignChangeType) ||
    typeof parsed.currentValue !== "string" ||
    typeof parsed.suggestedValue !== "string" ||
    typeof parsed.rationale !== "string" ||
    typeof parsed.confidence !== "number"
  ) {
    throw new Error("model response missing required suggestion fields");
  }

  const changeType = parsed.changeType as CampaignChangeType;

  // Target-existence check (prompt rule 2, enforced again here in code --
  // never trust the model to have actually followed its own instructions).
  if (REQUIRES_TARGET_ID.includes(changeType)) {
    const targetId = parsed.targetId;
    const existsInTasks = state.tasks.some((t) => t.id === targetId);
    const existsInRewards = state.rewards.some((r) => r.id === targetId);
    if (typeof targetId !== "string" || !targetId || (!existsInTasks && !existsInRewards)) {
      return {
        needsClarification: true,
        clarifyingQuestion: "متوجه نشدم منظورتون دقیقاً کدوم تسک یا پاداشه -- می‌تونید مشخص‌تر بگید؟",
      };
    }
  }

  const confidence = Math.max(0, Math.min(1, parsed.confidence));
  if (confidence < CLARIFICATION_CONFIDENCE_THRESHOLD) {
    return {
      needsClarification: true,
      clarifyingQuestion: "برای اطمینان بیشتر، می‌تونید دقیق‌تر توضیح بدید دقیقاً چه تغییری می‌خواید؟",
    };
  }

  return {
    needsClarification: false,
    changeType,
    targetId: parsed.targetId,
    currentValue: parsed.currentValue,
    suggestedValue: parsed.suggestedValue,
    rationale: parsed.rationale,
    riskTier: computeRiskTier(changeType),
    confidence,
  };
}

// ----------------------------------------------------------------------------
// Cascade plumbing -- deliberately a near-verbatim copy of
// campaign-generator.ts's callGoogleText/callOpenAiText/cascade-loop rather
// than an import, matching that file's own stated convention (each AI call
// site keeps its own small call functions since prompt/response shape can
// diverge over time even when today's models happen to match).
// ----------------------------------------------------------------------------

async function callGoogleText(apiKey: string, model: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw new Error(`google text call failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { candidates: Array<{ content: { parts: Array<{ text?: string }> } }> };
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

async function callOpenAiText(apiKey: string, model: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`openai text call failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

async function runCascade(env: Env, prompt: string): Promise<string | null> {
  for (const step of CAMPAIGN_COPY_CASCADE) {
    let key: string | null = null;
    if (step.provider === "google") key = pickKey(env.VISION_GOOGLE_API_KEYS);
    else if (step.provider === "openai") key = pickKey(env.VISION_OPENAI_API_KEYS);
    if (!key) continue; // provider has no keys configured -- skip, not a failure

    try {
      const text = step.provider === "google" ? await callGoogleText(key, step.model, prompt) : await callOpenAiText(key, step.model, prompt);
      return text;
    } catch (err) {
      console.error(`campaign-agent parse step ${step.provider}/${step.model} failed:`, err);
      // Fall through to the next cascade step.
    }
  }
  return null;
}

// ============================================================================
// Public entry point.
// ============================================================================

/**
 * Parses a free-text campaign-editing request into either a structured,
 * ready-to-review change suggestion, or a clarifying question -- never both,
 * never neither, and never a silent failure. The caller (Part B's chat
 * route, not yet built) is responsible for: (a) supplying `history` if this
 * is a follow-up turn (loaded from Workers KV per plan.md's decision), and
 * (b) on a non-clarification result, inserting a `pending` row into
 * suggested_changes with these exact fields -- this function never writes
 * to the database itself.
 */
export async function parseNaturalLanguageCampaignRequest(
  env: Env,
  text: string,
  currentCampaignState: CampaignState,
  history: ChatTurn[] = []
): Promise<ParsedCampaignChangeResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { needsClarification: true, clarifyingQuestion: "چه تغییری می‌خواید توی کمپین اعمال بشه؟" };
  }

  const prompt = buildPrompt(trimmed, currentCampaignState, history);
  const raw = await runCascade(env, prompt);

  if (raw === null) {
    // Total cascade failure (no keys configured anywhere, or every provider
    // errored). Unlike campaign-generator.ts's copy step, there's no safe
    // default guess for a money-affecting change to fall back to -- surface
    // this as a graceful clarification-shaped response instead of either a
    // hard 500 or a fabricated confident suggestion.
    return {
      needsClarification: true,
      clarifyingQuestion:
        "در حال حاضر امکان پردازش این درخواست وجود نداره. لطفاً کمی بعد دوباره امتحان کنید یا تغییر رو مستقیم از ویرایشگر کمپین اعمال کنید.",
    };
  }

  try {
    return parseAndValidate(raw, currentCampaignState);
  } catch (err) {
    console.error("campaign-agent: model response failed validation:", err, "raw:", raw);
    return {
      needsClarification: true,
      clarifyingQuestion: "متوجه دقیق درخواستتون نشدم -- می‌تونید به شکل دیگه‌ای توضیح بدید؟",
    };
  }
}
