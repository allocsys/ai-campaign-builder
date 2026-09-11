import { useState } from 'react'
import { Badge, Button, Card, Input, useToast } from '@ai-campaign-builder/ui-kit'
import { generateCampaign, updateCampaign } from '@ai-campaign-builder/api-client'
import type {
  BusinessCategorySlug,
  GeneratedCampaignProposal,
  RewardPatternName,
} from '@ai-campaign-builder/api-client'
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
 *   - Step 4 has an explicit reward-type dropdown (deterministic, owner-picked)
 *     alongside the free-text offer description, instead of asking the LLM to
 *     infer a reward_pattern from free text.
 */

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

/** select styled to match Input's glass surface -- ui-kit has no Select component yet. */
function selectClassName() {
  return 'bg-glass-light backdrop-blur-md border border-glass-border rounded-xl2 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-brand-500/60 transition-shadow'
}

export function CampaignWizardTab() {
  const { show: showToast } = useToast()
  const [step, setStep] = useState(1)

  const [businessName, setBusinessName] = useState('')
  const [categorySlug, setCategorySlug] = useState<BusinessCategorySlug>('coffee_shop')
  const [conditionalAnswer, setConditionalAnswer] = useState(CATEGORY_OPTIONS[0].conditionalOptions[0])
  const [goal, setGoal] = useState<'acquisition' | 'retention' | 'acquisition_retention'>('acquisition')
  const [audienceDescription, setAudienceDescription] = useState('')
  const [followerCount, setFollowerCount] = useState('')
  const [offerBudgetToman, setOfferBudgetToman] = useState('')
  const [offerDescription, setOfferDescription] = useState('')
  const [rewardPatternName, setRewardPatternName] = useState<RewardPatternName>('percentage_discount')

  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [proposal, setProposal] = useState<GeneratedCampaignProposal | null>(null)
  const [launching, setLaunching] = useState(false)

  const selectedCategory = CATEGORY_OPTIONS.find((c) => c.slug === categorySlug) ?? CATEGORY_OPTIONS[0]

  function handleCategoryChange(slug: BusinessCategorySlug) {
    setCategorySlug(slug)
    const cat = CATEGORY_OPTIONS.find((c) => c.slug === slug)
    if (cat) setConditionalAnswer(cat.conditionalOptions[0])
  }

  function goNext() {
    if (step === 1 && !businessName.trim()) {
      showToast('لطفاً نام کسب‌وکار را وارد کنید.', 'warning')
      return
    }
    if (step < TOTAL_STEPS) setStep(step + 1)
  }
  function goBack() {
    if (step > 1) setStep(step - 1)
  }

  async function handleGenerate() {
    if (!offerDescription.trim()) {
      showToast('لطفاً آفر یا پاداشی که می‌توانید ارائه دهید را بنویسید.', 'warning')
      return
    }
    setGenerating(true)
    setGenerateError(null)
    try {
      const result = await generateCampaign(apiClient, {
        businessName: businessName.trim(),
        categorySlug,
        goal,
        audienceDescription: `${audienceDescription.trim()}${audienceDescription.trim() ? ' — ' : ''}${selectedCategory.conditionalQuestion} ${conditionalAnswer}`,
        followerCount: Number(followerCount) || 0,
        offerBudgetToman: Number(offerBudgetToman) || 0,
        offerDescription: offerDescription.trim(),
        rewardPatternName,
      })
      setProposal(result)
      showToast('پیشنهاد کمپین با موفقیت تولید شد!', 'success')
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
    }
  }

  async function handleLaunch() {
    setLaunching(true)
    try {
      await updateCampaign(apiClient, { status: 'active' })
      showToast('کمپین با موفقیت راه‌اندازی شد!', 'success')
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
        {step === 1 && (
          <div className="flex flex-col gap-3">
            <Input
              label="نام کسب‌وکار"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="مثلاً کافه نارون"
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
            <div className="rounded-xl2 border border-glass-border bg-glass-light p-3 flex flex-col gap-3">
              <p className="text-xs text-slate-400">
                سیستم رده کسب‌وکار (میکرو/کوچک/متوسط/بزرگ) را از روی این دو سیگنال محاسبه می‌کند و ضریب امتیاز و مدت کمپین را تنظیم می‌کند.
              </p>
              <Input
                label="تعداد فالوورها یا مشتریان موجود"
                type="number"
                inputMode="numeric"
                value={followerCount}
                onChange={(e) => setFollowerCount(e.target.value)}
                placeholder="۰"
              />
              <Input
                label="بودجه آفر تخفیف یا پاداش (تومان)"
                type="number"
                inputMode="numeric"
                value={offerBudgetToman}
                onChange={(e) => setOfferBudgetToman(e.target.value)}
                placeholder="۰"
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-3">
            <Input
              label="چه چیزی می‌تونی به مشتری هدیه بدی؟ (آفر / پاداش)"
              value={offerDescription}
              onChange={(e) => setOfferDescription(e.target.value)}
              placeholder="مثلاً یک فنجان قهوه دمی، ۲۰٪ تخفیف روی سفارش دوم"
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-300">نوع پاداش</label>
              <select className={selectClassName()} value={rewardPatternName} onChange={(e) => setRewardPatternName(e.target.value as RewardPatternName)}>
                {REWARD_PATTERN_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.labelFa}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-400">قبل از ساخت کمپین، پاسخ‌هایت رو مرور کن:</p>
            <dl className="grid grid-cols-1 gap-y-2 text-sm rounded-xl2 border border-glass-border bg-glass-light p-4">
              <div><dt className="inline text-slate-400">🏷️ کسب‌وکار: </dt><dd className="inline">{businessName || '—'} ({selectedCategory.labelFa})</dd></div>
              <div><dt className="inline text-slate-400">🎯 هدف: </dt><dd className="inline">{goal === 'acquisition' ? 'جذب مشتری جدید' : goal === 'retention' ? 'حفظ و سفارش مجدد مشتریان' : 'جذب و نگه‌داشتن مشتری'}</dd></div>
              <div><dt className="inline text-slate-400">👥 مخاطب: </dt><dd className="inline">{audienceDescription || '—'}</dd></div>
              <div><dt className="inline text-slate-400">🎁 آفر: </dt><dd className="inline">{offerDescription || '—'}</dd></div>
              <div><dt className="inline text-slate-400">🎟️ نوع پاداش: </dt><dd className="inline">{REWARD_PATTERN_OPTIONS.find((r) => r.value === rewardPatternName)?.labelFa}</dd></div>
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
      </Card>
    </div>
  )
}
