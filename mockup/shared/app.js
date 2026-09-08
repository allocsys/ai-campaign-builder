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

    function findTierIndex(value, key) {
      for (let i = 0; i < tiers.length; i++) {
        if (i === tiers.length - 1) break;
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

    const resolvedIndex = Math.max(followerTierIndex, budgetTierIndex);
    return tiers[resolvedIndex];
  }

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

  function generateCampaignTasksForCategory(categorySlug, goal, tier) {
    const taskPatterns = window.MOCK ? window.MOCK.taskPatterns : [];
    const weightsConfig = window.MOCK && window.MOCK.sizeTierConfig ? window.MOCK.sizeTierConfig.patternWeights : {};
    const catWeights = weightsConfig[categorySlug] || {
      social_proof: 2, referral: 2, repeat_purchase: 2, milestone_streak: 1, specific_product_push: 2, review_ugc: 2, first_action: 2, off_peak: 1, anniversary_birthday: 1
    };

    let resolvedWeights = { ...catWeights };
    if (goal === 'acquisition') {
      resolvedWeights.first_action = 3;
    } else if (goal === 'retention') {
      resolvedWeights.first_action = 1;
    }

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

  function getSubscriptionStatus(businessId) {
    const sub = window.MOCK && window.MOCK.businessSubscriptions ? window.MOCK.businessSubscriptions[businessId] : null;
    if (!sub) return null;
    const plan = window.MOCK.subscriptionPlans ? window.MOCK.subscriptionPlans[sub.plan_key] : null;
    return { ...sub, plan };
  }

  function getSmsPricePerSms() {
    return (window.MOCK && window.MOCK.smsPricing) ? window.MOCK.smsPricing.price_per_sms_toman : 350;
  }

  function getMonthlySmsSpend(businessId) {
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

  function computeCarryoverSplit(pointsBalance, carryoverPercentage) {
    const balance = Number(pointsBalance) || 0;
    const pct = Number(carryoverPercentage) != null ? Number(carryoverPercentage) : 30;
    const carried = Math.round(balance * (pct / 100));
    const forfeited = balance - carried;
    return { forfeited, carried };
  }

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

      code.points_balance = 0;

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

  function runReferralAnomalyDetection() {
    if (!window.MOCK || !window.MOCK.customerCampaignCodes) return 0;
    const codes = window.MOCK.customerCampaignCodes;
    const customers = window.MOCK.customers || [];
    const flags = window.MOCK.referralFlags || [];
    let newFlagsCount = 0;

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

      const deadReferrals = referredList.filter(rc => {
        const isOld = (rc.created_at_days_ago || 0) > 7;
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

    const existingReferralsCount = window.MOCK.customerCampaignCodes.filter(c => c.referred_by_code_id === referrerCode.id && c.campaign_id === campaignId).length;

    newCode.referred_by_code_id = referrerCode.id;

    const referrerCust = window.MOCK.customers.find(cu => cu.id === referrerCode.customer_id);
    const referrerName = referrerCust ? referrerCust.name : 'معرف';

    if (existingReferralsCount < maxCap) {
      const referralTask = window.MOCK.campaignTasks.find(t => t.task_pattern_id === 'referral') || window.MOCK.campaignTasks[1];
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
        status: 'pending',
        reviewed_by: null,
        notes: `امتیاز معرفی در انتظار اولین خرید مشتری جدید (${newCode.personal_code}) است.`,
        points_awarded: null,
        submitted_at: 'همین الان'
      });

      return { success: true, capped: false, referrerName, currentCount: existingReferralsCount + 1, maxCap };
    } else {
      return { success: true, capped: true, referrerName, currentCount: existingReferralsCount, maxCap };
    }
  }

  function processFirstPurchaseForCustomer(customerCodeId) {
    if (!window.MOCK) return null;
    const customerCode = window.MOCK.customerCampaignCodes.find(c => c.id === customerCodeId);
    if (!customerCode || !customerCode.referred_by_code_id) return null;

    const referrerCode = window.MOCK.customerCampaignCodes.find(c => c.id === customerCode.referred_by_code_id);
    if (!referrerCode) return null;

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

  function submitRetroactivePurchaseClaim(customerCampaignCodeId, campaignId, receiptImageHash, receiptNumber, hoursAgo = 12) {
    if (!window.MOCK) return { success: false, reason: 'system_error' };

    const hours = Number(hoursAgo) || 12;
    if (hours > 72) {
      return { success: false, reason: 'outside_time_window' };
    }

    const hash = receiptImageHash ? String(receiptImageHash).trim() : ('hash_' + Date.now());
    const existingByHash = (window.MOCK.taskSubmissions || []).find(s => 
      s.submission_type === 'retroactive_purchase_claim' && 
      s.receipt_hash === hash
    );
    if (existingByHash) {
      return { success: false, reason: 'duplicate_receipt' };
    }

    const existingForCustomer = (window.MOCK.taskSubmissions || []).filter(s =>
      s.customer_campaign_code_id === customerCampaignCodeId &&
      s.submission_type === 'retroactive_purchase_claim'
    );
    if (existingForCustomer.length >= 3) {
      return { success: false, reason: 'rate_limited' };
    }

    const code = window.MOCK.customerCampaignCodes.find(c => c.id === customerCampaignCodeId);
    const customer = code ? window.MOCK.customers.find(cu => cu.id === code.customer_id) : null;
    const customerName = customer ? customer.name : 'مشتری';

    const purchaseTask = window.MOCK.campaignTasks.find(t => t.task_pattern_id === 'first_action' || t.task_pattern_id === 'repeat_purchase') || window.MOCK.campaignTasks[2];

    const submission = {
      id: 'sub_retro_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      customer_campaign_code_id: customerCampaignCodeId,
      campaign_task_id: purchaseTask ? purchaseTask.id : 'ct_3',
      customer_name: customerName,
      task_title: 'ادعای خرید بازگشتی (فراموشی اسکن)',
      submission_type: 'retroactive_purchase_claim',
      evidence_url: 'receipt_' + (receiptNumber || 'scan') + '.jpg',
      receipt_number: receiptNumber ? String(receiptNumber).trim() : ('RCP-' + Math.floor(1000 + Math.random() * 9000)),
      receipt_hash: hash,
      ai_confidence_score: 42,
      status: 'pending',
      reviewed_by: null,
      notes: `ادعای خرید بازگشتی با شماره رسید ${receiptNumber || 'نامشخص'}. ثبت‌شده خارج از صندوق — نیازمند بررسی دقیق دستی (حسابرسی احتیاطی).`,
      points_awarded: null,
      submitted_at: 'همین الان'
    };

    window.MOCK.taskSubmissions.unshift(submission);
    return { success: true, submissionId: submission.id };
  }

  /**
   * GAP #9 Implementation: Staff POS Offline Queue Real Server-Side Verification on Sync
   * Processes each queued item in window.MOCK.offlineQueue:
   * 1. Duplicate detection: checks if idempotency_key already exists in syncedServerRecords store.
   *    If duplicate -> result: 'duplicate_skipped'.
   * 2. Validity check: checks if customer_campaign_code_id exists in customerCampaignCodes and campaign is active/valid.
   *    If invalid/not found -> result: 'invalid_skipped'.
   * 3. Valid items -> commits into syncedServerRecords, awards points/triggers referral clearance, result: 'synced'.
   * Returns per-item results array for UI display.
   */
  function syncStaffOfflineQueue() {
    if (!window.MOCK || !window.MOCK.offlineQueue) return [];
    const queue = window.MOCK.offlineQueue;
    const syncedStore = window.MOCK.syncedServerRecords || [];
    const codes = window.MOCK.customerCampaignCodes || [];
    const campaigns = window.MOCK.campaigns || [];

    const results = [];

    // Process each queued item
    queue.forEach(item => {
      // 1. Duplicate detection via idempotency_key
      const isDuplicate = syncedStore.some(r => r.idempotency_key === item.idempotency_key);
      if (isDuplicate) {
        results.push({
          itemId: item.id,
          idempotencyKey: item.idempotency_key,
          actionType: item.action_type,
          status: 'duplicate_skipped',
          reason: 'سرور مرکزی قبلاً این تراکنش را ثبت کرده است (شناسه تکراری / Duplicate Idempotency Key).'
        });
        item.sync_result = 'duplicate_skipped';
        item.status = 'synced_failed_duplicate';
        return;
      }

      // 2. Validity check: verify customer campaign code exists and campaign is active/valid
      const custCode = codes.find(c => c.id === item.customer_campaign_code_id);
      const campaign = campaigns.find(cp => cp.id === item.campaign_id);

      if (!custCode || !campaign || campaign.status !== 'active') {
        results.push({
          itemId: item.id,
          idempotencyKey: item.idempotency_key,
          actionType: item.action_type,
          status: 'invalid_skipped',
          reason: 'کد کاربری نامعتبر است یا کمپین مربوطه دیگر فعال/معتبر نمی‌باشد (Invalid Code or Inactive Campaign).'
        });
        item.sync_result = 'invalid_skipped';
        item.status = 'synced_failed_invalid';
        return;
      }

      // 3. Valid, non-duplicate item -> commit into normal flow as if scanned live
      const pts = item.points_awarded || 60;
      custCode.points_balance += pts;

      // Check first purchase clearance for referral if applicable
      const refRelease = processFirstPurchaseForCustomer(custCode.id);

      const committedRecord = {
        id: 'sync_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        idempotency_key: item.idempotency_key,
        customer_campaign_code_id: custCode.id,
        campaign_id: campaign.id,
        action_type: item.action_type,
        amount_toman: item.amount_toman,
        points_awarded: pts,
        synced_at: 'همین الان'
      };
      syncedStore.unshift(committedRecord);
      window.MOCK.syncedServerRecords = syncedStore;

      item.sync_result = 'synced';
      item.status = 'synced';

      results.push({
        itemId: item.id,
        idempotencyKey: item.idempotency_key,
        actionType: item.action_type,
        status: 'synced',
        pointsAwarded: pts,
        refRelease: refRelease,
        reason: 'با موفقیت راستی‌آزمایی و در سرور مرکزی ثبت شد.'
      });
    });

    // Clear queue after processing
    window.MOCK.offlineQueue = [];
    return results;
  }

  const STRUCTURAL_CHANGE_TYPES = ['add_task', 'remove_task'];
  const AUTOPILOT_ELIGIBLE_CHANGE_TYPES = ['task_points', 'reward_threshold', 'campaign_duration'];

  function isStructuralChangeType(changeType) {
    return STRUCTURAL_CHANGE_TYPES.includes(changeType);
  }

  function isAutopilotEligibleChangeType(changeType) {
    return AUTOPILOT_ELIGIBLE_CHANGE_TYPES.includes(changeType);
  }

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
      failed: { text: 'ناموفق', cls: 'badge-danger' },
      synced: { text: 'همگام و تایید شده', cls: 'badge-success' },
      duplicate_skipped: { text: 'رد شده (تکراری / Duplicate)', cls: 'badge-danger' },
      invalid_skipped: { text: 'رد شده (نامعتبر / Invalid)', cls: 'badge-danger' }
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
      return false;
    }

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
      return false;
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
    return true;
  }

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
    getSubscriptionStatus,
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
    submitRetroactivePurchaseClaim,
    syncStaffOfflineQueue,
    isStructuralChangeType,
    isAutopilotEligibleChangeType,
    checkSuggestionAgainstConstraints,
    renderScopeBadge,
    getMicrositeModules,
    saveMicrositeModules,
    renderHeader
  };
})();
