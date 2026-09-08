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
