import { useEffect, useState } from 'react'
import { Badge, Card } from '@ai-campaign-builder/ui-kit'
import { getCampaign, getBusinessProfile, getBusinessStats } from '@ai-campaign-builder/api-client'
import type { Campaign, BusinessProfile, BusinessStats } from '@ai-campaign-builder/api-client'
import apiClient from '../../lib/api-client'
import { DashboardHero } from './DashboardHero'

/** Persian digits for numbers shown in the UI — matches the rest of the app's locale conventions. */
function faDigits(n: number | string): string {
  const map: Record<string, string> = { '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴', '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹' }
  return String(n).replace(/[0-9]/g, (d) => map[d])
}

const statToneClasses = {
  brand: 'bg-brand-500/15 text-brand-400',
  success: 'bg-emerald-500/15 text-emerald-300',
  warning: 'bg-amber-500/15 text-amber-300',
  neutral: 'bg-white/10 text-slate-200',
} as const

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: keyof typeof statToneClasses
}) {
  return (
    <Card className="p-4 flex flex-col gap-2">
      <span className={`inline-flex w-fit items-center justify-center rounded-full px-2 py-1 text-[11px] font-semibold ${statToneClasses[tone]}`}>
        {label}
      </span>
      <span className="text-xl font-bold text-slate-100">{value}</span>
    </Card>
  )
}

/** Active campaign summary — page-level hero, overview stats, tasks + rewards. */
export function DashboardTab() {
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [profile, setProfile] = useState<BusinessProfile | null>(null)
  const [stats, setStats] = useState<BusinessStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    Promise.all([getCampaign(apiClient), getBusinessProfile(apiClient)])
      .then(([campaignData, profileData]) => {
        if (mounted) {
          setCampaign(campaignData)
          setProfile(profileData)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      })
    getBusinessStats(apiClient)
      .then((data) => {
        if (mounted) setStats(data)
      })
      .catch(() => {
        if (mounted) setStats(null)
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

  const sortedRewards = [...campaign.rewards].sort((a, b) => a.threshold - b.threshold)

  return (
    <div className="flex flex-col gap-6">
      {/* Page-level Hero */}
      <DashboardHero campaign={campaign} profile={profile} />

      {/* Divider separating hero from remaining content */}
      <hr className="border-glass-border my-1" />

      {/* Overview stats -- only rendered once /business/stats exists and responds */}
      {stats && (
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3">نمای کلی عملکرد</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard label="اعضای کل باشگاه" value={faDigits(stats.totalMembers)} tone="brand" />
            <StatCard label="امتیاز اعطا شده" value={faDigits(stats.totalPointsIssued)} tone="success" />
            <StatCard label="پاداش‌های تحویل شده" value={faDigits(stats.rewardsRedeemed)} tone="warning" />
            <StatCard label="نرخ تبدیل مراجعین" value={`${faDigits(stats.conversionRatePercent)}٪`} tone="neutral" />
          </div>
        </div>
      )}

      {/* Tasks */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-300">تسک‌های کمپین</h3>
          <Badge tone="neutral">{faDigits(campaign.tasks.length)} تسک</Badge>
        </div>
        <div className="flex flex-col gap-2">
          {campaign.tasks.length === 0 && (
            <Card className="p-4 text-sm text-slate-400 text-center">هنوز تسکی تعریف نشده است.</Card>
          )}
          {campaign.tasks.map((t) => (
            <Card key={t.name} className="p-0 overflow-hidden">
              <div className="flex items-center gap-3 p-3.5">
                <div className="w-1 self-stretch rounded-full bg-brand-500/50 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">{t.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{t.pattern}</p>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-base font-bold text-brand-400">{faDigits(t.points)}</span>
                  <span className="text-[10px] text-slate-400">امتیاز</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Rewards */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-300">جوایز</h3>
          <Badge tone="neutral">{faDigits(sortedRewards.length)} سطح</Badge>
        </div>
        <div className="flex flex-col gap-2">
          {sortedRewards.length === 0 && (
            <Card className="p-4 text-sm text-slate-400 text-center">هنوز جایزه‌ای تعریف نشده است.</Card>
          )}
          {sortedRewards.map((r, i) => (
            <Card key={r.name} className="p-3.5 flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold shrink-0">
                {faDigits(i + 1)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-100 truncate">{r.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{r.pattern}</p>
              </div>
              <Badge tone="warning" className="shrink-0">{faDigits(r.threshold)}+ امتیاز</Badge>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
