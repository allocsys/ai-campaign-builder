/**
 * Stub data + pure helper functions for the Customer app, shaped like the eventual
 * real API (plan.md Phase 5: "stub with mock-data.js-shaped data until backend exists").
 * Logic ported from mockup/customer.html + mockup/shared/app.js (referral signup,
 * retroactive purchase claims, redemption) — same rules, but reworked as pure
 * functions over React state instead of mutating a global window.MOCK object.
 * Replace with real fetches/mutations as backend endpoints come online — see the
 * TODO on each screen that consumes these.
 */

export type VerificationMethod = 'screenshot_ai' | 'code_link_auto' | 'pos_scan'
export type SubmissionStatus = 'pending' | 'approved' | null

export interface CampaignTask {
  id: string
  title: string
  instruction: string
  verificationMethod: VerificationMethod
  pointsValue: number
}

export interface CampaignReward {
  id: string
  title: string
  thresholdPoints: number
}

export interface NotificationEntry {
  id: string
  channel: 'sms' | 'telegram'
  trigger: string
  text: string
  time: string
}

export interface CustomerProfile {
  personalCode: string
  qrPayload: string
  pointsBalance: number
  referralCount: number
  maxReferralCap: number
  carryoverBonus: number
  telegramOptedIn: boolean
}

export const businessName = 'کافه نارون'

export const initialProfile: CustomerProfile = {
  personalCode: '48291',
  qrPayload: 'CAMP-NARVAN-48291',
  pointsBalance: 190,
  referralCount: 2,
  maxReferralCap: 10,
  carryoverBonus: 30,
  telegramOptedIn: false,
}

export const campaignTasks: CampaignTask[] = [
  {
    id: 'ct_1',
    title: 'استوری اینستاگرام از کافه',
    instruction: 'یک استوری با کد اختصاصی خود در اینستاگرام منتشر کنید.',
    verificationMethod: 'screenshot_ai',
    pointsValue: 20,
  },
  {
    id: 'ct_2',
    title: 'دعوت از دوستان',
    instruction: 'لینک دعوت خود را برای دوستانتان ارسال کنید.',
    verificationMethod: 'code_link_auto',
    pointsValue: 80,
  },
  {
    id: 'ct_3',
    title: 'خرید مجدد',
    instruction: 'در بازدید بعدی، کد خود را به صندوق‌دار نشان دهید.',
    verificationMethod: 'pos_scan',
    pointsValue: 60,
  },
]

export const campaignRewards: CampaignReward[] = [
  { id: 'r_1', title: '۱۰٪ تخفیف خرید بعدی', thresholdPoints: 100 },
  { id: 'r_2', title: 'یک فنجان قهوه گرم رایگان', thresholdPoints: 190 },
  { id: 'r_3', title: 'یک کیک همراه با نوشیدنی', thresholdPoints: 350 },
]

export const initialNotifications: NotificationEntry[] = [
  {
    id: 'n1',
    channel: 'sms',
    trigger: 'campaign_invite',
    text: 'به کمپین پاییزه کافه نارون خوش آمدید! کد شخصی شما: 48291',
    time: 'دیروز',
  },
  {
    id: 'n2',
    channel: 'sms',
    trigger: 'reward_unlocked',
    text: 'تبریک! شما به ۱۰۰ امتیاز رسیدید و می‌توانید تخفیف بگیرید.',
    time: 'امروز',
  },
]

/** Max retroactive claims allowed per customer per campaign (mirrors mockup's rate_limited rule). */
const RETRO_CLAIM_RATE_LIMIT = 3
/** Submission window for a retroactive claim (mirrors mockup's outside_time_window rule). */
const RETRO_CLAIM_MAX_HOURS = 72

export interface RetroClaim {
  id: string
  receiptHash: string
  receiptNumber: string
  hoursAgo: number
  submittedAt: string
}

export type RetroClaimResult =
  | { success: true; claim: RetroClaim }
  | { success: false; reason: 'outside_time_window' | 'duplicate_receipt' | 'rate_limited' }

/** Pure port of mockup/shared/app.js submitRetroactivePurchaseClaim — same 3 rejection rules. */
export function submitRetroactivePurchaseClaim(
  existingClaims: RetroClaim[],
  receiptHash: string,
  receiptNumber: string,
  hoursAgo: number,
): RetroClaimResult {
  if (hoursAgo > RETRO_CLAIM_MAX_HOURS) {
    return { success: false, reason: 'outside_time_window' }
  }
  const hash = receiptHash.trim() || `hash_${Date.now()}`
  if (existingClaims.some((c) => c.receiptHash === hash)) {
    return { success: false, reason: 'duplicate_receipt' }
  }
  if (existingClaims.length >= RETRO_CLAIM_RATE_LIMIT) {
    return { success: false, reason: 'rate_limited' }
  }
  return {
    success: true,
    claim: {
      id: `retro_${Date.now()}`,
      receiptHash: hash,
      receiptNumber: receiptNumber.trim() || `RCP-${Math.floor(1000 + Math.random() * 9000)}`,
      hoursAgo,
      submittedAt: 'همین الان',
    },
  }
}

export type ReferralSignupResult =
  | { success: true; capped: false; referrerLabel: string }
  | { success: true; capped: true; referrerLabel: string; maxCap: number }
  | { success: false; reason: 'invalid_code' }

const REFERRAL_CODE_PATTERN = /^\d{4,6}$/

/**
 * Simplified port of mockup's processCustomerSignupWithReferral — since this is a
 * single-customer stub session with no cross-customer database to look up a real
 * referrer against, any code matching the personal-code format (4-6 digits) is
 * treated as valid; `capped` is simulated from a stable hash of the code so the
 * UI's two distinct outcomes (points pending vs. cap-reached) are both reachable
 * without needing real backend state. TODO: replace with a real lookup once the
 * backend exists.
 */
export function processReferralSignup(referralCodeInput: string, maxCap: number): ReferralSignupResult {
  const clean = referralCodeInput.trim()
  if (!clean || !REFERRAL_CODE_PATTERN.test(clean)) {
    return { success: false, reason: 'invalid_code' }
  }
  const simulatedExistingCount = clean.split('').reduce((sum, d) => sum + Number(d), 0) % (maxCap + 2)
  const referrerLabel = `مشتری با کد ${clean}`
  if (simulatedExistingCount >= maxCap) {
    return { success: true, capped: true, referrerLabel, maxCap }
  }
  return { success: true, capped: false, referrerLabel }
}
