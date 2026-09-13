import { useEffect, useState } from 'react'
import { Badge, Button, Card, Input } from '@ai-campaign-builder/ui-kit'
import { getMicrositeState, updateMicrositeState } from '@ai-campaign-builder/api-client'
import type { MicrositeState } from '@ai-campaign-builder/api-client'
import { MICROSITE_DOMAIN, validateMicrositeSlug } from '@ai-campaign-builder/shared-config'
import apiClient from '../../lib/api-client'

/**
 * Business microsite module toggles (plan.md "Business microsite scope") — modular sections,
 * AI-set display order, no reordering/free-form layout (owner can only enable/disable).
 * TODO: wire to PATCH /business_microsite_modules once backend exists.
 */
export function MicrositeBuilderTab() {
  const [state, setState] = useState<MicrositeState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
          setError(err instanceof Error ? err.message : String(err))
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
