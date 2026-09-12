import { useEffect, useState } from 'react'
import { Card } from '@ai-campaign-builder/ui-kit'
import { getChecklist } from '@ai-campaign-builder/api-client'
import type { ChecklistItem } from '@ai-campaign-builder/api-client'
import apiClient from '../lib/api-client'

/**
 * Small "next steps" nudge (plan.md "Post-launch guidance", decided
 * 2026-09-08 -- simplified from a standalone accordion section to a compact
 * banner per user request 2026-09-12). Rendered above the main Accordion in
 * BusinessOwnerHome, not as one of its panels.
 *
 * Renders nothing (not even a placeholder) while loading, on fetch failure,
 * or once every checklist item is complete -- the common steady-state for an
 * already-onboarded business should show no trace of this component at all.
 */
export function OnboardingBanner() {
  const [pendingItems, setPendingItems] = useState<ChecklistItem[] | null>(null)

  useEffect(() => {
    let mounted = true
    getChecklist(apiClient)
      .then((data) => {
        if (mounted) setPendingItems(data.filter((item) => !item.completed))
      })
      .catch(() => {
        // Silent failure, same pattern as DashboardTab's stats fetch: a
        // broken checklist call just means no banner, never a page error.
      })
    return () => {
      mounted = false
    }
  }, [])

  if (!pendingItems || pendingItems.length === 0) return null

  return (
    <Card className="!p-3 mb-4 flex items-center gap-2 text-sm text-slate-300">
      <span aria-hidden="true">💡</span>
      <span>مراحل باقی‌مانده برای شروع: {pendingItems.map((item) => item.label).join('، ')}</span>
    </Card>
  )
}
