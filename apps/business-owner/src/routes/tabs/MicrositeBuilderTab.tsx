import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Input } from '@ai-campaign-builder/ui-kit'
import { ApiError, getMicrositeState, updateMicrositeState } from '@ai-campaign-builder/api-client'
import type { MicrositeState } from '@ai-campaign-builder/api-client'
import { MICROSITE_DOMAIN, validateMicrositeSlug } from '@ai-campaign-builder/shared-config'
import apiClient from '../../lib/api-client'

/**
 * Purely decorative stand-in for the blurred background on the "no
 * microsite yet" cover screen below -- same non-fetching-placeholder
 * principle as DashboardIndexRoute's DashboardBackgroundPlaceholder (see
 * its comment for why this can't just be the real builder UI wrapped in
 * blur: this route's own GET already 404s cleanly with no side effect, but
 * mounting real state/inputs behind a blur is still pointless work and
 * risks a future refactor accidentally wiring a real handler behind it).
 * Static shapes only, never real data.
 */
function MicrositeBackgroundPlaceholder() {
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 rounded bg-white/10" />
          <Badge tone="neutral">پیش‌نویس</Badge>
        </div>
        <div className="h-8 w-32 rounded bg-white/10" />
      </Card>
      <Card className="p-4 flex flex-col gap-2">
        <div className="h-4 w-40 rounded bg-white/10" />
        <div className="h-3 w-full rounded bg-white/10" />
      </Card>
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="flex items-center justify-between p-3.5">
            <div className="h-3 w-24 rounded bg-white/10" />
            <div className="h-7 w-14 rounded bg-white/10" />
          </Card>
        ))}
      </div>
    </div>
  )
}

/**
 * Business microsite module toggles (plan.md "Business microsite scope") — modular sections,
 * AI-set display order, no reordering/free-form layout (owner can only enable/disable).
 * TODO: wire to PATCH /business_microsite_modules once backend exists.
 */
export function MicrositeBuilderTab() {
  const navigate = useNavigate()
  const [state, setState] = useState<MicrositeState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // plan.md decision (2026-09-15): microsite creation is no longer automatic
  // -- GET /microsite now 404s with code 'microsite_not_created' for any
  // business that hasn't checked the wizard's site checkbox yet. Tracked
  // separately from `error` so it renders the same blurred-cover pattern
  // DashboardIndexRoute already uses for "no campaign yet", instead of a
  // raw red error string.
  const [notCreated, setNotCreated] = useState(false)
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
        if (mounted) {
          if (err instanceof ApiError && err.code === 'microsite_not_created') {
            setNotCreated(true)
          } else {
            setError(err instanceof Error ? err.message : String(err))
          }
          setLoading(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [])

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
    return (
      <div className="relative min-h-[70vh]">
        <div className="pointer-events-none select-none blur-md opacity-50" aria-hidden="true">
          <MicrositeBackgroundPlaceholder />
        </div>
        <div className="absolute inset-0 flex items-start justify-center pt-16 px-4">
          <Card className="max-w-sm w-full p-6 flex flex-col items-center gap-4 text-center shadow-2xl border-brand-500/40">
            <span className="text-3xl" aria-hidden="true">
              🌐
            </span>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-base font-bold text-slate-100">شما هنوز میکروسایتی نساخته‌اید</h2>
              <p className="text-sm text-slate-400">
                میکروسایت فقط هنگام ساخت کمپین، با فعال‌کردن گزینه «میکروسایت می‌خواهم» در دستیار هوشمند کمپین، ساخته می‌شود.
              </p>
            </div>
            <Button onClick={() => navigate('/dashboard/campaign')} className="w-full justify-center">
              مشاهده کمپین‌ها
            </Button>
          </Card>
        </div>
      </div>
    )
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
