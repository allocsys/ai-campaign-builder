// ============================================================================
// AI campaign generation (plan.md Open Item 8, "Generation approach" decided
// 2026-09-11). Hybrid: everything with direct money/point consequences
// (size tier, pattern selection, points, thresholds, duration, discount %)
// is DETERMINISTIC, computed off category_pattern_weights (seeded in
// migration 0010) and the Phase 1 size-tier table -- ported verbatim from
// the mockup's shared/app.js (resolveSizeTier / scalePointsForTier /
// getSuggestedDuration / generateCampaignTasksForCategory). Only the
// user-facing COPY (task/reward names, challenge description, proposal
// title/narrative) is LLM-generated, reusing lib/vision.ts's exact
// Google->OpenAI cascade pattern and env vars (VISION_GOOGLE_API_KEYS /
// VISION_OPENAI_API_KEYS) -- these keys work for text generation too, so no
// new secrets are required. If every cascade step fails (no keys configured,
// every call errors), this falls back to sensible deterministic Persian
// default copy -- mirrors vision.ts's "never hard-fail" philosophy. The
// numbers/patterns are computed identically either way; only which strings
// label them changes.
// ============================================================================

import type { D1Database } from "@cloudflare/workers-types";
import type { Env } from "../types";
import { queryAll } from "./db";

// ============================================================================
// Size-tier resolution (Phase 1 "Business size-tier scaling" table)
// ============================================================================

export type SizeTierKey = "micro" | "small" | "medium" | "large";

export interface SizeTier {
  key: SizeTierKey;
  nameFa: string;
  pointMultiplier: number;
  suggestedDurationDays: number;
}

interface SizeTierBound extends SizeTier {
  maxFollowers: number;
  maxDailyCustomers: number;
  maxMonthlyRevenueToman: number;
}

// Thresholds revised 2026-09-12 (plan.md Open Item 11): the second signal
// changed from "offer/reward budget" to "approximate monthly revenue" --
// the old offer-budget wording looked like the same question as the wizard's
// Step 4 offer/reward description and confused owners into thinking they
// were being asked about their offer twice. Monthly revenue is a standalone
// business-size signal with no overlap with Step 4, but runs roughly 1000x
// larger in scale than an individual offer's budget, so these thresholds are
// NOT just the old ones relabeled -- they're a real recalibration.
//
// maxDailyCustomers added 2026-09-12 (plan.md "Signal model revised again"):
// follower count and walk-in/existing-customer count are genuinely
// independent signals (a business can have many customers and zero
// Instagram followers, or the reverse) -- previously the wizard's single
// ambiguous "followers or customers" field silently discarded whichever one
// the owner didn't enter. These bounds are a first estimate, NOT benchmarked
// data -- flag for revisiting once real businesses are on the platform, same
// caveat Phase 2's benchmark-data strategy carries for other numbers.
const SIZE_TIERS: SizeTierBound[] = [
  { key: "micro", nameFa: "میکرو", maxFollowers: 500, maxDailyCustomers: 15, maxMonthlyRevenueToman: 50000000, pointMultiplier: 0.7, suggestedDurationDays: 10 },
  { key: "small", nameFa: "کوچک", maxFollowers: 2000, maxDailyCustomers: 50, maxMonthlyRevenueToman: 200000000, pointMultiplier: 1, suggestedDurationDays: 14 },
  { key: "medium", nameFa: "متوسط", maxFollowers: 20000, maxDailyCustomers: 150, maxMonthlyRevenueToman: 1000000000, pointMultiplier: 1.5, suggestedDurationDays: 21 },
  { key: "large", nameFa: "بزرگ", maxFollowers: Infinity, maxDailyCustomers: Infinity, maxMonthlyRevenueToman: Infinity, pointMultiplier: 2, suggestedDurationDays: 30 },
];

// Signal-conflict rule (mockup's resolveSizeTier, ported verbatim, now
// extended from 2 to up to 3 signals): whichever provided signals point to
// different tiers, use the HIGHEST tier, not an average.
function findTierIndex(value: number, key: "maxFollowers" | "maxDailyCustomers" | "maxMonthlyRevenueToman"): number {
  for (let i = 0; i < SIZE_TIERS.length - 1; i++) {
    const bound = SIZE_TIERS[i][key];
    const isSecondToLast = i === SIZE_TIERS.length - 2;
    if (isSecondToLast ? value <= bound : value < bound) return i;
  }
  return SIZE_TIERS.length - 1;
}

// followerCount is optional (null when the owner has no Instagram page, or
// didn't check the "has a page" box in the wizard) -- when absent it simply
// doesn't participate in the max-tier comparison below, rather than being
// coerced to 0 and dragging the tier down. dailyCustomerCount and
// monthlyRevenueToman are always provided (the wizard's range sliders feed
// their average here, per plan.md's decision -- not the ceiling).
export function resolveSizeTier(followerCount: number | null, dailyCustomerCount: number, monthlyRevenueToman: number): SizeTier {
  const cCount = Number(dailyCustomerCount) || 0;
  const rToman = Number(monthlyRevenueToman) || 0;
  let idx = Math.max(findTierIndex(cCount, "maxDailyCustomers"), findTierIndex(rToman, "maxMonthlyRevenueToman"));
  if (followerCount != null) {
    const fCount = Number(followerCount) || 0;
    idx = Math.max(idx, findTierIndex(fCount, "maxFollowers"));
  }
  const { maxFollowers: _mf, maxDailyCustomers: _mc, maxMonthlyRevenueToman: _mr, ...tier } = SIZE_TIERS[idx];
  return tier;
}

// ============================================================================
// Fallback (non-AI) Persian copy -- used both when LLM generation fails
// entirely and to fill in the display name for any pattern the LLM response
// didn't cover. Deliberately lives only in this file: task_patterns /
// reward_patterns have no name_fa column of their own (unlike
// business_categories), since these display strings were always meant to be
// either AI-generated or a last-resort static default, never a DB-stored
// canonical label.
// ============================================================================

const TASK_PATTERN_FALLBACK_NAMES: Record<string, string> = {
  social_proof: "اشتراک‌گذاری در استوری",
  referral: "دعوت از دوستان",
  repeat_purchase: "خرید مجدد",
  milestone_streak: "مراجعه پیوسته",
  specific_product_push: "خرید محصول ویژه",
  review_ugc: "ثبت نظر و تجربه",
  first_action: "اولین خرید",
  off_peak: "مراجعه در ساعات خلوت",
  anniversary_birthday: "تبریک سالگرد/تولد",
};

const REWARD_PATTERN_FALLBACK_NAMES: Record<string, string> = {
  percentage_discount: "تخفیف روی خرید بعدی",
  free_item: "یک هدیه رایگان",
  free_shipping: "ارسال رایگان",
  vip_tier: "عضویت ویژه VIP",
  promo_item: "کالای پروموشنال",
  early_access: "دسترسی زودهنگام به محصولات جدید",
};

const DEFAULT_DISCOUNT_PERCENT_BY_TIER: Record<SizeTierKey, number> = {
  micro: 15,
  small: 20,
  medium: 25,
  large: 30,
};

// ============================================================================
// Deterministic task/reward/challenge shape (pre-copy). Points/thresholds
// computed here are final; only `name`/`description` strings get
// overwritten by the LLM step below (or keep these fallback values if it
// fails).
// ============================================================================

export interface GeneratedTask {
  patternName: string; // task_patterns.name
  name: string;
  points: number;
  verificationMethod: string;
}

export interface GeneratedRewardTier {
  patternName: string; // reward_patterns.name
  name: string;
  description: string;
  threshold: number;
}

export interface GeneratedChallenge {
  description: string;
  requiredActions: number;
  bonusPoints: number;
}

export interface GenerateCampaignInput {
  categoryId: string;
  categorySlug: string;
  categoryNameFa: string;
  businessName: string;
  goal: "acquisition" | "retention" | "acquisition_retention";
  audienceDescription: string;
  offerDescription: string;
  followerCount: number;
  monthlyRevenueToman: number;
  rewardPatternNames: string[]; // owner-selected from the Step 4 multi-select (at least 1)
  maxDiscountPercent: number | null; // business_ai_constraints.max_discount_percent, null if unset
}

export interface GeneratedCampaignProposal {
  sizeTier: SizeTier;
  durationDays: number;
  proposalTitle: string;
  proposalNarrative: string;
  tasks: GeneratedTask[];
  rewards: GeneratedRewardTier[];
  challenge: GeneratedChallenge;
  discountClamped: boolean;
  copyGeneratedByAi: boolean;
}

// ============================================================================
// Step 1: deterministic pattern selection + point/threshold math
// ============================================================================

async function selectTasks(
  db: D1Database,
  categoryId: string,
  goal: "acquisition" | "retention" | "acquisition_retention",
  tier: SizeTier
): Promise<GeneratedTask[]> {
  const rows = await queryAll<{ pattern_name: string; base_points: number; verification_method: string; weight: number }>(
    db,
    `SELECT tp.name AS pattern_name, tp.base_points, tp.verification_method, cpw.weight
     FROM category_pattern_weights cpw
     JOIN task_patterns tp ON tp.id = cpw.task_pattern_id
     WHERE cpw.business_category_id = ?`,
    [categoryId]
  );

  // Goal-driven weight override (plan.md decision): First Action/Conversion
  // is forced to 3 (acquisition) or 1 (retention) at generation time only --
  // never written back to category_pattern_weights, since it's goal-specific
  // per campaign, not a category-level constant.
  //
  // acquisition_retention is deliberately NOT a midpoint interpolation of
  // the two overrides above (that would just land first_action on ~2 and
  // call it a day). It's a separate rule that boosts *two* patterns instead
  // of one -- first_action (the acquisition signal) AND repeat_purchase
  // (the retention signal) both get pushed up, so a combined-goal campaign
  // visibly rewards both new-customer and repeat-customer behavior rather
  // than averaging out to something that isn't strongly either.
  const withOverride = rows.map((r) => {
    if (r.pattern_name === "first_action") {
      if (goal === "acquisition") return { ...r, weight: 3 };
      if (goal === "retention") return { ...r, weight: 1 };
      return { ...r, weight: 2 }; // acquisition_retention
    }
    if (r.pattern_name === "repeat_purchase" && goal === "acquisition_retention") {
      return { ...r, weight: Math.min(3, r.weight + 1) };
    }
    return r;
  });

  // Top 4 by weight (mirrors the mockup's generateCampaignTasksForCategory,
  // which also takes slice(0, 4) after a descending weight sort). Array.sort
  // is stable in the JS engines this Worker runs on, so ties keep their
  // original (category_pattern_weights insertion) order.
  const chosen = [...withOverride].sort((a, b) => b.weight - a.weight).slice(0, 4);

  return chosen.map((p) => ({
    patternName: p.pattern_name,
    name: TASK_PATTERN_FALLBACK_NAMES[p.pattern_name] ?? p.pattern_name,
    points: Math.round(p.base_points * tier.pointMultiplier),
    verificationMethod: p.verification_method,
  }));
}

// Multi-select reward types (plan.md decision, 2026-09-11 revision): one
// reward tier is generated per owner-selected reward_pattern, in the order
// selected, with monotonically increasing thresholds (totalPoints * 1.5,
// totalPoints * 3, totalPoints * 4.5, ...). Always at least 2 tiers --
// matching the original single-pattern design, which always produced 2
// tiers -- so a single selection still yields tier 1 + tier 2 of that same
// pattern (cycling back to index 0 for any tier beyond the selected list's
// length). Selecting 3+ patterns produces 3+ tiers, one per pattern, rather
// than capping at 2 and silently dropping the extra selections.
function buildRewards(
  rewardPatternNames: string[],
  tasks: GeneratedTask[],
  tier: SizeTier,
  maxDiscountPercent: number | null
): { rewards: GeneratedRewardTier[]; discountClamped: boolean } {
  const totalPoints = tasks.reduce((sum, t) => sum + t.points, 0) || 1;
  const tierCount = Math.max(2, rewardPatternNames.length);

  let discountClamped = false;
  let prevThreshold = 0;
  const rewards: GeneratedRewardTier[] = [];

  for (let i = 0; i < tierCount; i++) {
    const rawThreshold = Math.round(totalPoints * 1.5 * (i + 1));
    const threshold = Math.max(prevThreshold + 10, rawThreshold, 10);
    prevThreshold = threshold;

    const patternName = rewardPatternNames[i % rewardPatternNames.length];

    let discountPercent: number | null = null;
    if (patternName === "percentage_discount") {
      const base = DEFAULT_DISCOUNT_PERCENT_BY_TIER[tier.key];
      if (maxDiscountPercent != null && base > maxDiscountPercent) {
        discountPercent = maxDiscountPercent;
        discountClamped = true;
      } else {
        discountPercent = base;
      }
    }

    const fallbackLabel = REWARD_PATTERN_FALLBACK_NAMES[patternName] ?? patternName;
    const description = discountPercent != null ? `${discountPercent}٪ ${fallbackLabel}` : fallbackLabel;

    rewards.push({
      patternName,
      name: `سطح ${i + 1}: ${description}`,
      description,
      threshold,
    });
  }

  return { rewards, discountClamped };
}

function buildChallenge(tasks: GeneratedTask[]): GeneratedChallenge {
  const totalPoints = tasks.reduce((sum, t) => sum + t.points, 0);
  return {
    description: "چالش تکمیلی: چند فعالیت متوالی در طول کمپین انجام دهید تا امتیاز ویژه دریافت کنید.",
    requiredActions: 3,
    bonusPoints: Math.max(20, Math.round(totalPoints * 0.6)),
  };
}

// ============================================================================
// Step 2: LLM copy generation -- text-only cascade mirroring lib/vision.ts's
// provider order (Google models first, then OpenAI), but for chat/text
// completion rather than multimodal scoring. Deliberately NOT imported from
// vision.ts / vision-cascade.config.ts: those are scoped narrowly to image
// scoring per that file's own header comment, and the model lineup best
// suited to short structured-JSON text generation isn't necessarily
// identical to the vision lineup, even though the provider ORDER (Google
// free tier first, OpenAI paid fallback second) is intentionally the same
// pattern for consistency.
// ============================================================================

interface TextCascadeStep {
  provider: "google" | "openai";
  model: string;
}

const TEXT_GENERATION_CASCADE: TextCascadeStep[] = [
  { provider: "google", model: "gemini-2.0-flash" },
  { provider: "google", model: "gemini-1.5-flash" },
  { provider: "openai", model: "gpt-4o-mini" },
  { provider: "openai", model: "gpt-4.1-nano" },
];

function pickKey(csv: string | undefined): string | null {
  if (!csv) return null;
  const keys = csv.split(",").map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) return null;
  return keys[Math.floor(Math.random() * keys.length)];
}

interface CopyGenerationResult {
  proposalTitle: string;
  proposalNarrative: string;
  taskNames: Record<string, string>; // keyed by patternName
  rewardNames: string[]; // one per reward tier, in tier order (length varies -- see buildRewards)
  challengeDescription: string;
}

function buildCopyPrompt(input: GenerateCampaignInput, tier: SizeTier, tasks: GeneratedTask[], rewards: GeneratedRewardTier[]): string {
  return (
    `You are writing Persian (Farsi) marketing copy for a small business loyalty ` +
    `campaign generator. Business: "${input.businessName}" (category: ${input.categoryNameFa}). ` +
    `Campaign goal: ${
      input.goal === "acquisition"
        ? "acquiring new customers"
        : input.goal === "retention"
          ? "retaining/re-engaging existing customers"
          : "both acquiring new customers AND retaining/re-engaging existing customers together"
    }. ` +
    `Target audience: ${input.audienceDescription || "عمومی"}. ` +
    `Offer/reward the owner can give: ${input.offerDescription || "نامشخص"}. ` +
    `Business size tier: ${tier.nameFa}. ` +
    `Tasks (behavioral patterns customers complete for points): ${tasks
      .map((t) => t.patternName)
      .join(", ")}. ` +
    `Reward tiers (in order): ${rewards
      .map(
        (r, i) =>
          `tier ${i + 1} at ${r.threshold} points, type ${r.patternName}${r.description ? ` (${r.description})` : ""}`
      )
      .join("; ")}. ` +
    `Write everything in Persian. Respond with ONLY a JSON object and nothing else, in this exact shape: ` +
    `{"proposalTitle": "<short catchy campaign name>", "proposalNarrative": "<1-2 sentence pitch>", ` +
    `"taskNames": {${tasks.map((t) => `"${t.patternName}": "<short action name for this task>"`).join(", ")}}, ` +
    `"rewardNames": [${rewards.map((_, i) => `"<short name for reward tier ${i + 1}>"`).join(", ")}], ` +
    `"challengeDescription": "<1 sentence describing a bonus challenge: complete 3 actions during the campaign for extra points>"}`
  );
}

function parseCopyResponse(text: string): CopyGenerationResult {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("no JSON object found in model response");
  const parsed = JSON.parse(match[0]) as Partial<CopyGenerationResult>;
  if (
    typeof parsed.proposalTitle !== "string" ||
    typeof parsed.proposalNarrative !== "string" ||
    typeof parsed.taskNames !== "object" ||
    parsed.taskNames === null ||
    !Array.isArray(parsed.rewardNames) ||
    parsed.rewardNames.length < 1 ||
    typeof parsed.challengeDescription !== "string"
  ) {
    throw new Error("model response missing required fields");
  }
  return {
    proposalTitle: parsed.proposalTitle,
    proposalNarrative: parsed.proposalNarrative,
    taskNames: parsed.taskNames as Record<string, string>,
    rewardNames: parsed.rewardNames.map((n) => String(n)),
    challengeDescription: parsed.challengeDescription,
  };
}

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
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`openai text call failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

async function generateCopyViaCascade(env: Env, prompt: string): Promise<CopyGenerationResult | null> {
  for (const step of TEXT_GENERATION_CASCADE) {
    let key: string | null = null;
    if (step.provider === "google") key = pickKey(env.VISION_GOOGLE_API_KEYS);
    else if (step.provider === "openai") key = pickKey(env.VISION_OPENAI_API_KEYS);
    if (!key) continue; // provider has no keys configured -- skip, not a failure

    try {
      const text = step.provider === "google" ? await callGoogleText(key, step.model, prompt) : await callOpenAiText(key, step.model, prompt);
      return parseCopyResponse(text);
    } catch (err) {
      console.error(`campaign copy generation step ${step.provider}/${step.model} failed:`, err);
      // Fall through to the next cascade step.
    }
  }
  return null;
}

// ============================================================================
// Public entry point used by routes/business.ts
// ============================================================================

export async function generateCampaignProposal(db: D1Database, env: Env, input: GenerateCampaignInput): Promise<GeneratedCampaignProposal> {
  const tier = resolveSizeTier(input.followerCount, input.monthlyRevenueToman);
  const tasks = await selectTasks(db, input.categoryId, input.goal, tier);
  const { rewards, discountClamped } = buildRewards(input.rewardPatternNames, tasks, tier, input.maxDiscountPercent);
  const challenge = buildChallenge(tasks);

  const prompt = buildCopyPrompt(input, tier, tasks, rewards);
  const copy = await generateCopyViaCascade(env, prompt);

  if (copy) {
    for (const t of tasks) {
      if (copy.taskNames[t.patternName]) t.name = copy.taskNames[t.patternName];
    }
    for (let i = 0; i < rewards.length; i++) {
      if (copy.rewardNames[i]) rewards[i].name = copy.rewardNames[i];
    }
    challenge.description = copy.challengeDescription || challenge.description;
  }

  return {
    sizeTier: tier,
    durationDays: tier.suggestedDurationDays,
    proposalTitle:
      copy?.proposalTitle ??
      `کمپین ${
        input.goal === "acquisition"
          ? "جذب مشتری جدید"
          : input.goal === "retention"
            ? "حفظ و بازگشت مشتریان"
            : "جذب و نگه‌داشتن مشتری"
      } ${input.businessName}`,
    proposalNarrative:
      copy?.proposalNarrative ??
      `یک کمپین ${tier.nameFa} برای ${input.categoryNameFa} با ${tasks.length} تسک وزن‌دهی‌شده و ${rewards.length} سطح پاداش، متناسب با هدف انتخابی شما.`,
    tasks,
    rewards,
    challenge,
    discountClamped,
    copyGeneratedByAi: copy !== null,
  };
}
