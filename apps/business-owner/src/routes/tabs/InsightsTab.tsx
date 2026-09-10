import { useEffect, useState } from 'react'
import { Badge, Card } from '@ai-campaign-builder/ui-kit'
import { getInsights } from '@ai-campaign-builder/api-client'
import type { Insight } from '@ai-campaign-builder/api-client'
import apiClient from '../../lib/api-client'

const cadenceLabel = { daily: 'روزانه', weekly: 'هفتگی', anomaly: 'هشدار فوری' } as const

/** Read-only insight cards */
export function InsightsTab() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    getInsights(apiClient)
      .then((data) => {
        if (mounted) {
          setInsights(data)
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
