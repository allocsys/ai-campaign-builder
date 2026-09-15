import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Badge, Button, Card, useToast } from '@ai-campaign-builder/ui-kit'
import {
  getBusinessProfile,
  getCampaignById,
  getCampaignStatsById,
  updateBusinessProfile,
  updateCampaignById,
} from '@ai-campaign-builder/api-client'
import type { BusinessProfile, BusinessStats, Campaign } from '@ai-campaign-builder/api-client'
import { CampaignEditor } from '@ai-campaign-builder/campaign-editor'
import { CampaignChatAssistant } from './CampaignChatAssistant'
import apiClient from '../../lib/api-client'

/** Persian digits -- matches the rest of the app's locale conventions. */
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

function StatCard({ label, value, tone }: { label: string; value: string; tone: keyof typeof statToneClasses }) {
  return (
    <Card className="p-4 flex flex-col gap-2">
      <span className={`inline-flex w-fit items-center justify-center rounded-full px-2 py-1 text-[11px] font-semibold ${statToneClasses[tone]}`}>
        {label}
      </span>
      <span className="text-xl font-bold text-slate-100">{value}</span>
    </Card>
  )
}

/**
 * Thin business-owner wrapper around the shared `CampaignEditor` component
 * (plan.md Item 16 Step G) -- now campaign-scoped (plan.md Item 21) via a
 * `campaignId` route param (`/dashboard/campaign/:campaignId`), reached from
 * the campaign list page (CampaignListTab) rather than from a single fixed
 * route. Fetches this specific campaign (GET /campaigns/:campaignId) and its
 * stats (GET /campaigns/:campaignId/stats) instead of the legacy
 * single-"current"-campaign endpoints, and saves via
 * `updateCampaignById(campaignId, ...)` so an edit always lands on the
 * campaign the owner is actually looking at, not whichever one
 * ensureCampaign's active-then-newest fallback happens to resolve to.
 *
 * `manualEditorEnabled` ("حالت حرفه‌ای") no longer gates ACCESS to this page --
 * any business can open any of its own campaigns here regardless of pro
 * mode. It gates whether `CampaignEditor` below renders editable or
 * read-only (its own `readOnly` prop) -- this is re-checked on every load so
 * a direct URL nav can't grant manual-edit access.
 *
 * Item 21 also dropped the inline `CampaignWizardForm` fallback this file
 * used to render for non-pro owners entirely: `CampaignEditor` already has a
 * `readOnly` display mode (tasks/rewards shown, no editable controls), so
 * pro-mode-off owners still see exactly what's in the campaign, just via the
 * chat assistant below to change it -- there's no "regenerate from scratch"
 * escape hatch on an already-created campaign's own page anymore (that's
 * what `/dashboard/campaign/new` from the list page is for).
 *
 * The top-right pill doubles as the toggle for pro mode itself (added so
 * owners don't have to detour through Settings just to flip it -- same
 * `updateBusinessProfile({ manualEditorEnabled })` call SettingsTab uses).
 *
 * Bug fix (2026-09-15): the design doc's review screen offers exactly one
 * owner action -- Launch -- as a one-time step right after generation
 * (CampaignWizardForm's handleLaunch). That action only ever lived in the
 * wizard's in-memory `proposal` state, so a refresh or navigate-away between
 * "کمپین ساخته شد" and hitting "تایید و راه‌اندازی" orphaned the campaign in
 * `draft` forever -- the row exists (createCampaign already made it) but
 * nothing on this detail page could ever flip it to `active`. Fix is scoped
 * to exactly that: re-expose the same one-directional Launch action here
 * when `campaign.status === 'draft'`, calling the same
 * `updateCampaignById(id, { status: 'active' })` the wizard used. This is
 * NOT a general status toggle -- there's deliberately no way to pause an
 * active campaign back to draft from here, since the design doc never
 * described that as an owner-facing action.
 */
export function CampaignEditorTab() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { show: showToast } = useToast()
  const [profile, setProfile] = useState<BusinessProfile | null>(null)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [stats, setStats] = useState<BusinessStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingManualEditor, setTogglingManualEditor] = useState(false)
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    if (!campaignId) {
      setError('کمپین یافت نشد.')
      setLoading(false)
      return
    }
    let mounted = true
    Promise.all([getBusinessProfile(apiClient), getCampaignById(apiClient, campaignId)])
      .then(([profileData, campaignData]) => {
        if (!mounted) return
        setProfile(profileData)
        setCampaign(campaignData)
        setLoading(false)
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      })
    // Stats are best-effort, same as DashboardTab's own getBusinessStats
    // call -- a failure here shouldn't block the rest of the page.
    getCampaignStatsById(apiClient, campaignId)
      .then((data) => {
        if (mounted) setStats(data)
      })
      .catch(() => {
        if (mounted) setStats(null)
      })
    return () => {
      mounted = false
    }
  }, [campaignId])

  const toggleManualEditor = async () => {
    if (!profile) return
    setTogglingManualEditor(true)
    try {
      const updated = await updateBusinessProfile(apiClient, {
        manualEditorEnabled: !profile.manualEditorEnabled,
      })
      setProfile(updated)
      showToast(
        updated.manualEditorEnabled ? 'حالت حرفه‌ای فعال شد.' : 'حالت حرفه‌ای غیرفعال شد.',
        'success',
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'danger')
    } finally {
      setTogglingManualEditor(false)
    }
  }

  const handleLaunch = async () => {
    if (!campaign || !campaignId) return
    setLaunching(true)
    try {
      const updated = await updateCampaignById(apiClient, campaignId, { status: 'active' })
      setCampaign(updated)
      showToast('کمپین با موفقیت راه‌اندازی شد!', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'danger')
    } finally {
      setLaunching(false)
    }
  }

  if (loading) {
    return <div className="p-4 text-sm text-slate-400">در حال بارگذاری...</div>
  }
  if (error) {
    return <div className="p-4 text-sm text-red-400">{error}</div>
  }
  if (!profile || !campaign || !campaignId) {
    return null
  }

  const readOnly = !profile.manualEditorEnabled

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-100">
          {readOnly ? 'کمپین' : 'ویرایش دستی کمپین'}
        </h2>
        <button
          type="button"
          onClick={toggleManualEditor}
          disabled={togglingManualEditor}
          aria-pressed={!readOnly}
          className="disabled:opacity-60 disabled:cursor-wait"
        >
          <Badge
            tone={readOnly ? 'neutral' : 'brand'}
            className={`cursor-pointer select-none transition-colors ${
              readOnly ? 'hover:bg-white/20' : 'hover:bg-brand-500/25'
            }`}
          >
            {togglingManualEditor
              ? 'در حال تغییر...'
              : readOnly
                ? 'فعال‌سازی حالت حرفه‌ای'
                : 'حالت حرفه‌ای'}
          </Badge>
        </button>
      </div>

      {campaign.status === 'draft' && (
        <Card className="p-4 flex items-center justify-between gap-3 border-2 border-brand-500/40">
          <div>
            <p className="text-sm font-medium">این کمپین هنوز راه‌اندازی نشده</p>
            <p className="text-xs text-slate-400 mt-1">
              کمپین ساخته شده ولی هنوز به عنوان کمپین فعال راه‌اندازی نشده. با زدن دکمه زیر آن را فعال کن.
            </p>
          </div>
          <Button onClick={handleLaunch} loading={launching}>
            🚀 راه‌اندازی کمپین
          </Button>
        </Card>
      )}

      {readOnly ? (
        <p className="text-xs text-slate-400 -mt-2">
          از دستیار هوشمند زیر برای ویرایش این کمپین با زبان طبیعی استفاده کن. برای ویرایش دستی تسک‌ها و پاداش‌ها، روی «فعال‌سازی حالت حرفه‌ای» بالا بزن.
        </p>
      ) : (
        <p className="text-xs text-slate-400 -mt-2">
          تسک‌ها و پاداش‌های این کمپین رو مستقیماً ویرایش کن. تغییرات تا وقتی «ذخیره تغییرات» رو نزنی روی کمپین واقعی اعمال نمی‌شه.
        </p>
      )}

      {/* plan.md Open Item 20 Part B -- shown regardless of pro-mode: an NL
          request is a different way to REACH a suggestion (via the existing
          SuggestionsTab Apply/Dismiss flow), independent of whether this
          owner also has manual field-level editing access below.
          plan.md Item 21 deferred sub-item 2 (closed): the chat backend now
          takes this page's campaignId explicitly instead of resolving via
          ensureCampaign's single-"current"-campaign fallback. */}
      <CampaignChatAssistant campaignId={campaignId} />

      {stats && (
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3">نمای کلی این کمپین</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard label="اعضای کل باشگاه" value={faDigits(stats.totalMembers)} tone="brand" />
            <StatCard label="امتیاز اعطا شده" value={faDigits(stats.totalPointsIssued)} tone="success" />
            <StatCard label="پاداش‌های تحویل شده" value={faDigits(stats.rewardsRedeemed)} tone="warning" />
            <StatCard label="نرخ تبدیل مراجعین" value={`${faDigits(stats.conversionRatePercent)}٪`} tone="neutral" />
          </div>
        </div>
      )}

      <CampaignEditor
        campaign={campaign}
        readOnly={readOnly}
        onSave={(data) => updateCampaignById(apiClient, campaignId, data)}
      />
    </div>
  )
}
