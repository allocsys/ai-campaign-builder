import { useEffect, useState } from 'react'
import { Badge, Card } from '@ai-campaign-builder/ui-kit'
import { getCampaign } from '@ai-campaign-builder/api-client'
import type { Campaign } from '@ai-campaign-builder/api-client'
import apiClient from '../../lib/api-client'

const statusTone = { active: 'success', draft: 'neutral', ended: 'danger' } as const
const statusLabel = { active: 'فعال', draft: 'پیش‌نویس', ended: 'پایان‌یافته' } as const

/** Active campaign summary — tasks + rewards. */
export function DashboardTab() {
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    getCampaign(apiClient)
      .then((data) => {
        if (mounted) {
          setCampaign(data)
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

  if (!campaign) {
    return null
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">کمپین فعلی</p>
          <p className="font-semibold">{campaign.startDate} تا {campaign.endDate}</p>
        </div>
        <Badge tone={statusTone[campaign.status]}>{statusLabel[campaign.status]}</Badge>
      </Card>

      <div>
        <h3 className="text-sm font-semibold mb-2 text-slate-300">تسک‌ها</h3>
        <div className="flex flex-col gap-2">
          {campaign.tasks.map((t) => (
            <Card key={t.name} className="flex items-center justify-between p-3.5">
              <span className="text-sm">{t.name}</span>
              <Badge tone="brand">{t.points} امتیاز</Badge>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2 text-slate-300">جوایز</h3>
        <div className="flex flex-col gap-2">
          {campaign.rewards.map((r) => (
            <Card key={r.name} className="flex items-center justify-between p-3.5">
              <span className="text-sm">{r.name}</span>
              <Badge>{r.threshold}+ امتیاز</Badge>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
