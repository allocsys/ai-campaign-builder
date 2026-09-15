import { describe, it, expect } from "vitest";
import { buildRewards } from "../src/lib/campaign-generator";
import type { GeneratedTask, SizeTier } from "../src/lib/campaign-generator";

describe("Campaign Generator Reward Thresholds & buildRewards()", () => {
  const smallTier: SizeTier = {
    key: "small",
    nameFa: "کوچک",
    pointMultiplier: 1,
    suggestedDurationDays: 14,
  };

  it("a. Harley campaign simulation (first_action=30, repeat_purchase=15, off_peak=10, specific_product_push=50): new threshold is lower than old sum-based threshold and matches expected pacing", () => {
    const tasks: GeneratedTask[] = [
      { patternName: "first_action", name: "اولین خرید", points: 30, verificationMethod: "pos_scan" },
      { patternName: "repeat_purchase", name: "خرید مجدد", points: 15, verificationMethod: "pos_scan" },
      { patternName: "off_peak", name: "مراجعه در ساعات خلوت", points: 10, verificationMethod: "pos_scan" },
      { patternName: "specific_product_push", name: "خرید محصول ویژه", points: 50, verificationMethod: "pos_scan" },
    ];

    const { rewards } = buildRewards(["percentage_discount"], tasks, smallTier, null);
    const tier1Threshold = rewards[0].threshold;

    // Old sum-based threshold (also referencing (30+15+10+2) per prompt guidance)
    const oldSumReference = (30 + 15 + 10 + 2);
    const oldSumFull = tasks.reduce((sum, t) => sum + t.points, 0);
    const oldThreshold = Math.round(oldSumFull * 1.5 * 1);

    // New expected value using perPurchaseRate = 15 (repeat_purchase present)
    const expectedNew = Math.round(Math.max(30 + 15 * 2, 10) * 1.5 * 1);

    expect(tier1Threshold).toBe(expectedNew);
    expect(tier1Threshold).toBeLessThan(oldThreshold);
  });

  it("b. Campaign with first_action + milestone_streak (no repeat_purchase): perPurchaseRate falls back to milestoneStreakTask.points / 3", () => {
    const tasks: GeneratedTask[] = [
      { patternName: "first_action", name: "اولین خرید", points: 30, verificationMethod: "pos_scan" },
      { patternName: "milestone_streak", name: "مراجعه پیوسته", points: 30, verificationMethod: "pos_scan" },
    ];

    const { rewards } = buildRewards(["percentage_discount"], tasks, smallTier, null);
    const tier1Threshold = rewards[0].threshold;

    // perPurchaseRate = 30 / 3 = 10
    // totalPoints = Math.max(30 + 10 * 2, 10) = 50
    // tier 1 threshold = Math.round(50 * 1.5 * 1) = 75
    const expected = Math.round(Math.max(30 + (30 / 3) * 2, 10) * 1.5 * 1);
    expect(tier1Threshold).toBe(expected);
    expect(tier1Threshold).toBe(75);
  });

  it("c. Campaign with no first_action and no repeat_purchase/milestone_streak (social_proof + review_ugc): falls back to average-of-all-tasks behavior without throwing", () => {
    const tasks: GeneratedTask[] = [
      { patternName: "social_proof", name: "اشتراک‌گذاری در استوری", points: 20, verificationMethod: "screenshot" },
      { patternName: "review_ugc", name: "ثبت نظر و تجربه", points: 30, verificationMethod: "screenshot" },
    ];

    const { rewards } = buildRewards(["percentage_discount"], tasks, smallTier, null);
    const tier1Threshold = rewards[0].threshold;

    // oneTimeBonus = 0
    // recurringTasks = social_proof (20) + review_ugc (30) -> avg = 25
    // perPurchaseRate = 25
    // totalPoints = Math.max(0 + 25 * 2, 10) = 50
    // tier 1 threshold = Math.round(50 * 1.5 * 1) = 75
    expect(tier1Threshold).toBe(75);
    expect(rewards.length).toBeGreaterThanOrEqual(2);
  });

  it("d. Assert thresholds are still monotonically increasing across tiers for a multi-reward-pattern campaign", () => {
    const tasks: GeneratedTask[] = [
      { patternName: "first_action", name: "اولین خرید", points: 30, verificationMethod: "pos_scan" },
      { patternName: "repeat_purchase", name: "خرید مجدد", points: 15, verificationMethod: "pos_scan" },
    ];

    const { rewards } = buildRewards(["percentage_discount", "free_item", "free_shipping"], tasks, smallTier, null);
    expect(rewards.length).toBe(3);
    expect(rewards[0].threshold).toBeLessThan(rewards[1].threshold);
    expect(rewards[1].threshold).toBeLessThan(rewards[2].threshold);
  });
});
