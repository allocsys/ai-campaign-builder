import { Badge, Card } from '@ai-campaign-builder/ui-kit'
import { insights } from '../../lib/mock-data'

const cadenceLabel = { daily: 'روزانه', weekly: 'هفتگی', anomaly: 'هشدار فوری' } as const

/** Read-only insight cards (plan.md Phase 2 — no autopilot here). TODO: replace with GET /insights?campaign_id=. */
export function InsightsTab() {
  if (insights.length === 0) {
    return <p className="text-sm text-slate-400">هنوز داده‌ای برای تحلیل جمع‌آوری نشده است.</p>
  }
  return (
    <div className="flex flex-col gap-3">
      {insights.map((i) => (
        <Card key={i.id} className="p-4 flex items-start justify-between gap-3">
          <p className="text-sm">{i.message}</p>
          <Badge tone="neutral" className="shrink-0">
            {cadenceLabel[i.cadence]}
          </Badge>
        </Card>
      ))}
    </div>
  )
}
