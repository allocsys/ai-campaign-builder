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

    let followerTierIndex = 0;
    for (let i = 0; i < tiers.length; i++) {
      if (fCount <= tiers[i].maxFollowers) {
        followerTierIndex = i;
        break;
      }
    }

    let budgetTierIndex = 0;
    for (let i = 0; i < tiers.length; i++) {
      if (bToman <= tiers[i].maxBudgetToman) {
        budgetTierIndex = i;
        break;
      }
    }

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
        campaign_id: arg1.campaign_id || null
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
        campaign_id: extra.campaign_id || null
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
        campaign_id: campaignId
      });
      return false; // skipped
    } else {
      logNotification({
        business_id: businessId,
        customer: `${customerName} (${contact.phone_number})`,
        channel: 'sms',
        trigger: 'campaign_invite',
        text: `دعوت‌نامه کمپین «${campaign.name}» برای ${contact.phone_number} ارسال شد. لینک عضویت: narvan.com/join`,
        status: 'sent',
        business_contact_id: contactId,
        campaign_id: campaignId
      });
      return true; // sent
    }
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
    renderHeader
  };
})();
