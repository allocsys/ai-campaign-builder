import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Input, RangeSlider, useToast } from '@ai-campaign-builder/ui-kit'
import { createCampaign, updateCampaignById, updateMicrositeState, addStaff, getLatestCampaignSizeSignals } from '@ai-campaign-builder/api-client'
import type {
  BusinessCategorySlug,
  GeneratedCampaignProposal,
  RewardPatternName,
  StaffMember,
} from '@ai-campaign-builder/api-client'
import { MICROSITE_DOMAIN, validateMicrositeSlug } from '@ai-campaign-builder/shared-config'
import apiClient from '../../lib/api-client'

/**
 * AI campaign-generation onboarding wizard (plan.md Open Item 8). Mirrors
 * mockup/business-owner.html's 5-step "ONBOARDING WIZARD" flow + shared/app.js's
 * client-side resolveSizeTier/generateCampaignTasksForCategory logic -- except
 * here the real math happens server-side (lib/campaign-generator.ts), this
 * component just collects answers and renders whatever comes back.
 *
 * Two additions beyond the mockup (both plan.md decisions, since the mockup's
 * business record was static mock data and never had to consider either):
 *   - Step 1 also captures/corrects the business's real name (routes/auth.ts
 *     auto-creates a placeholder name on first OTP login; the wizard is
 *     realistically the first screen that can fix it).
 *   - Step 4 leads with the reward-type selection (deterministic, owner-picked,
 *     drives actual reward-tier/threshold/discount math) instead of asking the
 *     LLM to infer a reward_pattern from free text. The free-text offer
 *     description is now a collapsed, optional "write it yourself" escape
 *     hatch below the checkboxes -- it only ever feeds LLM copy generation,
 *     never the deterministic math -- reflecting the product decision that
 *     the wizard should let AI do the deciding/describing by default rather
 *     than making every owner spell it out (plan.md, revisited 2026-09-12).
 *   - Step 3's old single "followers or customers" field conflated two
 *     independent signals (a business can have many walk-in customers and
 *     zero Instagram followers, or the reverse). Now: daily-customer-count
 *     and monthly-revenue are each a range slider (owners estimate in bands,
 *     not exact figures -- the average of the selected range feeds the
 *     deterministic size-tier math), and follower count is a separate,
 *     optional field only shown once the owner checks "has an Instagram
 *     page" (plan.md, "Signal model revised again", 2026-09-12).
 *   - Step 1 also gets an opt-in "want a site" checkbox (plan.md Open Item
 *     18). When checked, the SAME generate-campaign LLM call is also asked
 *     to propose a microsite subdomain slug -- no separate/new LLM call.
 *     The result (already validated + uniqueness-checked server-side, see
 *     business.ts's resolveSuggestedMicrositeSlug) is shown after
 *     generation as an editable, skippable, one-time-permanent confirm step
 *     -- same "ذخیره" -> "تأیید نهایی" pattern MicrositeBuilderTab.tsx already
 *     uses for the exact same permanent choice, reached from Settings.
 */

function formatCustomerCount(v: number) {
  return `${v.toLocaleString()} نفر`
}

function formatToman(v: number) {
  return `${v.toLocaleString()} تومان`
}

const CATEGORY_OPTIONS: { slug: BusinessCategorySlug; labelFa: string; conditionalQuestion: string; conditionalOptions: string[] }[] = [
  {
    slug: 'coffee_shop',
    labelFa: 'کافی‌شاپ / کافه',
    conditionalQuestion: 'مشتری بیشتر حضوریه یا آنلاین/دلیوری؟',
    conditionalOptions: ['اکثراً حضوری در سالن', 'سفارش بیرون‌بر و اسنپ‌فود', 'ترکیبی متوازن'],
  },
  {
    slug: 'clothing',
    labelFa: 'فروشگاه لباس / پوشاک',
    conditionalQuestion: 'فروش فصلی داری یا کالای همیشگی؟',
    conditionalOptions: ['بیشتر فصلی', 'بیشتر همیشگی', 'ترکیبی'],
  },
  {
    slug: 'restaurant',
    labelFa: 'رستوران / فست‌فود',
    conditionalQuestion: 'تمرکز روی سفارش مجدد یا تجربه حضوری؟',
    conditionalOptions: ['سفارش مجدد', 'تجربه حضوری', 'هر دو'],
  },
  {
    slug: 'online_store',
    labelFa: 'فروشگاه آنلاین (غیر پوشاک)',
    conditionalQuestion: 'چرخه خرید تکراریه یا یک‌بار مصرف؟',
    conditionalOptions: ['تکراری', 'یک‌بار مصرف', 'ترکیبی'],
  },
  {
    slug: 'gym',
    labelFa: 'باشگاه / سالن ورزشی',
    conditionalQuestion: 'هدف نگه‌داشتن مشتری قدیمیه یا جذب جدید؟',
    conditionalOptions: ['نگه‌داشتن مشتری قدیمی', 'جذب مشتری جدید', 'هر دو'],
  },
  {
    slug: 'beauty_clinic',
    labelFa: 'کلینیک زیبایی',
    conditionalQuestion: 'خدمات یک‌باره یا پکیج/دوره‌ای؟',
    conditionalOptions: ['یک‌باره', 'پکیج/دوره‌ای', 'ترکیبی'],
  },
]

const REWARD_PATTERN_OPTIONS: { value: RewardPatternName; labelFa: string }[] = [
  { value: 'percentage_discount', labelFa: 'درصد تخفیف' },
  { value: 'free_item', labelFa: 'کالای رایگان' },
  { value: 'free_shipping', labelFa: 'ارسال رایگان' },
  { value: 'vip_tier', labelFa: 'عضویت ویژه VIP' },
  { value: 'promo_item', labelFa: 'کالای پروموشنال' },
  { value: 'early_access', labelFa: 'دسترسی زودهنگام' },
]

const STEP_TITLES = ['صنف کسب‌وکار', 'هدف کمپین', 'مخاطب هدف و سیگنال اندازه', 'آفر و پاداش', 'مرور و تایید']
const TOTAL_STEPS = STEP_TITLES.length

/**
 * plan.md Item 20, Part C -- purely cosmetic "thinking" transition between
 * wizard steps. Keyed by the step being LEFT (i.e. THINKING_MESSAGES[1] is
 * what shows while moving from step 1 to step 2). A small pool per step
 * (rather than one fixed line) so repeat visits to the wizard don't show
 * identical copy every time -- one is picked at random per transition in
 * goNext(). Step 1's pool references the chosen category since that step's
 * conditional question genuinely already varies by category (honest copy,
 * not implying deeper personalization than the deterministic logic does).
 * Steps 2-4 have no such per-answer variation, so their pools are generic.
 */
const THINKING_MESSAGES: Record<number, string[]> = {
  1: [
    'دارم بر اساس {category} بهترین سؤال بعدی رو آماده می‌کنم...',
    'در حال تنظیم مراحل بعدی بر اساس صنف انتخابی...',
  ],
  2: [
    'در حال آماده‌سازی سؤال بعدی...',
    'یک لحظه، می‌رم سراغ مرحله بعد...',
    'دارم مرحله بعد رو آماده می‌کنم...',
  ],
  3: [
    'در حال ثبت سیگنال‌های اندازه کسب‌وکار...',
    'یک لحظه، می‌رم سراغ آفر و پاداش...',
  ],
  4: [
    'در حال آماده‌سازی صفحه مرور نهایی...',
    'یک لحظه، همه‌چیز رو برای مرور نهایی جمع‌بندی می‌کنم...',
  ],
}
const THINKING_TRANSITION_MS = 700

/** select styled to match Input's glass surface -- ui-kit has no Select component yet. */
function selectClassName() {
  return 'bg-glass-light backdrop-blur-md border border-glass-border rounded-xl2 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-brand-500/60 transition-shadow'
}

/**
 * The actual 5-step wizard UI + generate/launch logic, extracted (2026-09-13,
 * "bring the wizard back into the Campaign tab") so it can be embedded by
 * TWO callers instead of living behind one route:
 *   - CampaignWizardTab below: the from-scratch onboarding path for a
 *     business with no real campaign yet (unchanged behavior).
 *   - CampaignEditorTab: shown inline whenever `manualEditorEnabled` (پرو
 *     مود) is off, replacing what used to be a disabled/read-only dump of
 *     the manual editor's own fields -- that view was redundant with the
 *     dashboard's existing summary and gave non-pro owners no way to act.
 *     The wizard already tolerates being run against a business that has a
 *     real campaign: handleGenerate below simply surfaces the backend's 409
 *     ("campaign is active, end it first") as generateError if they try to
 *     regenerate over a live campaign, and freely overwrites a draft
 *     otherwise -- no separate embedded-mode branching needed here.
 * Callers own navigation after a successful launch via `onLaunched`, since
 * this component has no opinion on where to go next once it isn't always
 * the whole page.
 *
 * Decided 2026-09-15: this component used to support a `mode` prop --
 * 'legacy' targeted the single-"current"-campaign endpoints
 * (generateCampaign/updateCampaign, resolved server-side via
 * findCurrentCampaignId's active-then-newest fallback) for CampaignEditorTab's
 * now-removed inline fallback; 'new' targets the :campaignId-scoped
 * endpoints (createCampaign always makes a fresh row; updateCampaignById
 * activates that exact row) for the campaign list page's "ایجاد کمپین" flow.
 * CampaignEditorTab dropped its CampaignWizardForm fallback entirely back in
 * Item 21, leaving CampaignWizardTab as the only caller -- always in what
 * used to be 'new' mode. The `mode` prop and the legacy branch (which called
 * generateCampaign/updateCampaign, themselves removed as dead code once
 * ensureCampaign went away) have been removed; this component now always
 * creates a fresh campaign row and activates that exact row on launch.
 * `onLaunched` receives the new campaign's id so the caller can navigate
 * straight to its detail page.
 */
export function CampaignWizardForm({
  onLaunched,
}: {
  onLaunched?: (campaignId?: string) => void
}) {
  const { show: showToast } = useToast()
  const [step, setStep] = useState(1)
  const [newCampaignId, setNewCampaignId] = useState<string | null>(null)

  // plan.md Item 20, Part C -- cosmetic step-transition state. thinkingTimeoutRef
  // holds the in-flight setTimeout id so a rapid back-then-forward nav (or an
  // unmount mid-transition) can cancel it instead of letting a stale timer
  // land the wizard on the wrong step after the fact.
  const [thinking, setThinking] = useState(false)
  const [thinkingMessage, setThinkingMessage] = useState('')
  const thinkingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [businessName, setBusinessName] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [categorySlug, setCategorySlug] = useState<BusinessCategorySlug>('coffee_shop')
  const [conditionalAnswer, setConditionalAnswer] = useState(CATEGORY_OPTIONS[0].conditionalOptions[0])
  const [goal, setGoal] = useState<'acquisition' | 'retention' | 'acquisition_retention'>('acquisition')
  const [audienceDescription, setAudienceDescription] = useState('')
  const [dailyCustomerMin, setDailyCustomerMin] = useState(10)
  const [dailyCustomerMax, setDailyCustomerMax] = useState(50)
  const [monthlyRevenueMin, setMonthlyRevenueMin] = useState(20000000)
  const [monthlyRevenueMax, setMonthlyRevenueMax] = useState(80000000)
  const [hasInstagramPage, setHasInstagramPage] = useState(false)
  const [followerCount, setFollowerCount] = useState('')

  // plan.md Item 21 Step C -- pre-fill Step 3's size-signal inputs from the
  // business's most-recently-created campaign, editable in place. Fetched
  // once on mount, not re-fetched on startOver()/re-generation -- an owner
  // who already adjusted the sliders this session shouldn't have their
  // in-progress edits silently overwritten by a background refetch.
  useEffect(() => {
    let cancelled = false
    getLatestCampaignSizeSignals(apiClient)
      .then((signals) => {
        if (cancelled || !signals) return
        if (signals.dailyCustomerCountMin !== null) setDailyCustomerMin(signals.dailyCustomerCountMin)
        if (signals.dailyCustomerCountMax !== null) setDailyCustomerMax(signals.dailyCustomerCountMax)
        if (signals.monthlyRevenueTomanMin !== null) setMonthlyRevenueMin(signals.monthlyRevenueTomanMin)
        if (signals.monthlyRevenueTomanMax !== null) setMonthlyRevenueMax(signals.monthlyRevenueTomanMax)
        if (signals.followerCount !== null) {
          setHasInstagramPage(true)
          setFollowerCount(String(signals.followerCount))
        }
      })
      // Best-effort pre-fill -- a failed fetch (network hiccup, brand-new
      // business with nothing to pre-fill from) just leaves the wizard's
      // existing hardcoded defaults in place, same as today's behavior. Never
      // surfaced as a toast/error -- this is a convenience, not a required
      // step in launching a campaign.
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  const [offerDescription, setOfferDescription] = useState('')
  const [showOfferDetail, setShowOfferDetail] = useState(false)
  const [rewardPatternNames, setRewardPatternNames] = useState<RewardPatternName[]>(['percentage_discount'])
  const [wantsSite, setWantsSite] = useState(true)

  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [proposal, setProposal] = useState<GeneratedCampaignProposal | null>(null)
  const [launching, setLaunching] = useState(false)

  // plan.md Open Item 18 -- suggested site-address confirm/skip state. Kept
  // separate from `proposal` (same reasoning as MicrositeBuilderTab's own
  // slugInput vs server-confirmed MicrositeState) so the owner can edit
  // freely before saving.
  const [siteSlugInput, setSiteSlugInput] = useState('')
  const [siteSlugSaving, setSiteSlugSaving] = useState(false)
  const [siteSlugError, setSiteSlugError] = useState<string | null>(null)
  const [siteSlugConfirming, setSiteSlugConfirming] = useState(false)
  const [siteSlugSaved, setSiteSlugSaved] = useState(false)
  const [siteSlugSkipped, setSiteSlugSkipped] = useState(false)

  // Staff quick-add -- another post-generation, skippable card next to the
  // site-slug suggestion. Deliberately NOT part of the generate payload:
  // staff data has nothing to do with campaign math/copy, so it bypasses
  // handleGenerate entirely and calls addStaff directly, same pure-code
  // workflow StaffTab.tsx already uses in Settings -- no LLM involved.
  const [staffName, setStaffName] = useState('')
  const [staffPhone, setStaffPhone] = useState('')
  const [staffAdding, setStaffAdding] = useState(false)
  const [staffError, setStaffError] = useState<string | null>(null)
  const [addedStaff, setAddedStaff] = useState<StaffMember[]>([])
  const [staffSectionSkipped, setStaffSectionSkipped] = useState(false)

  const selectedCategory = CATEGORY_OPTIONS.find((c) => c.slug === categorySlug) ?? CATEGORY_OPTIONS[0]

  function handleCategoryChange(slug: BusinessCategorySlug) {
    setCategorySlug(slug)
    const cat = CATEGORY_OPTIONS.find((c) => c.slug === slug)
    if (cat) setConditionalAnswer(cat.conditionalOptions[0])
  }

  function toggleRewardPattern(value: RewardPatternName) {
    setRewardPatternNames((prev) => {
      if (prev.includes(value)) {
        if (prev.length === 1) {
          showToast('حداقل باید یک نوع پاداش انتخاب شده باشد.', 'warning')
          return prev
        }
        return prev.filter((v) => v !== value)
      }
      return [...prev, value]
    })
  }

  function clearPendingThinkingTransition() {
    if (thinkingTimeoutRef.current !== null) {
      clearTimeout(thinkingTimeoutRef.current)
      thinkingTimeoutRef.current = null
    }
  }

  // Unmount cleanup -- if the owner navigates away from the wizard entirely
  // mid-transition, don't let the timeout fire setState on an unmounted
  // component.
  useEffect(() => clearPendingThinkingTransition, [])

  function goNext() {
    if (step === 1 && !businessName.trim()) {
      showToast('لطفاً نام کسب‌وکار را وارد کنید.', 'warning')
      return
    }
    if (step >= TOTAL_STEPS) return

    // A stale timer from a previous goNext() (e.g. the owner tapped "بعد"
    // twice fast, or went back then forward again before the first
    // transition finished) must be cancelled here -- otherwise two
    // transitions can resolve out of order and briefly show a thinking
    // card stacked on top of the step it already advanced past.
    clearPendingThinkingTransition()

    const pool = THINKING_MESSAGES[step] ?? THINKING_MESSAGES[2]
    const template = pool[Math.floor(Math.random() * pool.length)]
    setThinkingMessage(template.replace('{category}', selectedCategory.labelFa))
    setThinking(true)

    thinkingTimeoutRef.current = setTimeout(() => {
      thinkingTimeoutRef.current = null
      setThinking(false)
      setStep((s) => Math.min(s + 1, TOTAL_STEPS))
    }, THINKING_TRANSITION_MS)
  }

  function goBack() {
    // Cancel any pending forward transition so it can't land on the wrong
    // step after the owner backs out mid-"thinking".
    clearPendingThinkingTransition()
    setThinking(false)
    if (step > 1) setStep(step - 1)
  }

  async function handleGenerate() {
    setGenerating(true)
    setGenerateError(null)
    try {
      const requestBody = {
        businessName: businessName.trim(),
        businessAddress: businessAddress.trim(),
        categorySlug,
        goal,
        audienceDescription: `${audienceDescription.trim()}${audienceDescription.trim() ? ' — ' : ''}${selectedCategory.conditionalQuestion} ${conditionalAnswer}`,
        dailyCustomerCount: Math.round((dailyCustomerMin + dailyCustomerMax) / 2),
        monthlyRevenueToman: Math.round((monthlyRevenueMin + monthlyRevenueMax) / 2),
        // plan.md Item 21 Step C -- the raw range, not just the averages
        // above, so this campaign's row has something for a future wizard
        // visit to pre-fill Step 3 from via GET /campaigns/latest-signals.
        dailyCustomerCountMin: dailyCustomerMin,
        dailyCustomerCountMax: dailyCustomerMax,
        monthlyRevenueTomanMin: monthlyRevenueMin,
        monthlyRevenueTomanMax: monthlyRevenueMax,
        followerCount: hasInstagramPage ? Number(followerCount) || 0 : null,
        offerDescription: offerDescription.trim(),
        rewardPatternNames,
        wantsSite,
      }
      const created = await createCampaign(apiClient, requestBody)
      setNewCampaignId(created.campaignId)
      setProposal(created)
      setSiteSlugInput(created.suggestedSiteSlug ?? '')
      setSiteSlugSaved(false)
      setSiteSlugSkipped(false)
      setSiteSlugConfirming(false)
      setSiteSlugError(null)
      showToast('پیشنهاد کمپین با موفقیت تولید شد!', 'success')
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
    }
  }

  // plan.md Open Item 18 -- same two-step "ذخیره" -> "تأیید نهایی" confirm
  // as MicrositeBuilderTab.tsx's saveSlug (the choice is permanent, so a
  // typo needs a second explicit confirmation, not just an undo option).
  async function saveSiteSlug() {
    const trimmed = siteSlugInput.trim().toLowerCase()
    const validationError = validateMicrositeSlug(trimmed)
    if (validationError) {
      setSiteSlugError(validationError)
      return
    }
    if (!siteSlugConfirming) {
      setSiteSlugError(null)
      setSiteSlugConfirming(true)
      return
    }
    setSiteSlugSaving(true)
    setSiteSlugError(null)
    try {
      await updateMicrositeState(apiClient, { subdomainSlug: trimmed })
      setSiteSlugInput(trimmed)
      setSiteSlugSaved(true)
      setSiteSlugConfirming(false)
      showToast('آدرس سایت با موفقیت ثبت شد!', 'success')
    } catch (err) {
      setSiteSlugError(err instanceof Error ? err.message : String(err))
      setSiteSlugConfirming(false)
    } finally {
      setSiteSlugSaving(false)
    }
  }

  // Mirrors StaffTab.tsx's handleAddStaff -- same validation/error shape,
  // just embedded inline so an owner can staff up right after generating a
  // campaign instead of navigating to Settings separately.
  async function handleAddStaffQuick() {
    if (!staffName.trim() || !staffPhone.trim()) {
      setStaffError('لطفاً نام و شماره موبایل را وارد کنید.')
      return
    }
    setStaffAdding(true)
    setStaffError(null)
    try {
      const newMember = await addStaff(apiClient, { name: staffName.trim(), phone: staffPhone.trim() })
      setAddedStaff((prev) => [...prev, newMember])
      setStaffName('')
      setStaffPhone('')
    } catch (err) {
      setStaffError(err instanceof Error ? err.message : String(err))
    } finally {
      setStaffAdding(false)
    }
  }

  async function handleLaunch() {
    setLaunching(true)
    try {
      if (!newCampaignId) throw new Error('کمپین هنوز ساخته نشده است.')
      await updateCampaignById(apiClient, newCampaignId, { status: 'active' })
      showToast('کمپین با موفقیت راه‌اندازی شد!', 'success')
      onLaunched?.(newCampaignId ?? undefined)
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'danger')
    } finally {
      setLaunching(false)
    }
  }

  function startOver() {
    setProposal(null)
    setGenerateError(null)
    setStep(1)
    setSiteSlugInput('')
    setSiteSlugSaved(false)
    setSiteSlugSkipped(false)
    setSiteSlugConfirming(false)
    setSiteSlugError(null)
    setStaffName('')
    setStaffPhone('')
    setStaffError(null)
    setAddedStaff([])
    setStaffSectionSkipped(false)
  }

  if (proposal) {
    return (
      <div className="flex flex-col gap-4">
        <Card className="p-5 border-2 border-brand-500/40">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-base font-semibold">{proposal.proposalTitle}</h3>
            <Badge tone="brand">{proposal.sizeTier.nameFa} (×{proposal.sizeTier.pointMultiplier})</Badge>
            <Badge tone="neutral">{proposal.sizeTier.suggestedDurationDays} روز</Badge>
            {!proposal.copyGeneratedByAi && <Badge tone="neutral">متن پیش‌فرض</Badge>}
          </div>
          <p className="text-sm text-slate-400 mb-4">{proposal.proposalNarrative}</p>

          {proposal.discountClamped && (
            <div className="mb-4 text-xs rounded-xl2 border border-amber-500/30 bg-amber-500/10 text-amber-300 p-3">
              درصد تخفیف پیشنهادی بر اساس سقف تخفیف ذخیره‌شده شما در تنظیمات محدود شد.
            </div>
          )}

          <div className="mb-4">
            <h4 className="text-sm font-medium text-slate-300 mb-2">تسک‌های وزن‌دهی شده</h4>
            <ul className="flex flex-col gap-1.5">
              {proposal.tasks.map((t) => (
                <li key={t.pattern} className="flex items-center justify-between text-sm bg-glass-light rounded-xl2 px-3 py-2">
                  <span>{t.name}</span>
                  <Badge tone="brand">+{t.points}</Badge>
                </li>
              ))}
            </ul>
          </div>

          <div className="mb-4">
            <h4 className="text-sm font-medium text-slate-300 mb-2">پاداش‌های چندسطحی</h4>
            <ul className="flex flex-col gap-1.5">
              {proposal.rewards.map((r) => (
                <li key={r.name} className="flex items-center justify-between text-sm bg-glass-light rounded-xl2 px-3 py-2">
                  <span>{r.name}</span>
                  <Badge tone="warning">{r.threshold} امتیاز</Badge>
                </li>
              ))}
            </ul>
          </div>

          <div className="text-xs rounded-xl2 border border-glass-border bg-glass-light p-3">
            🏆 <strong>چالش تکمیلی:</strong> {proposal.challenge.description} ({proposal.challenge.requiredActions} فعالیت ← +{proposal.challenge.bonusPoints} امتیاز)
          </div>
        </Card>

        {proposal.suggestedSiteSlug && !siteSlugSaved && !siteSlugSkipped && (
          <Card className="p-4 flex flex-col gap-2">
            <p className="text-sm font-medium">آدرس سایت پیشنهادی</p>
            <p className="text-xs text-slate-500">
              هوش مصنوعی این آدرس رو برای میکروسایتت پیشنهاد داده. می‌تونی ویرایشش کنی. توجه: این آدرس فقط یک بار قابل تنظیمه و بعد از ذخیره، دیگه قابل تغییر نیست.
            </p>
            <div className="flex items-end gap-2">
              <div className="flex-1" dir="ltr">
                <Input
                  value={siteSlugInput}
                  onChange={(e) => {
                    setSiteSlugInput(e.target.value)
                    setSiteSlugConfirming(false)
                    setSiteSlugError(null)
                  }}
                  error={siteSlugError ?? undefined}
                  placeholder="cafe-narvan"
                />
                <p className="text-xs text-slate-500 mt-1">{siteSlugInput || '...'}.{MICROSITE_DOMAIN}</p>
              </div>
              <Button onClick={saveSiteSlug} loading={siteSlugSaving}>
                {siteSlugConfirming ? 'تأیید نهایی' : 'ذخیره'}
              </Button>
            </div>
            {siteSlugConfirming && !siteSlugError && (
              <p className="text-xs text-amber-400">
                آدرس «{siteSlugInput.trim().toLowerCase()}» برای همیشه ثبت خواهد شد و دیگر قابل تغییر نیست. برای تأیید دوباره روی «تأیید نهایی» کلیک کن.
              </p>
            )}
            <button
              type="button"
              onClick={() => setSiteSlugSkipped(true)}
              className="self-start text-xs text-slate-500 hover:text-brand-300 underline underline-offset-2"
            >
              بعداً از تنظیمات انجامش می‌دم
            </button>
          </Card>
        )}
        {siteSlugSaved && (
          <Card className="p-4 flex flex-col gap-1">
            <p className="text-sm font-medium">آدرس سایت</p>
            <p className="text-xs text-slate-500" dir="ltr">{siteSlugInput}.{MICROSITE_DOMAIN}</p>
          </Card>
        )}

        {!staffSectionSkipped && (
          <Card className="p-4 flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium">افزودن سریع کارکنان</p>
              <p className="text-xs text-slate-500 mt-1">
                می‌تونی همین الان چند نفر از کارکنانت رو برای اپلیکیشن صندوق‌دار اضافه کنی. این بخش ربطی به هوش مصنوعی نداره -- هر وقت هم بخوای از تنظیمات قابل انجامه.
              </p>
            </div>

            {addedStaff.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {addedStaff.map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-sm bg-glass-light rounded-xl2 px-3 py-2">
                    <span>{s.name}</span>
                    <span dir="ltr" className="text-xs text-slate-400">{s.phone}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Input
                  label="نام"
                  placeholder="مثال: علی رضایی"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <Input
                  label="شماره موبایل"
                  placeholder="09123456789"
                  dir="ltr"
                  className="text-left"
                  value={staffPhone}
                  onChange={(e) => setStaffPhone(e.target.value)}
                />
              </div>
              <Button onClick={handleAddStaffQuick} loading={staffAdding}>
                افزودن
              </Button>
            </div>
            {staffError && <p className="text-xs text-red-400">{staffError}</p>}

            <button
              type="button"
              onClick={() => setStaffSectionSkipped(true)}
              className="self-start text-xs text-slate-500 hover:text-brand-300 underline underline-offset-2"
            >
              بعداً از تنظیمات انجامش می‌دم
            </button>
          </Card>
        )}
        {staffSectionSkipped && addedStaff.length > 0 && (
          <Card className="p-4 flex flex-col gap-1">
            <p className="text-sm font-medium">کارکنان اضافه‌شده ({addedStaff.length.toLocaleString('fa-IR')})</p>
          </Card>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={handleLaunch} loading={launching}>
            🚀 تایید و راه‌اندازی کمپین
          </Button>
          <Button variant="ghost" onClick={startOver} disabled={launching}>
            شروع دوباره
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="h-1.5 rounded-full bg-glass-light overflow-hidden">
          <div className="h-full bg-brand-500 transition-all" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <strong className="text-brand-400">مرحله {step} از {TOTAL_STEPS}</strong>
          <span>{STEP_TITLES[step - 1]}</span>
        </div>
      </div>

      <Card className="p-5">
        {thinking ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-slate-300" role="status" aria-live="polite">
            <div className="flex gap-1.5">
              <span className="h-2 w-2 rounded-full bg-brand-400 animate-bounce [animation-delay:-0.3s]" />
              <span className="h-2 w-2 rounded-full bg-brand-400 animate-bounce [animation-delay:-0.15s]" />
              <span className="h-2 w-2 rounded-full bg-brand-400 animate-bounce" />
            </div>
            <p>{thinkingMessage}</p>
          </div>
        ) : (
          <>
        {step === 1 && (
          <div className="flex flex-col gap-3">
            <Input
              label="نام کسب‌وکار"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="مثلاً کافه نارون"
            />
            <Input
              label="آدرس کسب‌وکار"
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              placeholder="مثلاً تهران، ولیعصر، خیابان توانیر، پلاک ۱۲"
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-300">صنف و نوع کسب‌وکار</label>
              <select className={selectClassName()} value={categorySlug} onChange={(e) => handleCategoryChange(e.target.value as BusinessCategorySlug)}>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.labelFa}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 rounded-xl2 border border-emerald-500/20 bg-emerald-500/5 p-3">
              <label className="text-xs font-medium text-emerald-300">{selectedCategory.conditionalQuestion}</label>
              <select className={selectClassName()} value={conditionalAnswer} onChange={(e) => setConditionalAnswer(e.target.value)}>
                {selectedCategory.conditionalOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={wantsSite}
                onChange={(e) => setWantsSite(e.target.checked)}
                className="rounded border-glass-border bg-glass-light accent-brand-500"
              />
              می‌خوام یک آدرس/صفحه اختصاصی (میکروسایت) برای کسب‌وکارم داشته باشم
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-300">هدف اصلی این کمپین چیه؟</label>
            <select className={selectClassName()} value={goal} onChange={(e) => setGoal(e.target.value as 'acquisition' | 'retention' | 'acquisition_retention')}>
              <option value="acquisition">جذب مشتری جدید (Acquisition)</option>
              <option value="retention">نگه‌داشتن و سفارش مجدد مشتریان قبلی (Retention)</option>
              <option value="acquisition_retention">جذب و نگه‌داشتن مشتری (Acquisition + Retention)</option>
            </select>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3">
            <Input
              label="مخاطب هدفت کیه؟"
              value={audienceDescription}
              onChange={(e) => setAudienceDescription(e.target.value)}
              placeholder="مثلاً دانشجویان محدوده مرکز شهر"
            />
            <div className="rounded-xl2 border border-glass-border bg-glass-light p-3 flex flex-col gap-4">
              <p className="text-xs text-slate-400">
                سیستم رده کسب‌وکار (میکرو/کوچک/متوسط/بزرگ) را از روی این سیگنال‌ها محاسبه می‌کند و ضریب امتیاز و مدت کمپین را تنظیم می‌کند. کف و سقف تقریبی رو انتخاب کن، لازم نیست عدد دقیق باشه.
              </p>
              <RangeSlider
                label="تعداد مشتری روزانه (تقریبی)"
                min={0}
                max={300}
                step={5}
                valueMin={dailyCustomerMin}
                valueMax={dailyCustomerMax}
                onChange={(min, max) => {
                  setDailyCustomerMin(min)
                  setDailyCustomerMax(max)
                }}
                formatValue={formatCustomerCount}
              />
              <RangeSlider
                label="درآمد ماهانه تقریبی (تومان)"
                min={0}
                max={1500000000}
                step={10000000}
                valueMin={monthlyRevenueMin}
                valueMax={monthlyRevenueMax}
                onChange={(min, max) => {
                  setMonthlyRevenueMin(min)
                  setMonthlyRevenueMax(max)
                }}
                formatValue={formatToman}
              />
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={hasInstagramPage}
                  onChange={(e) => setHasInstagramPage(e.target.checked)}
                  className="rounded border-glass-border bg-glass-light accent-brand-500"
                />
                پیج اینستاگرام دارم
              </label>
              {hasInstagramPage && (
                <Input
                  label="تعداد فالوورهای پیج اینستاگرام"
                  type="number"
                  inputMode="numeric"
                  value={followerCount}
                  onChange={(e) => setFollowerCount(e.target.value)}
                  placeholder="۰"
                />
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-300">چه پاداشی می‌خوای به مشتری بدی؟ (می‌تونی چند مورد انتخاب کنی)</label>
              <div className="flex flex-wrap gap-2">
                {REWARD_PATTERN_OPTIONS.map((r) => {
                  const selected = rewardPatternNames.includes(r.value)
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => toggleRewardPattern(r.value)}
                      aria-pressed={selected}
                      className={`text-sm rounded-xl2 px-3.5 py-2 border transition-colors ${
                        selected
                          ? 'bg-brand-500/20 border-brand-500/60 text-brand-200'
                          : 'bg-glass-light border-glass-border text-slate-300 hover:border-brand-500/30'
                      }`}
                    >
                      {r.labelFa}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-slate-500">هوش مصنوعی بر اساس همین انتخاب، متن و جزئیات کمپین رو خودش می‌سازه.</p>
            </div>

            <button
              type="button"
              onClick={() => setShowOfferDetail((s) => !s)}
              className="self-start text-xs text-slate-500 hover:text-brand-300 underline underline-offset-2"
            >
              {showOfferDetail ? 'بستن جزئیات دستی' : '+ می‌خوام خودم جزئیات آفر رو دقیق‌تر بنویسم (اختیاری)'}
            </button>

            {showOfferDetail && (
              <Input
                label="توضیح دقیق‌تر آفر (اختیاری — فقط برای متن تبلیغاتی، تاثیری روی امتیاز و آستانه‌ها نداره)"
                value={offerDescription}
                onChange={(e) => setOfferDescription(e.target.value)}
                placeholder="مثلاً یک فنجان قهوه دمی، ۲۰٪ تخفیف روی سفارش دوم"
              />
            )}
          </div>
        )}

        {step === 5 && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-400">قبل از ساخت کمپین، پاسخ‌هایت رو مرور کن:</p>
            <dl className="grid grid-cols-1 gap-y-2 text-sm rounded-xl2 border border-glass-border bg-glass-light p-4">
              <div><dt className="inline text-slate-400">🏷️ کسب‌وکار: </dt><dd className="inline">{businessName || '—'} ({selectedCategory.labelFa})</dd></div>
              <div><dt className="inline text-slate-400">📍 آدرس: </dt><dd className="inline">{businessAddress || '—'}</dd></div>
              <div><dt className="inline text-slate-400">🎯 هدف: </dt><dd className="inline">{goal === 'acquisition' ? 'جذب مشتری جدید' : goal === 'retention' ? 'حفظ و سفارش مجدد مشتریان' : 'جذب و نگه‌داشتن مشتری'}</dd></div>
              <div><dt className="inline text-slate-400">👥 مخاطب: </dt><dd className="inline">{audienceDescription || '—'}</dd></div>
              <div><dt className="inline text-slate-400">🧍 مشتری روزانه: </dt><dd className="inline">{formatCustomerCount(dailyCustomerMin)} تا {formatCustomerCount(dailyCustomerMax)}</dd></div>
              <div><dt className="inline text-slate-400">💰 درآمد ماهانه: </dt><dd className="inline">{formatToman(monthlyRevenueMin)} تا {formatToman(monthlyRevenueMax)}</dd></div>
              {hasInstagramPage && <div><dt className="inline text-slate-400">📸 فالوور اینستاگرام: </dt><dd className="inline">{followerCount || '۰'}</dd></div>}
              <div><dt className="inline text-slate-400">🎁 آفر: </dt><dd className="inline">{offerDescription || '—'}</dd></div>
              <div><dt className="inline text-slate-400">🎟️ نوع پاداش: </dt><dd className="inline">{REWARD_PATTERN_OPTIONS.filter((r) => rewardPatternNames.includes(r.value)).map((r) => r.labelFa).join('، ')}</dd></div>
            </dl>
            {generateError && (
              <p role="alert" className="text-xs text-red-400">{generateError}</p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-5">
          <Button variant="ghost" onClick={goBack} className={step === 1 ? 'invisible' : ''}>
            → مرحله قبل
          </Button>
          {step < TOTAL_STEPS ? (
            <Button onClick={goNext}>مرحله بعد ←</Button>
          ) : (
            <Button onClick={handleGenerate} loading={generating}>
              ✨ ساخت خودکار کمپین با هوش مصنوعی
            </Button>
          )}
        </div>
          </>
        )}
      </Card>
    </div>
  )
}

/**
 * Route wrapper for `/dashboard/campaign/new` (plan.md Item 21) -- the
 * "ایجاد کمپین" entry point from the campaign list page, and also what
 * DashboardIndexRoute's from-scratch cover-card CTA sends a business with
 * zero campaigns to. Unlike the pre-Item-21 version of this wrapper, there's
 * no "redirect away if a real campaign already exists" guard here anymore:
 * in the multi-campaign world an owner can start a new campaign at any time
 * (the only real constraint -- at most one *active* campaign per business --
 * is enforced server-side, surfaced to `CampaignWizardForm` as
 * `generateError`/a launch failure like any other API error). Renders the
 * form in `mode="new"` so it always creates a fresh campaign row rather than
 * overwriting whatever the business's "current" campaign happens to be, and
 * navigates straight to that new campaign's own detail page once launched.
 */
export function CampaignWizardTab() {
  const navigate = useNavigate()
  return (
    <CampaignWizardForm
      mode="new"
      onLaunched={(campaignId) =>
        navigate(campaignId ? `/dashboard/campaign/${campaignId}` : '/dashboard/campaign')
      }
    />
  )
}
