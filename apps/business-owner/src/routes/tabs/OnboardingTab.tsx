import { useEffect, useState } from 'react'
import { Badge, Card } from '@ai-campaign-builder/ui-kit'
import { getChecklist } from '@ai-campaign-builder/api-client'
import type { ChecklistItem } from '@ai-campaign-builder/api-client'
import apiClient from '../../lib/api-client'

/**
 * "Next Steps" checklist (plan.md "Post-launch guidance", decided 2026-09-08) — auto-hides
 * once every item is complete.
 */
export function OnboardingTab() {
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    getChecklist(apiClient)
      .then((data) => {
        if (mounted) {
          setChecklistItems(data)
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

  const allDone = checklistItems.every((i) => i.completed)
  if (allDone) {
    return <p className="text-sm text-slate-400">همه مراحل تکمیل شده‌اند <span aria-hidden="true">✅</span></p>
  }
  return (
    <div className="flex flex-col gap-3">
      {checklistItems.map((item) => (
        <Card key={item.key} className="flex items-center justify-between p-4">
          <span className="text-sm">{item.label}</span>
          <Badge tone={item.completed ? 'success' : 'neutral'}>{item.completed ? 'انجام شد' : 'باقی‌مانده'}</Badge>
        </Card>
      ))}
    </div>
  )
}
