import { useEffect, useState } from 'react'
import { Badge, Button, Card, useToast } from '@ai-campaign-builder/ui-kit'
import { getAutopilotState, updateAutopilotState } from '@ai-campaign-builder/api-client'
import type { AutopilotState } from '@ai-campaign-builder/api-client'
import apiClient from '../../lib/api-client'

/**
 * Phase 4 opt-in autopilot (plan.md) — toggle only appears/enables once
 * manualApplyCount >= eligibilityThreshold (3 manual Applies in Phase 3).
 * TODO: wire to PATCH /businesses/:id (autopilot_enabled) once backend exists.
 */
export function AutopilotTab() {
  const [state, setState] = useState<AutopilotState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const { show } = useToast()

  useEffect(() => {
    let mounted = true
    getAutopilotState(apiClient)
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

  if (loading) {
    return <div className="p-4 text-sm text-slate-400">در حال بارگذاری...</div>
  }

  if (error) {
    return <div className="p-4 text-sm text-red-400">{error}</div>
  }

  if (!state) {
    return null
  }

  const eligible = state.manualApplyCount >= state.eligibilityThreshold

  if (!eligible) {
    return (
      <Card className="p-5">
        <p className="text-sm text-slate-300">
          خودکارسازی پس از {state.eligibilityThreshold} بار اعمال دستی پیشنهاد در دسترس قرار می‌گیرد.
        </p>
        <p className="text-xs text-slate-500 mt-1">
          تا الان {state.manualApplyCount} از {state.eligibilityThreshold} مورد اعمال شده.
        </p>
      </Card>
    )
  }

  const handleToggle = async () => {
    const newValue = !state.enabled
    setActionError(null)
    try {
      const updated = await updateAutopilotState(apiClient, { enabled: newValue })
      setState(updated)
      show(newValue ? 'خودکارسازی فعال شد' : 'خودکارسازی غیرفعال شد', 'info')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setActionError(msg)
    }
  }

  return (
    <Card className="p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">خودکارسازی تغییرات کم‌ریسک</p>
          <p className="text-xs text-slate-400 mt-1">
            فقط امتیاز تسک، آستانه جایزه و مدت کمپین به‌صورت خودکار تغییر می‌کند — همیشه با امکان بازگردانی (Undo).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={state.enabled ? 'success' : 'neutral'}>{state.enabled ? 'فعال' : 'غیرفعال'}</Badge>
          <Button
            variant={state.enabled ? 'ghost' : 'primary'}
            aria-pressed={state.enabled}
            onClick={handleToggle}
          >
            {state.enabled ? 'غیرفعال کردن' : 'فعال کردن'}
          </Button>
        </div>
      </div>
      {actionError && (
        <p className="text-xs text-red-400">{actionError}</p>
      )}
    </Card>
  )
}
