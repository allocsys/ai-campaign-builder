import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card } from '@ai-campaign-builder/ui-kit'
import { getCampaignSummaries } from '@ai-campaign-builder/api-client'
import type { CampaignSummary } from '@ai-campaign-builder/api-client'
import apiClient from '../../lib/api-client'

/** Persian digits -- matches the rest of the app's locale conventions. */
function faDigits(n: number | string): string {
  const map: Record<string, string> = { '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴', '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹' }
  return String(n).replace(/[0-9]/g, (d) => map[d])
}

// Same label/tone conventions as review-console's AdminCampaignsHome, so a
// campaign's status/goal reads identically for an owner and an admin.
const GOAL_LABELS_FA: Record<CampaignSummary['goal'], string> = {
  acquisition: 'جذب مشتری جدید',
  retention: 'حفظ و سفارش مجدد مشتریان',
  acquisition_retention: 'جذب و نگه‌داشتن مشتری',
}
const STATUS_TONE: Record<CampaignSummary['status'], 'success' | 'neutral' | 'warning'> = {
  active: 'success',
  draft: 'neutral',
  ended: 'warning',
}
const STATUS_LABELS_FA: Record<CampaignSummary['status'], string> = {
  active: 'فعال',
  draft: 'پیش‌نویس',
  ended: 'پایان‌یافته',
}

function formatDate(iso: string): string {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso))
  } catch {
    return iso
  }
}

/**
 * Campaign list page (plan.md Item 21) -- what the bottom-nav "کمپین" tab
 * now points at unconditionally (see AppShell/BottomNav), replacing the old
 * either-wizard-or-editor branch that used to live there. Lists every
 * campaign this business has ever created (GET /campaigns, newest-first
 * with the active one pinned to the top -- see listCampaignsForBusiness on
 * the backend) and offers a single "ایجاد کمپین" entry point into the wizard
 * (`/dashboard/campaign/new`, mode="new") for starting another one.
 *
 * A business with zero campaigns still sees this page (empty state below)
 * if they navigate here directly -- DashboardIndexRoute's own from-scratch
 * cover card sends a brand-new business straight to `/dashboard/campaign/new`
 * instead, so in practice this empty state is mostly reachable via the nav
 * tab right after that very first campaign's wizard flow is abandoned
 * midway, or if an owner later deletes/never finishes a subsequent one.
 */
export function CampaignListTab() {
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    getCampaignSummaries(apiClient)
      .then((data) => {
        if (mounted) setCampaigns(data)
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      mounted = false
    }
  }, [])

  if (error) {
    return <div className="p-4 text-sm text-red-400">{error}</div>
  }
  if (campaigns === null) {
    return <div className="p-4 text-sm text-slate-400">در حال بارگذاری...</div>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-100">کمپین‌ها</h2>
        <Button onClick={() => navigate('/dashboard/campaign/new')}>+ ایجاد کمپین</Button>
      </div>

      {campaigns.length === 0 ? (
        <Card className="p-6 flex flex-col items-center gap-3 text-center">
          <span className="text-2xl" aria-hidden="true">
            ✨
          </span>
          <p className="text-sm text-slate-400">
            هنوز کمپینی نساخته‌اید. با دستیار هوشمند اولین کمپین خود را در چند دقیقه بسازید.
          </p>
          <Button onClick={() => navigate('/dashboard/campaign/new')} className="w-full justify-center">
            ساخت کمپین با دستیار هوشمند
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {campaigns.map((c) => (
            <Card
              key={c.id}
              className="p-4 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => navigate(`/dashboard/campaign/${c.id}`)}
            >
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-100 truncate">{GOAL_LABELS_FA[c.goal]}</span>
                  <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABELS_FA[c.status]}</Badge>
                </div>
                {(c.startDate || c.endDate) && (
                  <p className="text-[11px] text-slate-400 truncate">
                    {faDigits(formatDate(c.startDate))}
                    {c.endDate ? ` تا ${faDigits(formatDate(c.endDate))}` : ''}
                  </p>
                )}
              </div>
              <span className="text-slate-500 shrink-0" aria-hidden="true">
                ‹
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
