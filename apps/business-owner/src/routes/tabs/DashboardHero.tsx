import { Badge, Card } from '@ai-campaign-builder/ui-kit'
import type { Campaign, BusinessProfile } from '@ai-campaign-builder/api-client'

const statusTone = { active: 'success', draft: 'neutral', ended: 'danger' } as const
const statusLabel = { active: 'فعال', draft: 'پیش‌نویس', ended: 'پایان‌یافته' } as const
const goalLabel = {
  acquisition: 'جذب مشتری جدید',
  retention: 'حفظ مشتریان قبلی',
  acquisition_retention: 'جذب و حفظ (ترکیبی)',
} as const

function faDigits(n: number | string): string {
  const map: Record<string, string> = { '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴', '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹' }
  return String(n).replace(/[0-9]/g, (d) => map[d])
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric' }).format(new Date(iso))
  } catch {
    return iso
  }
}

function computeProgress(startDate: string, endDate: string): { pct: number; daysLeft: number } | null {
  if (!startDate || !endDate) return null
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null
  const now = Date.now()
  const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
  const daysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)))
  return { pct, daysLeft }
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: 'brand' | 'success' | 'warning' }) {
  const toneClasses = {
    brand: 'text-brand-400',
    success: 'text-emerald-300',
    warning: 'text-amber-300',
  } as const
  return (
    <div className="flex flex-col gap-0.5 min-w-[92px]">
      <span className={`text-lg font-bold ${toneClasses[tone]}`}>{value}</span>
      <span className="text-[11px] text-slate-400">{label}</span>
    </div>
  )
}

export function DashboardHero({
  campaign,
  profile,
}: {
  campaign: Campaign
  profile: BusinessProfile | null
}) {
  const progress = campaign.status === 'active' ? computeProgress(campaign.startDate, campaign.endDate) : null

  return (
    <Card className="p-6 flex flex-col gap-5 bg-gradient-to-b from-glass-light to-glass-dark border-brand-500/30 shadow-lg shadow-brand-500/5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          {profile && <p className="text-xs font-medium text-brand-400">{profile.categoryLabel}</p>}
          <h1 className="text-xl font-extrabold text-slate-100 tracking-tight">{profile?.name ?? 'کمپین فعلی'}</h1>
          <p className="text-xs text-slate-400">
            {formatDate(campaign.startDate)} تا {formatDate(campaign.endDate)}
          </p>
        </div>
        <Badge tone={statusTone[campaign.status]} className="shrink-0 text-xs px-2.5 py-1">
          {statusLabel[campaign.status]}
        </Badge>
      </div>

      <div className="flex items-center gap-6 pt-3 border-t border-glass-border">
        <MiniStat label="هدف کمپین" value={goalLabel[campaign.goal]} tone="brand" />
        <MiniStat label="تسک‌های فعال" value={faDigits(campaign.tasks.length)} tone="warning" />
      </div>

      {progress && (
        <div className="flex flex-col gap-2 pt-1">
          <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-l from-brand-500 to-brand-400 transition-all shadow-sm"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
            <span>{faDigits(Math.round(progress.pct))}٪ سپری شده</span>
            <span>{faDigits(progress.daysLeft)} روز باقی‌مانده</span>
          </div>
        </div>
      )}
    </Card>
  )
}
