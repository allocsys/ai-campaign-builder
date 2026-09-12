// ============================================================================
// Single source of truth for AI model names, cascade order, and API-key
// picking, shared by every AI call site in the backend:
//   - lib/vision.ts (image scoring for task_submissions.ai_confidence_score)
//   - lib/campaign-generator.ts (AI-written campaign copy)
//
// WHY THIS FILE EXISTS (2026-09-12): model names used to live as separate
// hardcoded arrays in vision-cascade.config.ts and inline in
// campaign-generator.ts. When Google shut down gemini-2.0-flash and the
// entire 1.5 line, BOTH places broke -- but only the vision cascade broke
// LOUDLY (task_submissions.ai_confidence_score stayed null, visible in
// Review Console). The campaign-copy cascade broke SILENTLY: it has a
// "never hard-fail" fallback to static default copy
// (GeneratedCampaignProposal.copyGeneratedByAi: false), so every AI call
// there had been 404ing with zero visible symptoms until this file's
// predecessor was found and fixed by hand, separately, hours later. One
// shared model list makes a future deprecation a single edit instead of a
// search-and-hope across the codebase.
//
// When Google (or OpenAI) deprecates a model again: update the model
// strings in CURRENT_MODELS below, referencing
// https://ai.google.dev/gemini-api/docs/models (Gemini) or
// https://platform.openai.com/docs/models (OpenAI) for what's current and
// still free-tier/cheap-tier eligible. Last checked against Google's docs:
// 2026-09-12 -- free tier at that time covered Flash/Flash-Lite tiers only,
// not Pro.
// ============================================================================

export type AiProviderName = "google" | "openai" | "anthropic";

export interface CascadeStep {
  provider: AiProviderName;
  model: string;
}

// ----------------------------------------------------------------------------
// Current model names -- THE place to edit when a provider deprecates a
// model. Referenced by both cascades below rather than repeating literal
// strings, so a deprecation is fixed here once instead of per-cascade.
// ----------------------------------------------------------------------------

export const CURRENT_MODELS = {
  google: {
    // Stable, free-tier-eligible Gemini 3.x Flash line (checked 2026-09-12).
    // Ordered strongest-capability first, then progressively smaller/cheaper.
    // gemini-2.0-flash and the entire 1.5/1.0 line are SHUT DOWN -- do not
    // reintroduce them even as a fallback step, they will 404 immediately.
    flash: "gemini-3.6-flash",
    flashSecondary: "gemini-3.5-flash",
    flashLite: "gemini-3.5-flash-lite",
  },
  openai: {
    // Cheapest vision-capable / general-purpose OpenAI models. OpenAI has no
    // perpetual free tier -- these are the paid fallback once Google's free
    // quota is exhausted or every Google step fails for another reason.
    mini: "gpt-4o-mini",
    nano: "gpt-4.1-nano",
  },
} as const;

// ----------------------------------------------------------------------------
// Vision scoring cascade (plan.md Open Item 1, lib/vision.ts). Each step is
// tried in sequence; the first step whose provider has at least one API key
// configured (VISION_<PROVIDER>_API_KEYS) AND whose call succeeds wins. A
// provider with no keys configured is skipped silently, not treated as a
// failure.
// ----------------------------------------------------------------------------

export const VISION_CASCADE: CascadeStep[] = [
  { provider: "google", model: CURRENT_MODELS.google.flash },
  { provider: "google", model: CURRENT_MODELS.google.flashSecondary },
  { provider: "google", model: CURRENT_MODELS.google.flashLite },
  { provider: "openai", model: CURRENT_MODELS.openai.mini },
  { provider: "openai", model: CURRENT_MODELS.openai.nano },
];

// ----------------------------------------------------------------------------
// Campaign-copy text-generation cascade (lib/campaign-generator.ts). Same
// provider ORDER convention as the vision cascade (Google free tier first,
// OpenAI paid fallback second) for consistency, but kept as its own list
// rather than reusing VISION_CASCADE verbatim -- the model lineup best
// suited to short structured-JSON text generation isn't necessarily
// identical to the vision lineup, even when today's actual values happen to
// match.
// ----------------------------------------------------------------------------

export const CAMPAIGN_COPY_CASCADE: CascadeStep[] = [
  { provider: "google", model: CURRENT_MODELS.google.flash },
  { provider: "google", model: CURRENT_MODELS.google.flashSecondary },
  { provider: "google", model: CURRENT_MODELS.google.flashLite },
  { provider: "openai", model: CURRENT_MODELS.openai.mini },
  { provider: "openai", model: CURRENT_MODELS.openai.nano },
];

// ----------------------------------------------------------------------------
// Key rotation helper -- shared by every AI call site. Each provider's key
// env var is a comma-separated list (e.g. VISION_OPENAI_API_KEYS=
// "key1,key2,key3"); one key is picked at random per call. Workers are
// stateless per-request with no cheap shared counter (no KV/DO binding
// exists for this), so random selection is used instead of strict
// round-robin -- it still spreads load/quota evenly across keys over many
// requests, without needing new infra.
// ----------------------------------------------------------------------------

export function pickKey(csv: string | undefined): string | null {
  if (!csv) return null;
  const keys = csv
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (keys.length === 0) return null;
  return keys[Math.floor(Math.random() * keys.length)];
}
