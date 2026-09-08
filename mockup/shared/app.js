/**
 * AI Campaign Builder - Shared Mock App Helpers
 */

window.App = (function () {
  // Session-scoped state (resets on page refresh)
  const session = {
    appliedSuggestionsCount: 0,
    autopilotActive: false,
    offlineQueue: [],
    redemptionTimers: {}
  };

  /**
   * Resolve size tier using follower count and offer budget Toman inputs.
   * Signal conflict rule: if the two signals point to different tiers, use the HIGHER tier.
   */
  function resolveSizeTier(followerCount, offerBudgetToman) {
    const tiers = window.MOCK && window.MOCK.sizeTierConfig ? window.MOCK.sizeTierConfig.tiers : [
      { key: "micro", maxFollowers: 500, maxBudgetToman: 30000, pointMultiplier: 0.7, suggestedDurationDays: 10 },
      { key: "small", maxFollowers: 2000, maxBudgetToman: 100000, pointMultiplier: 1.0, suggestedDurationDays: 14 },
      { key: "medium", maxFollowers: 20000, maxBudgetToman: 500000, pointMultiplier: 1.5, suggestedDurationDays: 21 },
      { key: "large", maxFollowers: Infinity, maxBudgetToman: Infinity, pointMultiplier: 2.0, suggestedDurationDays: 30 }
    ];

    const fCount = Number(followerCount) || 0;
    const bToman = Number(offerBudgetToman) || 0;

    // Boundary rule (fixed 2026-09-08 — see plan.md tier table wording): only the SECOND-TO-LAST tier's
    // own boundary is inclusive (matches "Large is strictly greater than X"); earlier tier boundaries are
    // exclusive-upper, since plan.md's ranges mean e.g. exactly 500 followers belongs to Small, not Micro.
    function findTierIndex(value, key) {
      for (let i = 0; i < tiers.length; i++) {
        if (i === tiers.length - 1) break; // last tier is the catch-all fallback below
        const bound = tiers[i][key];
        const isSecondToLast = i === tiers.length - 2;
        if (isSecondToLast ? value <= bound : value < bound) {
          return i;
        }
      }
      return tiers.length - 1;
    }

    const followerTierIndex = findTierIndex(fCount, 'maxFollowers');
    const budgetTierIndex = findTierIndex(bToman, 'maxBudgetToman');

    // Signal conflict rule: use the HIGHER tier index
    const resolvedIndex = Math.max(followerTierIndex, budgetTierIndex);
    return tiers[resolvedIndex];
  }

  /**
   * Scale base points for a given tier.
   */
  function scalePointsForTier(basePoints, tierKeyOrObj) {
    let multiplier = 1.0;
    if (typeof tierKeyOrObj === 'object' && tierKeyOrObj !== null) {
      multiplier = tierKeyOrObj.pointMultiplier != null ? tierKeyOrObj.pointMultiplier : 1.0;
    } else if (typeof tierKeyOrObj === 'string' && window.MOCK && window.MOCK.sizeTierConfig) {
      const found = window.MOCK.sizeTierConfig.tiers.find(t => t.key === tierKeyOrObj);
      if (found) multiplier = found.pointMultiplier;
    }
    return Math.round((Number(basePoints) || 0) * multiplier);
  }

  /**
   * Get suggested duration in days for a tier.
   */
  function getSuggestedDuration(tierKeyOrObj) {
    let days = 14;
    if (typeof tierKeyOrObj === 'object' && tierKeyOrObj !== null) {
      days = tierKeyOrObj.suggestedDurationDays != null ? tierKeyOrObj.suggestedDurationDays : 14;
    } else if (typeof tierKeyOrObj === 'string' && window.MOCK && window.MOCK.sizeTierConfig) {
      const found = window.MOCK.sizeTierConfig.tiers.find(t => t.key === tierKeyOrObj);
      if (found) days = found.suggestedDurationDays;
    }
    return days;
  }

  /**
   * Goal-driven First Action/Conversion weighting override:
   * When generating a campaign's task list, if campaign.goal === 'acquisition', boost the First Action/Conversion task pattern's weight toward 3;
   * if goal === 'retention', drop its weight toward 0-1.
   */
  function generateCampaignTasksForCategory(categorySlug, goal, tier) {
    const taskPatterns = window.MOCK ? window.MOCK.taskPatterns : [];
    const weightsConfig = window.MOCK && window.MOCK.sizeTierConfig ? window.MOCK.sizeTierConfig.patternWeights : {};
    const catWeights = weightsConfig[categorySlug] || {
      social_proof: 2, referral: 2, repeat_purchase: 2, milestone_streak: 1, specific_product_push: 2, review_ugc: 2, first_action: 2, off_peak: 1, anniversary_birthday: 1
    };

    // Apply Goal-driven First Action override
    let resolvedWeights = { ...catWeights };
    if (goal === 'acquisition') {
      resolvedWeights.first_action = 3; // boost toward 3
    } else if (goal === 'retention') {
      resolvedWeights.first_action = 1; // drop toward 0-1
    }

    // Select top task patterns with weight >= 2 (or top 4)
    const sortedPatterns = [...taskPatterns].sort((a, b) => {
      const wA = resolvedWeights[a.name] ?? 1;
      const wB = resolvedWeights[b.name] ?? 1;
      return wB - wA;
    });

    const chosen = sortedPatterns.slice(0, 4);
    return chosen.map((p, idx) => {
      const basePts = p.base_points;
      const scaledPts = scalePointsForTier(basePts, tier);
      return {
        id: 'ct_gen_' + (idx + 1),
        task_pattern_id: p.id,
        title: p.name_fa,
        verification_method: p.verification_method,
        base_points: basePts,
        points_value: scaledPts,
        display_order: idx + 1,
        instruction: `تسک مرتبط با ${p.name_fa} همراه با درج کد اختصاصی شما.`
      };
    });
  }

  /**
   * SMS wallet: real per-send deduction + optional monthly cap enforcement (Phase 0.9 "SMS cost control").
   */
  function getSmsPricePerSms() {
    return (window.MOCK && window.MOCK.smsPricing) ? window.MOCK.smsPricing.price_per_sms_toman : 350;
  }

  function getMonthlySmsSpend(businessId) {
    // Mock simplification: sums all deduction transactions logged this session (no real calendar-month tracking in the mock).
    if (!window.MOCK || !window.MOCK.smsWalletTransactions) return 0;
    return window.MOCK.smsWalletTransactions
      .filter(t => t.business_id === businessId && t.type === 'deduction')
      .reduce((sum, t) => sum + Math.abs(t.amount_toman), 0);
  }

  function recordSmsWalletTransaction(businessId, type, amountToman, notificationLogId) {
    const business = window.MOCK.businesses.find(b => b.id === businessId);
    const balanceAfter = business ? business.sms_wallet_balance_toman : null;
    const txn = {
      id: 'txn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      business_id: businessId,
      type: type,
      amount_toman: amountToman,
      notification_log_id: notificationLogId || null,
      balance_after_toman: balanceAfter,
      created_at: 'همین الان'
    };
    if (window.MOCK && window.MOCK.smsWalletTransactions) {
      window.MOCK.smsWalletTransactions.unshift(txn);
    }
    return txn;
  }

  /**
   * Attempt to deduct the cost of one SMS send from a business's prepaid wallet.
   * Checks (in order): wallet balance sufficiency, then optional monthly spending cap.
   * Returns { allowed, reason, costToman } — reason is 'insufficient_balance' | 'monthly_cap_reached' | null.
   * Does NOT deduct or record a transaction unless allowed === true.
   */
  function deductForSmsSend(businessId) {
    const business = window.MOCK.businesses.find(b => b.id === businessId);
    const price = getSmsPricePerSms();
    if (!business) {
      return { allowed: false, reason: 'insufficient_balance', costToman: price };
    }
    if (business.sms_wallet_balance_toman < price) {
      return { allowed: false, reason: 'insufficient_balance', costToman: price };
    }
    if (business.sms_monthly_cap_toman != null) {
      const monthlySpend = getMonthlySmsSpend(businessId);
      if ((monthlySpend + price) > business.sms_monthly_cap_toman) {
        return { allowed: false, reason: 'monthly_cap_reached', costToman: price };
      }
    }
    business.sms_wallet_balance_toman -= price;
    recordSmsWalletTransaction(businessId, 'deduction', -price, null);
    return { allowed: true, reason: null, costToman: price };
  }

  /**
   * Point expiry & carryover (plan.md Phase 0.5): after a campaign's grace period ends,
   * carryover_percentage of a customer's remaining balance is preserved as a carryover credit
   * (tied to customer+business, not a specific future campaign); the rest is forfeited.
   */
  function computeCarryoverSplit(pointsBalance, carryoverPercentage) {
    const balance = Number(pointsBalance) || 0;
    const pct = Number(carryoverPercentage) != null ? Number(carryoverPercentage) : 30;
    const carried = Math.round(balance * (pct / 100));
    const forfeited = balance - carried;
    return { forfeited, carried };
  }

  /**
   * Simulates a campaign's grace period ending: for every customer_campaign_code in the campaign
   * with a remaining balance, splits it per computeCarryoverSplit, zeroes the in-campaign balance
   * (forfeited + carried both leave the ended campaign), and creates a pending point_carryovers row
   * for the carried portion. Returns a per-customer breakdown for display.
   */
  function simulateCampaignEndCarryover(campaign) {
    if (!window.MOCK || !campaign) return [];
    const codes = window.MOCK.customerCampaignCodes.filter(c => c.campaign_id === campaign.id && c.points_balance > 0);
    const results = [];
    codes.forEach(code => {
      const before = code.points_balance;
      const { forfeited, carried } = computeCarryoverSplit(before, campaign.carryover_percentage);
      const customer = window.MOCK.customers.find(c => c.id === code.customer_id);

      if (carried > 0) {
        const row = {
          id: 'carryover_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          customer_id: code.customer_id,
          business_id: campaign.business_id,
          source_campaign_id: campaign.id,
          points: carried,
          consumed_in_campaign_id: null,
          created_at: 'همین الان'
        };
        if (window.MOCK.pointCarryovers) window.MOCK.pointCarryovers.unshift(row);
      }

      code.points_balance = 0; // grace period closed — balance leaves the ended campaign either way

      results.push({
        customerId: code.customer_id,
        customerName: customer ? customer.name : code.customer_id,
        codeId: code.id,
        before,
        forfeited,
        carried
      });
    });
    return results;
  }

  function getPendingCarryovers(businessId) {
    if (!window.MOCK || !window.MOCK.pointCarryovers) return [];
    return window.MOCK.pointCarryovers.filter(p => p.business_id === businessId && p.consumed_in_campaign_id == null);
  }

  /**
   * Applies a pending carryover row (by id) as a starting-bonus credit into the given target campaign's
   * customer_campaign_code for that same customer — simulating "customer joins the business's next campaign".
   * Marks the row consumed. Returns the applied row, or null if not found/already consumed/no matching code.
   */
  function applyCarryoverById(carryoverId, targetCampaignId) {
    if (!window.MOCK || !window.MOCK.pointCarryovers) return null;
    const row = window.MOCK.pointCarryovers.find(p => p.id === carryoverId && p.consumed_in_campaign_id == null);
    if (!row) return null;

    const targetCode = window.MOCK.customerCampaignCodes.find(c => c.customer_id === row.customer_id && c.campaign_id === targetCampaignId);
    if (!targetCode) return null;

    targetCode.points_balance += row.points;
    targetCode.carryover_bonus = (targetCode.carryover_bonus || 0) + row.points;
    row.consumed_in_campaign_id = targetCampaignId;
    return row;
  }

  /**
   * SUB-GAP A: Referral Anomaly Detection rule engine (plan.md "Referral abuse prevention" & architecture.md referral_flags).
   * Runs as a simulated batch job:
   * 1. Velocity rule: a referrer with more than 5 new referred signups within a rolling 24-hour window (or total > 5 in mock) -> flag.
   * 2. Dead-referral ratio rule: a referrer with >= 5 referred customers who are > 7 days old with zero purchases -> flag.
   * Generates referral_flags rows on demand into window.MOCK.referralFlags (advisory only, no auto-block).
   */
  function runReferralAnomalyDetection() {
    if (!window.MOCK || !window.MOCK.customerCampaignCodes) return 0;
    const codes = window.MOCK.customerCampaignCodes;
    const customers = window.MOCK.customers || [];
    const flags = window.MOCK.referralFlags || [];
    let newFlagsCount = 0;

    // Group referred codes by referrer code id
    const referralsByReferrer = {};
    codes.forEach(c => {
      if (c.referred_by_code_id) {
        if (!referralsByReferrer[c.referred_by_code_id]) {
          referralsByReferrer[c.referred_by_code_id] = [];
        }
        referralsByReferrer[c.referred_by_code_id].push(c);
      }
    });

    Object.keys(referralsByReferrer).forEach(referrerCodeId => {
      const referredList = referralsByReferrer[referrerCodeId];
      const referrerCode = codes.find(c => c.id === referrerCodeId);
      if (!referrerCode) return;
      const referrerCust = customers.find(cu => cu.id === referrerCode.customer_id);
      const referrerName = referrerCust ? `${referrerCust.name} (${referrerCust.phone_number})` : `کد معرف ${referrerCode.personal_code}`;

      // Rule 1: Velocity rule (> 5 referred signups)
      if (referredList.length > 5) {
        const existing = flags.find(f => f.referrer_name.includes(referrerCode.personal_code) && f.rule_triggered === 'velocity' && f.status === 'open');
        if (!existing) {
          flags.unshift({
            id: 'rf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            referrer_name: referrerName,
            rule_triggered: 'velocity',
            rule_name_fa: 'تعداد دعوت نامتعارف در بازه کوتاه (Velocity)',
            description: `تعداد ${referredList.length} ثبت‌نام موفق با این کد معرف ثبت شده است (سقف سیستم ۵ است).`,
            triggered_at: 'همین الان',
            status: 'open',
            notes: ''
          });
          newFlagsCount++;
        }
      }

      // Rule 2: Dead-referral ratio rule (>= 5 referred customers > 7 days old with zero purchases)
      const deadReferrals = referredList.filter(rc => {
        const isOld = (rc.created_at_days_ago || 0) > 7;
        // Check if zero purchases / zero approved submissions
        const hasPurchases = (window.MOCK.taskSubmissions || []).some(s => s.customer_campaign_code_id === rc.id && s.status === 'approved');
        return isOld && !hasPurchases;
      });

      if (deadReferrals.length >= 5) {
        const existing = flags.find(f => f.referrer_name.includes(referrerCode.personal_code) && f.rule_triggered === 'dead_referral_ratio' && f.status === 'open');
        if (!existing) {
          flags.unshift({
            id: 'rf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            referrer_name: referrerName,
            rule_triggered: 'dead_referral_ratio',
            rule_name_fa: 'دعوت‌های غیرفعال بدون خرید (Dead Referral Ratio)',
            description: `تعداد ${deadReferrals.length} کاربر دعوت‌شده بیش از ۷ روز است ثبت‌نام کرده‌اند اما هیچ خرید یا فعالیتی ثبت نکرده‌اند.`,
            triggered_at: 'همین الان',
            status: 'open',
            notes: ''
          });
          newFlagsCount++;
        }
      }
    });

    window.MOCK.referralFlags = flags;
    return newFlagsCount;
  }

  /**
   * SUB-GAP B: Process customer signup with referral code (gating + cap enforcement).
   * - Per-campaign cap (default 10): if referrer has reached 10 referrals in this campaign,
   *   referred person joins normally (no blocking), but referrer earns no additional points.
   * - First-purchase gating: referral points stay in Pending state until referred customer's first purchase clears.
   */
  function processCustomerSignupWithReferral(newCustomerCodeId, referralCodeInput, campaignId) {
    if (!referralCodeInput || !window.MOCK) return { success: false, reason: 'no_code' };
    const cleanInput = String(referralCodeInput).trim();
    if (!cleanInput) return { success: false, reason: 'empty_code' };

    const referrerCode = window.MOCK.customerCampaignCodes.find(c => c.personal_code === cleanInput && c.campaign_id === campaignId);
    if (!referrerCode) {
      return { success: false, reason: 'invalid_code' };
    }

    const newCode = window.MOCK.customerCampaignCodes.find(c => c.id === newCustomerCodeId);
    if (!newCode) return { success: false, reason: 'new_code_not_found' };

    const campaign = window.MOCK.campaigns.find(cp => cp.id === campaignId) || window.MOCK.campaigns[0];
    const maxCap = campaign && campaign.max_referrals_per_customer != null ? campaign.max_referrals_per_customer : 10;

    // Count existing referrals for this referrer in this campaign
    const existingReferralsCount = window.MOCK.customerCampaignCodes.filter(c => c.referred_by_code_id === referrerCode.id && c.campaign_id === campaignId).length;

    newCode.referred_by_code_id = referrerCode.id;

    const referrerCust = window.MOCK.customers.find(cu => cu.id === referrerCode.customer_id);
    const referrerName = referrerCust ? referrerCust.name : 'معرف';

    if (existingReferralsCount < maxCap) {
      // Create pending referral task submission (gated on first purchase!)
      const referralTask = window.MOCK.campaignTasks.find(t => t.task_pattern_id === 'tp_referral') || window.MOCK.campaignTasks[1];
      const pts = referralTask ? referralTask.points_value : 80;

      window.MOCK.taskSubmissions.unshift({
        id: 'sub_ref_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        customer_campaign_code_id: referrerCode.id,
        campaign_task_id: referralTask ? referralTask.id : 'ct_2',
        customer_name: referrerName,
        task_title: `معرفی دوست (ثبت‌نام جدید با کد ${newCode.personal_code})`,
        submission_type: 'referral_auto',
        evidence_url: 'system_auto_link',
        ai_confidence_score: null,
        status: 'pending', // Gated on first purchase!
        reviewed_by: null,
        notes: `امتیاز معرفی در انتظار اولین خرید مشتری جدید (${newCode.personal_code}) است.`,
        points_awarded: null,
        submitted_at: 'همین الان'
      });

      return { success: true, capped: false, referrerName, currentCount: existingReferralsCount + 1, maxCap };
    } else {
      // Reached cap: joined normally, but no additional points earned for referrer
      return { success: true, capped: true, referrerName, currentCount: existingReferralsCount, maxCap };
    }
  }

  /**
   * SUB-GAP B: Process first-purchase completion for a customer code (clears referral gating).
   * When a customer with a pending referral completes their first purchase, their referrer's pending
   * referral submission is approved, points are credited, and notification is sent.
   */
  function processFirstPurchaseForCustomer(customerCodeId) {
    if (!window.MOCK) return null;
    const customerCode = window.MOCK.customerCampaignCodes.find(c => c.id === customerCodeId);
    if (!customerCode || !customerCode.referred_by_code_id) return null;

    const referrerCode = window.MOCK.customerCampaignCodes.find(c => c.id === customerCode.referred_by_code_id);
    if (!referrerCode) return null;

    // Find pending referral submission for this referrer related to this signup
    const pendingSub = window.MOCK.taskSubmissions.find(s =>
      s.customer_campaign_code_id === referrerCode.id &&
      s.status === 'pending' &&
      s.submission_type === 'referral_auto'
    );

    if (pendingSub) {
      pendingSub.status = 'approved';
      pendingSub.reviewed_by = 'system_pos';
      const referralTask = window.MOCK.campaignTasks.find(t => t.id === pendingSub.campaign_task_id) || window.MOCK.campaignTasks[1];
      const pts = referralTask ? referralTask.points_value : 80;
      pendingSub.points_awarded = pts;
      pendingSub.notes = 'تایید شد: مشتری معرفی‌شده اولین خرید خود را در صندوق ثبت کرد.';

      referrerCode.points_balance += pts;
      referrerCode.referral_count = (referrerCode.referral_count || 0) + 1;

      const referrerCust = window.MOCK.customers.find(cu => cu.id === referrerCode.customer_id);
      const referrerName = referrerCust ? referrerCust.name : 'معرف';

      logNotification(
        referrerName + (referrerCust ? ` (${referrerCust.phone_number})` : ''),
        'sms',
        'submission_reviewed',
        `مشتری دعوت‌شده شما اولین خرید خود را ثبت کرد! ${pts} امتیاز معرفی به حساب شما واریز شد.`
      );

      return { referrerName, pts };
    }
    return null;
  }

  /**
   * Phase 3/4 change-type scope classification (plan.md "What the AI can suggest" / Phase 4 "Scope").
   * Structural change types always require a manual Apply, even with autopilot on.
   * Autopilot-eligible types are the numeric/parameter-only subset autopilot may auto-apply.
   */
  const STRUCTURAL_CHANGE_TYPES = ['add_task', 'remove_task'];
  const AUTOPILOT_ELIGIBLE_CHANGE_TYPES = ['task_points', 'reward_threshold', 'campaign_duration'];

  function isStructuralChangeType(changeType) {
    return STRUCTURAL_CHANGE_TYPES.includes(changeType);
  }

  function isAutopilotEligibleChangeType(changeType) {
    return AUTOPILOT_ELIGIBLE_CHANGE_TYPES.includes(changeType);
  }

  /**
   * Phase 3 constraint enforcement (plan.md "What the business owner tells the AI" / business_ai_constraints):
   * checks a high-risk (reward_depth) suggestion's suggested discount against the business's configured
   * max_discount_percent before it's shown as actionable. Low-risk suggestions are never blocked by this check
   * (constraints mainly matter for the high-risk tier per plan.md Phase 4 note).
   * Returns { blocked, reason } — reason is a human-readable Persian explanation, or null if not blocked.
   */
  function checkSuggestionAgainstConstraints(suggestion, businessId) {
    const constraints = window.MOCK && window.MOCK.businessAiConstraints ? window.MOCK.businessAiConstraints[businessId] : null;
    if (!constraints) return { blocked: false, reason: null };

    if (suggestion.risk_tier === 'high' && suggestion.change_type === 'reward_depth') {
      const suggestedDiscount = suggestion.suggested_value && suggestion.suggested_value.discount_percent;
      if (suggestedDiscount != null && constraints.max_discount_percent != null && suggestedDiscount > constraints.max_discount_percent) {
        return {
          blocked: true,
          reason: `این پیشنهاد (${suggestedDiscount}٪ تخفیف) از سقف تخفیف مجاز شما (${constraints.max_discount_percent}٪ — تنظیم‌شده در تب «تنظیمات») فراتر می‌رود، بنابراین طبق قوانین فاز ۳ نباید نمایش داده شود.`
        };
      }
      const suggestedCost = suggestion.suggested_value && (suggestion.suggested_value.cost_toman || suggestion.suggested_value.budget_toman);
      if (suggestedCost != null && constraints.budget_ceiling_toman != null && suggestedCost > constraints.budget_ceiling_toman) {
        return {
          blocked: true,
          reason: `هزینه این پیشنهاد (${formatToman(suggestedCost)}) از سقف بودجه پاداش شما (${formatToman(constraints.budget_ceiling_toman)} — تنظیم‌شده در تب «تنظیمات») فراتر می‌رود، بنابراین طبق قوانین فاز ۳ نباید نمایش داده شود.`
        };
      }
    }
    return { blocked: false, reason: null };
  }

  function renderScopeBadge(changeType, riskTier) {
    if (riskTier === 'high') {
      return `<span class="badge badge-scope badge-scope-manual"><span class="badge-dot"></span> ریسک بالا (اثر مالی — نیازمند تایید دستی)</span>`;
    }
    if (isStructuralChangeType(changeType)) {
      return `<span class="badge badge-scope badge-scope-manual"><span class="badge-dot"></span> همیشه دستی (ساختاری — نیازمند تایید دستی)</span>`;
    }
    return `<span class="badge badge-scope badge-scope-autopilot"><span class="badge-dot"></span> قابل اتوپایلوت (عددی — خودکار در صورت روشن بودن)</span>`;
  }

  function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type} fade-in`;
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ'}</span>
      <span class="toast-msg">${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3600);
  }

  function formatNumber(num) {
    if (num == null) return '۰';
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(num).replace(/[0-9]/g, w => persianDigits[+w]);
  }

  function formatToman(num) {
    if (num == null) return '۰ تومان';
    const parts = Number(num).toLocaleString('fa-IR');
    return `${parts} تومان`;
  }

  function renderStatusBadge(status) {
    const map = {
      approved: { text: 'تایید شده', cls: 'badge-success' },
      pending: { text: 'در انتظار بررسی', cls: 'badge-warning' },
      rejected: { text: 'رد شده', cls: 'badge-danger' },
      active: { text: 'فعال', cls: 'badge-success' },
      ended: { text: 'پایان‌یافته', cls: 'badge-secondary' },
      open: { text: 'در انتظار بررسی', cls: 'badge-warning' },
      reviewed: { text: 'بررسی شد', cls: 'badge-info' },
      dismissed: { text: 'رد شده', cls: 'badge-secondary' },
      sent: { text: 'ارسال شده', cls: 'badge-success' },
      skipped: { text: 'چشم‌پوشی / Dedup', cls: 'badge-warning' },
      failed: { text: 'ناموفق', cls: 'badge-danger' }
    };
    const item = map[status] || { text: status, cls: 'badge-secondary' };
    return `<span class="badge ${item.cls}">${item.text}</span>`;
  }

  function renderRiskBadge(riskTier) {
    if (riskTier === 'high') {
      return `<span class="badge badge-high-risk"><span class="badge-dot"></span> ریسک بالا (اثر مالی)</span>`;
    }
    return `<span class="badge badge-low-risk"><span class="badge-dot"></span> ریسک پایین (تنظیم پارامتر)</span>`;
  }

  function startCountdown(durationSeconds, displayElement, onExpire) {
    let remaining = durationSeconds;
    function update() {
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      if (displayElement) {
        displayElement.textContent = formatNumber(formatted);
      }
      if (remaining <= 0) {
        clearInterval(timer);
        if (typeof onExpire === 'function') onExpire();
      } else {
        remaining--;
      }
    }
    update();
    const timer = setInterval(update, 1000);
    return timer;
  }

  function logNotification(arg1, channel, trigger, text, extra = {}) {
    let entry = {};
    if (typeof arg1 === 'object' && arg1 !== null) {
      entry = {
        id: 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        business_id: arg1.business_id || 'b_narvan',
        customer: arg1.customer || 'کاربر نمونه',
        channel: arg1.channel || 'sms',
        trigger: arg1.trigger || 'custom',
        text: arg1.text || '',
        time: 'همین الان',
        status: arg1.status || 'sent',
        customer_campaign_code_id: arg1.customer_campaign_code_id || null,
        business_contact_id: arg1.business_contact_id || null,
        campaign_id: arg1.campaign_id || null,
        cost_toman: arg1.cost_toman != null ? arg1.cost_toman : null,
        skip_reason: arg1.skip_reason || null
      };
    } else {
      entry = {
        id: 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        business_id: extra.business_id || 'b_narvan',
        customer: arg1 || 'کاربر نمونه',
        channel: channel || 'sms',
        trigger: trigger || 'custom',
        text: text || '',
        time: 'همین الان',
        status: extra.status || 'sent',
        customer_campaign_code_id: extra.customer_campaign_code_id || null,
        business_contact_id: extra.business_contact_id || null,
        campaign_id: extra.campaign_id || null,
        cost_toman: extra.cost_toman != null ? extra.cost_toman : null,
        skip_reason: extra.skip_reason || null
      };
    }
    if (window.MOCK && window.MOCK.notificationsLog) {
      window.MOCK.notificationsLog.unshift(entry);
    }
    return entry;
  }

  function hasCampaignInviteSent(businessContactId, campaignId) {
    if (!window.MOCK || !window.MOCK.notificationsLog) return false;
    return window.MOCK.notificationsLog.some(log =>
      log.trigger === 'campaign_invite' &&
      log.business_contact_id === businessContactId &&
      log.campaign_id === campaignId &&
      log.status === 'sent'
    );
  }

  function sendCampaignInvite(contact, campaign) {
    const contactId = contact.id;
    const campaignId = campaign.id;
    const businessId = campaign.business_id || contact.business_id || 'b_narvan';
    const customerName = contact.name || contact.phone_number || 'مشتری';

    const alreadySent = hasCampaignInviteSent(contactId, campaignId);

    if (alreadySent) {
      logNotification({
        business_id: businessId,
        customer: `${customerName} (${contact.phone_number})`,
        channel: 'sms',
        trigger: 'campaign_invite',
        text: `دعوت‌نامه کمپین «${campaign.name}» برای ${contact.phone_number} (تکراری - چشم‌پوشی توسط Dedup)`,
        status: 'skipped',
        business_contact_id: contactId,
        campaign_id: campaignId,
        skip_reason: 'dedup'
      });
      return false; // skipped: dedup
    }

    // Not a duplicate — attempt to deduct the SMS cost from the business's prepaid wallet before sending.
    const walletResult = deductForSmsSend(businessId);

    if (!walletResult.allowed) {
      const reasonText = walletResult.reason === 'monthly_cap_reached'
        ? 'سقف ماهانه هزینه پیامک این کسب‌وکار پر شده است'
        : 'موجودی کیف‌پول پیامک کافی نیست';
      logNotification({
        business_id: businessId,
        customer: `${customerName} (${contact.phone_number})`,
        channel: 'sms',
        trigger: 'campaign_invite',
        text: `ارسال دعوت‌نامه کمپین «${campaign.name}» برای ${contact.phone_number} ناموفق بود: ${reasonText}.`,
        status: 'skipped',
        business_contact_id: contactId,
        campaign_id: campaignId,
        skip_reason: walletResult.reason,
        cost_toman: walletResult.costToman
      });
      return false; // skipped: wallet/cap
    }

    logNotification({
      business_id: businessId,
      customer: `${customerName} (${contact.phone_number})`,
      channel: 'sms',
      trigger: 'campaign_invite',
      text: `دعوت‌نامه کمپین «${campaign.name}» برای ${contact.phone_number} ارسال شد. لینک عضویت: narvan.com/join`,
      status: 'sent',
      business_contact_id: contactId,
      campaign_id: campaignId,
      cost_toman: walletResult.costToman
    });
    return true; // sent
  }

  /**
   * Microsite module toggles (Gap #6 fix, 2026-09-08): persists per business in the shared
   * in-memory MOCK data object (`window.MOCK.businessMicrositeModules`), without using browser storage (localStorage).
   */
  function getMicrositeModules(businessId) {
    if (window.MOCK && window.MOCK.businessMicrositeModules) {
      const stored = window.MOCK.businessMicrositeModules[businessId];
      if (stored) return { ...stored };
    }
    const defaults = {};
    if (window.MOCK && window.MOCK.websiteModules) {
      window.MOCK.websiteModules.forEach(m => {
        defaults[m.key] = m.default_coffee != null ? m.default_coffee : true;
      });
    }
    return defaults;
  }

  function saveMicrositeModules(businessId, modulesObj) {
    if (!window.MOCK) return false;
    if (!window.MOCK.businessMicrositeModules) {
      window.MOCK.businessMicrositeModules = {};
    }
    window.MOCK.businessMicrositeModules[businessId] = { ...modulesObj };
    return true;
  }

  function renderHeader(currentPersona) {
    const items = [
      { id: 'index', title: 'صفحه اصلی موکاپ', href: 'index.html' },
      { id: 'business', title: 'صاحب کسب‌وکار', href: 'business-owner.html' },
      { id: 'customer', title: 'مشتری', href: 'customer.html' },
      { id: 'pos', title: 'صندوقدار (Staff POS)', href: 'staff-pos.html' },
      { id: 'console', title: 'کنسول تیم مرکزی', href: 'review-console.html' },
      { id: 'microsite', title: 'میکروسایت عمومی', href: 'microsite-preview.html' }
    ];

    const navLinks = items.map(it => {
      const active = it.id === currentPersona ? 'active' : '';
      return `<a href="${it.href}" class="nav-item ${active}">${it.title}</a>`;
    }).join('');

    return `
      <header class="app-global-header">
        <div class="header-container">
          <div class="header-logo">
            <span class="logo-icon">⚡</span>
            <div>
              <span class="logo-title">پلتفرم کمپین‌ساز هوشمند</span>
              <span class="logo-subtitle">موکاپ تعاملی کلیک‌خور (Click-through Prototype)</span>
            </div>
          </div>
          <nav class="persona-nav">
            ${navLinks}
          </nav>
        </div>
      </header>
    `;
  }

  return {
    session,
    resolveSizeTier,
    scalePointsForTier,
    getSuggestedDuration,
    generateCampaignTasksForCategory,
    showToast,
    formatNumber,
    formatToman,
    renderStatusBadge,
    renderRiskBadge,
    startCountdown,
    logNotification,
    hasCampaignInviteSent,
    sendCampaignInvite,
    getSmsPricePerSms,
    getMonthlySmsSpend,
    recordSmsWalletTransaction,
    deductForSmsSend,
    computeCarryoverSplit,
    simulateCampaignEndCarryover,
    getPendingCarryovers,
    applyCarryoverById,
    runReferralAnomalyDetection,
    processCustomerSignupWithReferral,
    processFirstPurchaseForCustomer,
    isStructuralChangeType,
    isAutopilotEligibleChangeType,
    checkSuggestionAgainstConstraints,
    renderScopeBadge,
    getMicrositeModules,
    saveMicrositeModules,
    renderHeader
  };
})();
