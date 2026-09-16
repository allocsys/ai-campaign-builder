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
// INSERT into suggested_changes is the caller's responsibility (routes/
// business.ts's POST /campaign/chat) -- this file's job stops at producing
// a validated, well-typed suggestion (or a clarifying question) for that
// caller to persist.
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
//
// suggested_value / current_value SCHEMA (migrations/0003): as of migration
// 0003, suggested_changes.current_value and .suggested_value ALWAYS hold a
// JSON string (never a free-text Persian sentence) for every change_type --
// see that migration's header comment for the exact per-change_type shape.
// This changed because the previous "human-readable Persian sentence"
// convention (e.g. "۵۰ امتیاز") made it impractical for
// routes/business.ts's suggestions/:id/apply handler to actually parse a
// number back out and perform the real DB mutation for anything but
// add_task (the one type that already happened to use JSON). Neither column
// is ever shown to a user directly -- serializeSuggestion (routes/
// business.ts) only ever exposes id/riskTier/changeType/rationale/status,
// with `rationale` (always a plain Persian sentence, unaffected by this
// change) being the only user-facing explanation of what a suggestion does.
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
  | "reward_depth"
  | "add_reward";

export type RiskTier = "low" | "high";

// The current campaign, exactly as GET /campaign / businessRouter's
// serializeCampaign already returns it -- reused as-is (type-only import,
// no runtime dependency on routes/business.ts) rather than redefining an
// equivalent shape that could drift from the real one.
export type CampaignState = Awaited<ReturnType<typeof serializeCampaign>>;

// Mirrors task_patterns.name's CHECK constraint exactly (migrations/
// 0001_init.sql) -- the only pattern names add_task's structured value may
// legally reference.
const VALID_TASK_PATTERN_NAMES = [
  "social_proof",
  "referral",
  "repeat_purchase",
  "milestone_streak",
  "specific_product_push",
  "review_ugc",
  "first_action",
  "off_peak",
  "anniversary_birthday",
] as const;

// Mirrors reward_patterns.name's CHECK constraint exactly (migrations/
// 0001_init.sql) -- the only pattern names add_reward's structured value
// may legally reference. Kept as a static list (mirroring
// VALID_TASK_PATTERN_NAMES above) rather than sourced purely from the
// dynamic availableRewardPatterns context field, so validation here never
// depends on the model having echoed back a name that was actually offered
// to it.
const VALID_REWARD_PATTERN_NAMES = [
  "percentage_discount",
  "free_item",
  "free_shipping",
  "vip_tier",
  "promo_item",
  "early_access",
] as const;

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
  /**
   * JSON-string snapshot of the value being changed FROM, computed
   * deterministically from the current campaign state (never trusted from
   * the model) -- see migration 0003's header comment for the exact shape
   * per change_type. Stored as-is in suggested_changes.current_value (TEXT).
   */
  currentValue: string;
  /**
   * JSON-string of the proposed new value -- see migration 0003's header
   * comment for the exact shape per change_type. Stored as-is in
   * suggested_changes.suggested_value (TEXT).
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

/** One prior turn in the chat -- optional context for a follow-up message answering a clarifying question. Storage/persistence of this history (Workers KV, keyed chat:{campaignId}:{sessionId}, short TTL, see lib/chat-history.ts) is the caller's concern, not this file's -- this function is stateless per call and simply accepts whatever turns the caller already has in hand. */
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
    `"value": <the new value -- shape depends on changeType, see below>, ` +
    `"rationale": "<1 short Persian sentence explaining why this change addresses the request>", ` +
    `"confidence": <number between 0 and 1 reflecting how sure you are this is exactly what the owner wants>}. ` +
    `The shape of "value" depends on changeType: ` +
    `for task_points, a plain number -- the task's NEW total points value (not a delta); ` +
    `for reward_threshold, a plain number -- the reward's NEW total threshold_points (not a delta); ` +
    `for campaign_duration, a plain integer number of days to extend the campaign by (negative to shorten it, not a new date); ` +
    `for reward_depth, a short Persian string -- the reward's complete new description text (e.g. "۳۰٪ تخفیف کل فاکتور تا سقف ۵۰۰ هزار تومان"); ` +
    `for add_task, an object {"pattern": "<one of: ${VALID_TASK_PATTERN_NAMES.join(", ")}>", "name": "<short Persian task label>", "points": <integer>}; ` +
    `for remove_task, omit "value" entirely (targetId alone identifies what to remove). ` +
    `(4) Respond with ONLY the JSON object (one of the two shapes above) and nothing else -- no markdown, no commentary.`
  );
}

interface RawModelResponse {
  needsClarification?: boolean;
  clarifyingQuestion?: string;
  changeType?: string;
  targetId?: string;
  value?: unknown;
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

const GENERIC_CLARIFICATION =
  "متوجه دقیق درخواستتون نشدم -- می‌تونید به شکل دیگه‌ای توضیح بدید؟";

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
    typeof parsed.rationale !== "string" ||
    typeof parsed.confidence !== "number"
  ) {
    throw new Error("model response missing required suggestion fields");
  }

  const changeType = parsed.changeType as CampaignChangeType;

  // Target-existence check (prompt rule 2, enforced again here in code --
  // never trust the model to have actually followed its own instructions).
  let targetTask: CampaignState["tasks"][number] | undefined;
  let targetReward: CampaignState["rewards"][number] | undefined;
  if (REQUIRES_TARGET_ID.includes(changeType)) {
    const targetId = parsed.targetId;
    targetTask = state.tasks.find((t) => t.id === targetId);
    targetReward = state.rewards.find((r) => r.id === targetId);
    if (typeof targetId !== "string" || !targetId || (!targetTask && !targetReward)) {
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

  // Build currentValue/suggestedValue as JSON strings, per migration 0003's
  // documented shape -- currentValue is always computed HERE from the real
  // campaign state, never taken from the model, since the model has no
  // reason to be trusted for a value it isn't proposing. suggestedValue's
  // shape is validated per change_type below; an invalid/missing "value"
  // for a type that requires one is treated as a clarification rather than
  // silently coercing something wrong.
  let currentValue: string;
  let suggestedValue: string;

  switch (changeType) {
    case "task_points": {
      if (!targetTask) throw new Error("unreachable: task_points requires targetTask");
      const points = parsed.value;
      if (typeof points !== "number" || !Number.isFinite(points) || !Number.isInteger(points) || points <= 0) {
        return { needsClarification: true, clarifyingQuestion: GENERIC_CLARIFICATION };
      }
      currentValue = JSON.stringify({ taskId: targetTask.id, points: targetTask.points });
      suggestedValue = JSON.stringify({ points });
      break;
    }
    case "reward_threshold": {
      if (!targetReward) throw new Error("unreachable: reward_threshold requires targetReward");
      const threshold = parsed.value;
      if (
        typeof threshold !== "number" ||
        !Number.isFinite(threshold) ||
        !Number.isInteger(threshold) ||
        threshold <= 0
      ) {
        return { needsClarification: true, clarifyingQuestion: GENERIC_CLARIFICATION };
      }
      currentValue = JSON.stringify({ rewardId: targetReward.id, threshold: targetReward.threshold });
      suggestedValue = JSON.stringify({ threshold });
      break;
    }
    case "reward_depth": {
      if (!targetReward) throw new Error("unreachable: reward_depth requires targetReward");
      const description = parsed.value;
      if (typeof description !== "string" || !description.trim()) {
        return { needsClarification: true, clarifyingQuestion: GENERIC_CLARIFICATION };
      }
      currentValue = JSON.stringify({ rewardId: targetReward.id });
      suggestedValue = JSON.stringify({ description: description.trim() });
      break;
    }
    case "remove_task": {
      if (!targetTask) throw new Error("unreachable: remove_task requires targetTask");
      currentValue = JSON.stringify({ taskId: targetTask.id, name: targetTask.name });
      suggestedValue = JSON.stringify({});
      break;
    }
    case "campaign_duration": {
      const deltaDays = parsed.value;
      if (
        typeof deltaDays !== "number" ||
        !Number.isFinite(deltaDays) ||
        !Number.isInteger(deltaDays) ||
        deltaDays === 0
      ) {
        return { needsClarification: true, clarifyingQuestion: GENERIC_CLARIFICATION };
      }
      currentValue = JSON.stringify({ endDate: state.endDate });
      suggestedValue = JSON.stringify({ deltaDays });
      break;
    }
    case "add_task": {
      const value = parsed.value as { pattern?: unknown; name?: unknown; points?: unknown } | undefined;
      const pattern = value?.pattern;
      const name = value?.name;
      const points = value?.points;
      if (
        typeof pattern !== "string" ||
        !(VALID_TASK_PATTERN_NAMES as readonly string[]).includes(pattern) ||
        typeof name !== "string" ||
        !name.trim() ||
        typeof points !== "number" ||
        !Number.isFinite(points) ||
        !Number.isInteger(points) ||
        points <= 0
      ) {
        return { needsClarification: true, clarifyingQuestion: GENERIC_CLARIFICATION };
      }
      currentValue = JSON.stringify(null);
      suggestedValue = JSON.stringify({ pattern, name: name.trim(), points });
      break;
    }
  }

  return {
    needsClarification: false,
    changeType,
    targetId: parsed.targetId,
    currentValue,
    suggestedValue,
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
 * never neither, and never a silent failure. The caller (routes/business.ts's
 * POST /campaign/chat) is responsible for: (a) supplying `history` if this
 * is a follow-up turn (loaded from Workers KV, see lib/chat-history.ts), and
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
      clarifyingQuestion: GENERIC_CLARIFICATION,
    };
  }
}
