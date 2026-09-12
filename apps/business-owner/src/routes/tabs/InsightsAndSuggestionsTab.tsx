import { InsightsTab } from './InsightsTab'
import { SuggestionsTab } from './SuggestionsTab'

/**
 * Merged Insights and Suggestions view ("AI told me something" surfaces)
 * per design.md IA table for /dashboard/insights.
 */
export function InsightsAndSuggestionsTab() {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-slate-100">تحلیل‌های هوشمند</h2>
        <InsightsTab />
      </section>

      <hr className="border-glass-border" />

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-slate-100">پیشنهادهای بهبود کمپین</h2>
        <SuggestionsTab />
      </section>
    </div>
  )
}
