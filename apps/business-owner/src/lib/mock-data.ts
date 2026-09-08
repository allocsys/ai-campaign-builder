/**
 * Stub data shaped like the eventual real API responses (plan.md Phase 5: "stub with
 * mock-data.js-shaped data until backend exists"). Loosely mirrors mockup/shared/mock-data.js
 * structure, ported to TS, trimmed to what the 8 Business Owner tabs actually render.
 * Replace each of these with real fetches as the corresponding backend endpoint comes online —
 * see the TODO on each screen that consumes them.
 */

export const businessProfile = {
  name: 'کافه رست',
  categoryLabel: 'کافی‌شاپ/کافه',
  phone: '09121111111',
  sizeTier: 'small' as const,
  smsWalletBalanceToman: 42000,
  smsMonthlyCapToman: null as number | null,
}

export const checklistItems = [
  { key: 'ai_constraints_saved', label: 'تنظیم محدودیت‌های هوش مصنوعی', completed: true },
  { key: 'contacts_imported', label: 'وارد کردن حداقل یک مخاطب', completed: false },
]

export const campaign = {
  status: 'active' as const,
  goal: 'retention' as const,
  pointMultiplier: 1,
  startDate: '2026-09-01',
  endDate: '2026-09-15',
  tasks: [
    { name: 'اشتراک‌گذاری در استوری', pattern: 'social_proof', points: 20 },
    { name: 'خرید مجدد', pattern: 'repeat_purchase', points: 30 },
    { name: 'دعوت از دوستان', pattern: 'referral', points: 25 },
  ],
  rewards: [
    { name: '۱۰٪ تخفیف خرید بعدی', threshold: 50 },
    { name: 'یک نوشیدنی رایگان', threshold: 100 },
  ],
}

export const insights = [
  {
    id: 'i1',
    cadence: 'weekly' as const,
    message: 'نرخ تکمیل تسک «دعوت از دوستان» نسبت به میانگین این دسته ۲۰٪ پایین‌تر است.',
  },
  {
    id: 'i2',
    cadence: 'daily' as const,
    message: 'دیروز ۳ مشتری جدید به کمپین پیوستند.',
  },
]

export const suggestedChanges = [
  {
    id: 's1',
    riskTier: 'low' as const,
    changeType: 'task_points',
    rationale: 'افزایش امتیاز تسک «دعوت از دوستان» می‌تواند نرخ تکمیل را بهبود دهد.',
    status: 'pending' as const,
  },
  {
    id: 's2',
    riskTier: 'high' as const,
    changeType: 'reward_depth',
    rationale: 'افزایش عمق تخفیف پیشنهادی — نیازمند بررسی محدودیت‌های تعیین‌شده.',
    status: 'pending' as const,
  },
]

export const autopilotState = {
  enabled: false,
  manualApplyCount: 1,
  eligibilityThreshold: 3,
}

export const micrositeState = {
  published: false,
  templateName: 'Minimal Cafe',
  subdomainSlug: 'cafe-rast',
  modules: [
    { key: 'hero', labelFa: 'بنر اصلی', enabled: true },
    { key: 'about', labelFa: 'درباره ما', enabled: true },
    { key: 'gallery', labelFa: 'گالری تصاویر', enabled: false },
    { key: 'campaign_highlight', labelFa: 'کمپین فعال', enabled: true },
    { key: 'contact', labelFa: 'تماس با ما', enabled: true },
  ],
}

export const subscription = {
  tier: 'small' as const,
  monthlyPriceToman: 490000,
  status: 'active' as const,
  currentPeriodEnd: '2026-10-08',
}

export const sendsLog = [
  { id: 'n1', contact: '0912***1111', channel: 'sms' as const, trigger: 'campaign_invite', status: 'sent' as const, sentAt: '2026-09-08 09:12' },
  { id: 'n2', contact: '0935***4433', channel: 'telegram' as const, trigger: 'reward_unlocked', status: 'sent' as const, sentAt: '2026-09-08 10:05' },
  { id: 'n3', contact: '0919***7788', channel: 'sms' as const, trigger: 'campaign_invite', status: 'skipped' as const, sentAt: '2026-09-08 09:12' },
]
