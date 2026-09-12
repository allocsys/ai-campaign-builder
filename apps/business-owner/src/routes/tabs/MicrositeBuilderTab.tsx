import { useEffect, useState } from 'react'
import { Badge, Button, Card } from '@ai-campaign-builder/ui-kit'
import { getMicrositeState, updateMicrositeState } from '@ai-campaign-builder/api-client'
import type { MicrositeState } from '@ai-campaign-builder/api-client'
import { MICROSITE_DOMAIN } from '@ai-campaign-builder/shared-config'
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
            <p className="text-xs text-slate-500 mt-0.5" dir="ltr">
              {state.subdomainSlug}.{MICROSITE_DOMAIN}
            </p>
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
