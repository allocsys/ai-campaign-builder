/**
 * Stub data + pure helper functions for the Review Console app, shaped like the
 * eventual real API (plan.md Phase 5: "stub with mock-data.js-shaped data until
 * backend exists"). Logic ported from mockup/review-console.html +
 * mockup/shared/app.js's resolveSubmission / runReferralAnomalyDetection /
 * resolveFlag — same rules, reworked as pure functions over React state instead
 * of mutating a global window.MOCK object (same pattern used in
 * apps/customer/src/lib/mock-data.ts and apps/staff-pos/src/lib/mock-data.ts).
 * Replace with real fetches/mutations as backend endpoints come online.
 */

export type SubmissionType = 'screenshot' | 'retroactive_purchase_claim' | 'referral_auto'
export type SubmissionStatus = 'pending' | 'approved' | 'rejected'

export interface TaskSubmission {
  id: string
  customerName: string
  taskTitle: string
  submissionType: SubmissionType
  evidenceUrl: string
  receiptNumber?: string
  aiConfidenceScore: number | null
  status: SubmissionStatus
  reviewedBy: string | null
  notes?: string
  pointsAwarded: number | null
  submittedAt: string
  /** Points to award on approval — mirrors the mockup's campaign_tasks.points_value lookup. */
  taskPointsValue: number
}

export type FlagRule = 'velocity' | 'dead_referral_ratio'
export type FlagStatus = 'open' | 'reviewed' | 'dismissed'

export interface ReferralFlag {
  id: string
  referrerName: string
  ruleTriggered: FlagRule
  ruleNameFa: string
  description: string
  triggeredAt: string
  status: FlagStatus
  notes: string
}

/**
 * Stub server-side aggregate data the real batch job would compute from
 * customer_campaign_codes + task_submissions (velocity = referred signups in
 * the last 24h, deadReferralCount = referred customers >7 days old with 0
 * approved purchases). Seeded to reproduce the same two test cases as the
 * mockup's seed data (mockup/shared/mock-data.js customerCampaignCodes):
 * one referrer over the velocity threshold (>5), one over the dead-referral
 * threshold (>=5). TODO: replace with a real GET /referral-aggregates call.
 */
export interface ReferrerAggregate {
  id: string
  referrerName: string
  personalCode: string
  referralCount24h: number
  deadReferralCount: number
}

export const referrerAggregates: ReferrerAggregate[] = [
  { id: 'agg_1', referrerName: 'سارا احمدی (09129990001)', personalCode: '48291', referralCount24h: 6, deadReferralCount: 0 },
  { id: 'agg_2', referrerName: 'نیما محمدی (09129990003)', personalCode: '33812', referralCount24h: 0, deadReferralCount: 5 },
]

export const initialSubmissions: TaskSubmission[] = [
  {
    id: 'sub_2',
    customerName: 'علی رضایی',
    taskTitle: 'استوری اینستاگرام',
    submissionType: 'screenshot',
    evidenceUrl: 'story_ali_blurry.jpg',
    aiConfidenceScore: 56,
    status: 'pending',
    reviewedBy: null,
    notes: 'کد ۴ رقمی داخل تصویر محو است و نیازمند بررسی چشمی توسط تیم مرکزی می‌باشد.',
    pointsAwarded: null,
    submittedAt: '۱۴۰۳/۰۷/۰۵ ۱۸:۴۵',
    taskPointsValue: 50,
  },
  {
    id: 'sub_retro_seed_1',
    customerName: 'علی رضایی',
    taskTitle: 'ادعای خرید بازگشتی (فراموشی اسکن)',
    submissionType: 'retroactive_purchase_claim',
    evidenceUrl: 'receipt_scan_ali_9821.jpg',
    receiptNumber: 'RCP-9821',
    aiConfidenceScore: 42,
    status: 'pending',
    reviewedBy: null,
    notes: 'ادعای خرید بازگشتی (رسید فیزیکی). نیازمند بررسی دقیق دستی طبق قوانین فاز 0.5 (بدون شاهد صندوق).',
    pointsAwarded: null,
    submittedAt: '۱۴۰۳/۰۷/۰۵ ۱۲:۱۰',
    taskPointsValue: 60,
  },
]

export const initialFlags: ReferralFlag[] = [
  {
    id: 'rf_3',
    referrerName: 'رویا شمس (09198882211)',
    ruleTriggered: 'velocity',
    ruleNameFa: 'تعداد دعوت نامتعارف در بازه کوتاه (Velocity)',
    description: '۶ ثبت‌نام در ۱۲ ساعت انجام شده بود.',
    triggeredAt: '۱۴۰۳/۰۷/۰۵ ۰۹:۱۵',
    status: 'reviewed',
    notes: 'بررسی شد: ایشان از طریق استوری اینستاگرام پیج دانشجویی دعوت کرده‌اند و ۳ نفر خرید حضوری داشته‌اند. معتبر است.',
  },
]

export interface ResolveSubmissionResult {
  submissions: TaskSubmission[]
  pointsAwarded: number
  customerName: string
}

/** Pure port of mockup's resolveSubmission. reviewerPhone replaces the mockup's hardcoded 'central_team'. */
export function resolveSubmission(
  submissions: TaskSubmission[],
  id: string,
  decision: 'approved' | 'rejected',
  reviewerPhone: string,
): ResolveSubmissionResult | null {
  const target = submissions.find((s) => s.id === id)
  if (!target) return null

  const pointsAwarded = decision === 'approved' ? target.taskPointsValue : 0
  const updated: TaskSubmission = {
    ...target,
    status: decision,
    reviewedBy: reviewerPhone,
    pointsAwarded,
  }

  return {
    submissions: submissions.map((s) => (s.id === id ? updated : s)),
    pointsAwarded,
    customerName: target.customerName,
  }
}

const VELOCITY_THRESHOLD = 5
const DEAD_REFERRAL_THRESHOLD = 5

export interface RunAnomalyDetectionResult {
  flags: ReferralFlag[]
  addedCount: number
}

/** Pure port of mockup's runReferralAnomalyDetection, operating over the stub referrerAggregates instead of raw customer_campaign_codes. Same two rules, same thresholds. */
export function runReferralAnomalyDetection(
  aggregates: ReferrerAggregate[],
  existingFlags: ReferralFlag[],
): RunAnomalyDetectionResult {
  const flags = [...existingFlags]
  let addedCount = 0

  for (const agg of aggregates) {
    if (agg.referralCount24h > VELOCITY_THRESHOLD) {
      const already = flags.some(
        (f) => f.referrerName.includes(agg.personalCode) === false && f.referrerName === agg.referrerName && f.ruleTriggered === 'velocity' && f.status === 'open',
      )
      if (!already) {
        flags.unshift({
          id: `rf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          referrerName: agg.referrerName,
          ruleTriggered: 'velocity',
          ruleNameFa: 'تعداد دعوت نامتعارف در بازه کوتاه (Velocity)',
          description: `تعداد ${agg.referralCount24h} ثبت‌نام موفق با این کد معرف ثبت شده است (سقف سیستم ۵ است).`,
          triggeredAt: 'همین الان',
          status: 'open',
          notes: '',
        })
        addedCount++
      }
    }

    if (agg.deadReferralCount >= DEAD_REFERRAL_THRESHOLD) {
      const already = flags.some(
        (f) => f.referrerName === agg.referrerName && f.ruleTriggered === 'dead_referral_ratio' && f.status === 'open',
      )
      if (!already) {
        flags.unshift({
          id: `rf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          referrerName: agg.referrerName,
          ruleTriggered: 'dead_referral_ratio',
          ruleNameFa: 'دعوت‌های غیرفعال بدون خرید (Dead Referral Ratio)',
          description: `تعداد ${agg.deadReferralCount} کاربر دعوت‌شده بیش از ۷ روز است ثبت‌نام کرده‌اند اما هیچ خرید یا فعالیتی ثبت نکرده‌اند.`,
          triggeredAt: 'همین الان',
          status: 'open',
          notes: '',
        })
        addedCount++
      }
    }
  }

  return { flags, addedCount }
}

/** Pure port of mockup's resolveFlag. */
export function resolveFlag(flags: ReferralFlag[], id: string, decision: 'reviewed' | 'dismissed'): ReferralFlag[] {
  return flags.map((f) =>
    f.id === id
      ? {
          ...f,
          status: decision,
          notes:
            decision === 'reviewed'
              ? 'توسط تیم مرکزی بررسی و بدون اقدام مخرب تشخیص داده شد.'
              : 'به‌عنوان هشدار اشتباه (False Positive) رد شد.',
        }
      : f,
  )
}
