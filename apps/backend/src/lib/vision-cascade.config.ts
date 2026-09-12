// ============================================================================
// Vision scoring cascade order (plan.md Open Item 1, lib/vision.ts).
//
// Decided 2026-09-11 per explicit user request: cascade Google's own models
// first (in order), then fall back through OpenAI's own models (in order).
// Each step below is tried in sequence; the first step whose provider has at
// least one API key configured (VISION_<PROVIDER>_API_KEYS) AND whose call
// succeeds wins. A provider with no keys configured is skipped silently, not
// treated as a failure -- same "leave it null and move on" philosophy the
// rest of this pipeline already uses.
//
// This file is the SINGLE place to change cascade order, or add/remove
// models -- no code changes needed in vision.ts itself, no redeploy of
// secrets required either (this is source code, not an env var).
//
// Note on "free tier": Google's Gemini API has a genuine perpetual free tier
// for these models (rate-limited, not one-time trial credits). OpenAI has no
// equivalent perpetual free tier for API usage -- gpt-4o-mini / gpt-4.1-nano
// below are simply OpenAI's cheapest vision-capable models, used as the paid
// fallback once Google's free quota is exhausted or a Google call fails for
// any other reason.
// ============================================================================

export type VisionProviderName = "google" | "openai" | "anthropic";

export interface CascadeStep {
  provider: VisionProviderName;
  model: string;
}

export const VISION_CASCADE: CascadeStep[] = [
  // Google cascade: updated 2026-09-12 -- gemini-2.0-flash and the entire
  // 1.5/1.0 line were shut down by Google (confirmed via
  // ai.google.dev/gemini-api/docs/models, "Previous models" / deprecations
  // page) and every call to them now 404s. Replaced with the current stable,
  // free-tier-eligible Gemini 3.x Flash line (free tier as of this date only
  // covers Flash/Flash-Lite tiers, not Pro), ordered strongest-capability
  // first then progressively smaller/cheaper fallbacks, same shape as before.
  { provider: "google", model: "gemini-3.6-flash" },
  { provider: "google", model: "gemini-3.5-flash" },
  { provider: "google", model: "gemini-3.5-flash-lite" },
  // OpenAI cascade: cheapest vision-capable models, tried only once every
  // Google step above has failed or Google has no keys configured at all.
  { provider: "openai", model: "gpt-4o-mini" },
  { provider: "openai", model: "gpt-4.1-nano" },
];
