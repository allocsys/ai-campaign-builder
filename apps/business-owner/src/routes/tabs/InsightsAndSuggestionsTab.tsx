import { useState } from 'react'
import { Badge } from '@ai-campaign-builder/ui-kit'
import { InsightsTab } from './InsightsTab'
import { SuggestionsTab } from './SuggestionsTab'

/**
 * Merged Insights and Suggestions view ("AI told me something" surfaces)
 * per design.md IA table for /dashboard/insights.
 *
 * design.md also calls for a badge on this section itself (not just the
 * Bottom Nav icon) so the user notices new suggestions while already on the
 * page. SuggestionsTab owns the fetch/apply/dismiss state, so it reports its
 * live pending count back up via onPendingCountChange.
 */
export function InsightsAndSuggestionsTab() {
  const [pendingCount, setPendingCount] = useState(0)

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-slate-100">تحلیل‌های هوشمند</h2>
        <InsightsTab />
      </section>

      <hr className="border-glass-border" />

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-100">پیشنهادهای بهبود کمپین</h2>
          {pendingCount > 0 && (
            <Badge tone="warning" className="text-[11px] px-2 py-0.5">
              {pendingCount > 99 ? '99+' : pendingCount}
            </Badge>
          )}
        </div>
        <SuggestionsTab onPendingCountChange={setPendingCount} />
      </section>
    </div>
  )
}
