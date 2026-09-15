import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Input } from '@ai-campaign-builder/ui-kit'
import {
  ApiError,
  getMicrositeState,
  updateMicrositeState,
  getMicrositeEligibility,
  activateMicrosite,
} from '@ai-campaign-builder/api-client'
import type { MicrositeState, MicrositeEligibility } from '@ai-campaign-builder/api-client'
import { MICROSITE_DOMAIN, validateMicrositeSlug } from '@ai-campaign-builder/shared-config'
import apiClient from '../../lib/api-client'

const GOAL_LABELS_FA: Record<'acquisition' | 'retention' | 'acquisition_retention', string> = {
  acquisition: 'جذب مشتری جدید',
  retention: 'وفادارسازی مشتریان',
  acquisition_retention: 'جذب و وفاداری مشتری',
}

const CAMPAIGN_STATUS_LABELS_FA: Record<'active' | 'draft' | 'ended', string> = {
  active: 'فعال',
  draft: 'پیش‌نویس',
  ended: 'پایان‌یافته',
}

/**
 * "Request a microsite for an existing campaign" -- shown when
 * getMicrositeState() 404s with code 'microsite_not_created' AND
 * getMicrositeEligibility() confirms there's actually a campaign to attach
 * one to. Replaces the old blurred-placeholder dead-end (which only ever
 * pointed the owner back at the campaigns list with no way to actually get
 * a microsite outside the wizard) with a real, immediately-actionable card:
 * the AI-suggested address is editable right here, and confirming both
 * creates the microsite AND turns the add-on on in one step, dropping the
 * owner straight into the normal builder view below on success.
 */
function MicrositeActivationCard({
  eligibility,
  onActivated,
}: {
  eligibility: Extract<MicrositeEligibility, { eligible: true }>
  onActivated: (state: MicrositeState) => void
}) {
  const [slugInput, setSlugInput] = useState(eligibility.suggestedSlug)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [activating, setActivating] = useState(false)
  const [activateError, setActivateError] = useState<string | null>(null)

  const handleActivate = async () => {
    const trimmed = slugInput.trim().toLowerCase()
    const validationError = validateMicrositeSlug(trimmed)
    if (validationError) {
      setSlugError(validationError)
      return
    }
    setSlugError(null)
    setActivateError(null)
    setActivating(true)
    try {
      const created = await activateMicrosite(apiClient, { subdomainSlug: trimmed })
      onActivated(created)
    } catch (err) {
      setActivateError(err instanceof Error ? err.message : String(err))
    } finally {
      setActivating(false)
    }
  }

  return (
    <div className="min-h-[70vh] flex items-start justify-center pt-10 px-4">
      <Card className="max-w-md w-full p-6 flex flex-col gap-5 shadow-2xl border-brand-500/40 bg-gradient-to-b from-brand-500/10 to-transparent">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-4xl" aria-hidden="true">
            ✨
          </span>
          <h2 className="text-base font-bold text-slate-100">میکروسایت شما آماده ساخته‌شدن است</h2>
          <p className="text-sm text-slate-400">
            یک کمپین بدون میکروسایت پیدا کردیم. همین حالا یک آدرس اختصاصی برایش فعال کنید.
          </p>
        </div>

        <div className="rounded-xl bg-white/5 p-3.5 flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500">کمپین</span>
            <span className="text-sm font-medium text-slate-100">{eligibility.businessName}</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge tone={eligibility.campaignStatus === 'active' ? 'success' : 'neutral'}>
              {CAMPAIGN_STATUS_LABELS_FA[eligibility.campaignStatus]}
            </Badge>
            <span className="text-xs text-slate-500">{GOAL_LABELS_FA[eligibility.campaignGoal]}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-200">آدرس پیشنهادی میکروسایت</label>
          <p className="text-xs text-slate-500">
            این آدرس را از نام کسب‌وکار شما پیشنهاد داده‌ایم؛ می‌توانید قبل از فعال‌سازی آن را ویرایش کنید.
          </p>
          <div dir="ltr">
            <Input
              value={slugInput}
              onChange={(e) => {
                setSlugInput(e.target.value)
                setSlugError(null)
              }}
              error={slugError ?? undefined}
              placeholder="cafetime"
            />
          </div>
          <p className="text-xs text-brand-400 font-medium" dir="ltr">
            {slugInput.trim() || '...'}.{MICROSITE_DOMAIN}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 p-3.5 flex items-center justify-between">
          <span className="text-sm text-slate-300">هزینه اشتراک ماهانه</span>
          <span className="text-sm font-bold text-slate-100">
            {eligibility.addonMonthlyPriceToman.toLocaleString('fa-IR')} تومان / ماه
          </span>
        </div>

        {activateError && <p className="text-xs text-red-400">{activateError}</p>}

        <Button onClick={handleActivate} loading={activating} className="w-full justify-center">
          خرید و فعال‌سازی میکروسایت
        </Button>
      </Card>
    </div>
  )
}

/**
 * Fallback for the (rarer) case where the owner has no campaign at all yet --
 * nothing to attach a microsite to, so there's genuinely nothing actionable
 * to offer here beyond pointing them at campaign creation.
 */
function NoCampaignYetCard() {
  const navigate = useNavigate()
  return (
    <div className="min-h-[70vh] flex items-start justify-center pt-16 px-4">
      <Card className="max-w-sm w-full p-6 flex flex-col items-center gap-4 text-center shadow-2xl border-brand-500/40">
        <span className="text-3xl" aria-hidden="true">
          🌐
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-base font-bold text-slate-100">هنوز کمپینی ندارید</h2>
          <p className="text-sm text-slate-400">
            برای فعال‌سازی میکروسایت، ابتدا باید یک کمپین بسازید.
          </p>
        </div>
        <Button onClick={() => navigate('/dashboard/campaign')} className="w-full justify-center">
          ساخت کمپین
        </Button>
      </Card>
    </div>
  )
}

/**
 * Business microsite module toggles (plan.md "Business microsite scope") — modular sections,
 * AI-set display order, no reordering/free-form layout (owner can only enable/disable).
 * TODO: wire to PATCH /business_microsite_modules once backend exists.
 */
export function MicrositeBuilderTab() {
  const [state, setState] = useState<MicrositeState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // plan.md decision (2026-09-15): microsite creation is no longer automatic
  // -- GET /microsite now 404s with code 'microsite_not_created' for any
  // business that hasn't checked the wizard's site checkbox yet. Tracked
  // separately from `error` so it renders the buy-and-activate flow (or the
  // no-campaign fallback) instead of a raw red error string.
  const [notCreated, setNotCreated] = useState(false)
  const [eligibility, setEligibility] = useState<MicrositeEligibility | null>(null)
  const [eligLoading, setEligLoading] = useState(false)
  const [eligError, setEligError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    getMicrositeState(apiClient)
      .then((data) => {
        if (mounted) {
          setState(data)
          setSlugInput(data.subdomainSlug)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!mounted) return
        if (err instanceof ApiError && err.code === 'microsite_not_created') {
          setNotCreated(true)
          setLoading(false)
          setEligLoading(true)
          getMicrositeEligibility(apiClient)
            .then((elig) => {
              if (mounted) setEligibility(elig)
            })
            .catch((eligErr) => {
              if (mounted) setEligError(eligErr instanceof Error ? eligErr.message : String(eligErr))
            })
            .finally(() => {
              if (mounted) setEligLoading(false)
            })
        } else {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [])

  const handleActivated = (created: MicrositeState) => {
    setState(created)
    setSlugInput(created.subdomainSlug)
    setNotCreated(false)
  }

  const [publishing, setPublishing] = useState(false)

  // plan.md Item 17 -- slug field state. Kept separate from `state` so the
  // owner can type/edit freely before saving without every keystroke
  // touching the server-confirmed MicrositeState.
  const [slugInput, setSlugInput] = useState('')
  const [slugSaving, setSlugSaving] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [slugConfirming, setSlugConfirming] = useState(false)

  const toggle = async (key: string) => {
    if (!state) return
    setActionError(null)
    const updatedModules = state.modules.map((m) =>
      m.key === key ? { ...m, enabled: !m.enabled } : m
    )
    try {
      const updated = await updateMicrositeState(apiClient, { modules: updatedModules })
      setState(updated)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setActionError(msg)
    }
  }

  const togglePublish = async () => {
    if (!state) return
    setActionError(null)
    setPublishing(true)
    try {
      const updated = await updateMicrositeState(apiClient, { published: !state.published })
      setState(updated)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setActionError(msg)
    } finally {
      setPublishing(false)
    }
  }

  // plan.md Item 17: the backend only allows this once (subdomain_slug_set_by_owner
  // flips to true after the first successful save), so a second "آدرس شما نهایی
  // خواهد شد و دیگر قابل تغییر نیست" confirmation step exists purely to make sure a
  // slip of the finger doesn't lock in a typo -- there's no undo after this.
  const saveSlug = async () => {
    if (!state) return
    const trimmed = slugInput.trim().toLowerCase()
    const validationError = validateMicrositeSlug(trimmed)
    if (validationError) {
      setSlugError(validationError)
      return
    }
    if (!slugConfirming) {
      setSlugError(null)
      setSlugConfirming(true)
      return
    }
    setSlugSaving(true)
    setSlugError(null)
    try {
      const updated = await updateMicrositeState(apiClient, { subdomainSlug: trimmed })
      setState(updated)
      setSlugInput(updated.subdomainSlug)
      setSlugConfirming(false)
    } catch (err) {
      setSlugError(err instanceof Error ? err.message : String(err))
      setSlugConfirming(false)
    } finally {
      setSlugSaving(false)
    }
  }

  if (loading) {
    return <div className="p-4 text-sm text-slate-400">در حال بارگذاری...</div>
  }

  if (notCreated) {
    if (eligLoading) {
      return <div className="p-4 text-sm text-slate-400">در حال بررسی کمپین‌های شما...</div>
    }
    if (eligError) {
      return <div className="p-4 text-sm text-red-400">{eligError}</div>
    }
    if (eligibility?.eligible) {
      return <MicrositeActivationCard eligibility={eligibility} onActivated={handleActivated} />
    }
    return <NoCampaignYetCard />
  }

  if (error) {
    return <div className="p-4 text-sm text-red-400">{error}</div>
  }

  if (!state) {
    return null
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">قالب: {state.templateName}</p>
            {!state.subdomainSlugEditable && (
              <p className="text-xs text-slate-500 mt-0.5" dir="ltr">
                {state.subdomainSlug}.{MICROSITE_DOMAIN}
              </p>
            )}
          </div>
          <Badge tone={state.published ? 'success' : 'neutral'}>
            {state.published ? 'منتشر شده' : 'پیش‌نویس'}
          </Badge>
        </div>
        {actionError && (
          <p className="text-xs text-red-400">{actionError}</p>
        )}
        <Button
          variant={state.published ? 'ghost' : 'primary'}
          onClick={togglePublish}
          loading={publishing}
          className="self-start"
        >
          {state.published ? 'لغو انتشار' : 'انتشار میکروسایت'}
        </Button>
      </Card>

      {state.subdomainSlugEditable ? (
        <Card className="p-4 flex flex-col gap-2">
          <p className="text-sm font-medium">آدرس میکروسایت</p>
          <p className="text-xs text-slate-500">
            یک آدرس اختصاصی برای میکروسایت خود انتخاب کنید. توجه: این آدرس فقط یک بار قابل تنظیم است و پس از ذخیره، دیگر قابل تغییر نخواهد بود.
          </p>
          <div className="flex items-end gap-2">
            <div className="flex-1" dir="ltr">
              <Input
                value={slugInput}
                onChange={(e) => {
                  setSlugInput(e.target.value)
                  setSlugConfirming(false)
                  setSlugError(null)
                }}
                error={slugError ?? undefined}
                placeholder="cafetime"
              />
              <p className="text-xs text-slate-500 mt-1">{slugInput || '...'}.{MICROSITE_DOMAIN}</p>
            </div>
            <Button onClick={saveSlug} loading={slugSaving}>
              {slugConfirming ? 'تأیید نهایی' : 'ذخیره'}
            </Button>
          </div>
          {slugConfirming && !slugError && (
            <p className="text-xs text-amber-400">
              آدرس «{slugInput.trim().toLowerCase()}» برای همیشه ثبت خواهد شد و دیگر قابل تغییر نیست. برای تأیید دوباره روی «تأیید نهایی» کلیک کنید.
            </p>
          )}
        </Card>
      ) : (
        <Card className="p-4 flex flex-col gap-1">
          <p className="text-sm font-medium">آدرس میکروسایت</p>
          <p className="text-xs text-slate-500" dir="ltr">
            {state.subdomainSlug}.{MICROSITE_DOMAIN}
          </p>
          <p className="text-xs text-slate-500 mt-1">این آدرس قبلاً ثبت شده و قابل تغییر نیست.</p>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {state.modules.map((m) => (
          <Card key={m.key} className="flex items-center justify-between p-3.5">
            <span className="text-sm">{m.labelFa}</span>
            <Button
              variant={m.enabled ? 'secondary' : 'ghost'}
              onClick={() => toggle(m.key)}
              aria-label={`${m.labelFa}: ${m.enabled ? 'فعال، کلیک برای غیرفعال کردن' : 'غیرفعال، کلیک برای فعال کردن'}`}
            >
              {m.enabled ? 'فعال' : 'غیرفعال'}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
