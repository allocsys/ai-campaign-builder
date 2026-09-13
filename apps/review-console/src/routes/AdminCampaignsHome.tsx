import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, useToast } from '@ai-campaign-builder/ui-kit'
import { CampaignEditor } from '@ai-campaign-builder/campaign-editor'
import type { AdminBusinessListItem, Campaign } from '@ai-campaign-builder/api-client'
import {
  getAdminBusinesses,
  getAdminBusinessCampaign,
  updateAdminBusinessCampaign,
  updateAdminBusinessManualEditor,
} from '../lib/admin-api-client'

/** Persian digits -- matches the rest of the app's locale conventions. */
function faDigits(n: number | string): string {
  const map: Record<string, string> = { '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴', '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹' }
  return String(n).replace(/[0-9]/g, (d) => map[d])
}

const GOAL_LABELS_FA: Record<Campaign['goal'], string> = {
  acquisition: 'جذب مشتری جدید',
  retention: 'حفظ و سفارش مجدد مشتریان',
  acquisition_retention: 'جذب و نگه‌داشتن مشتری',
}

const STATUS_TONE: Record<Campaign['status'], 'success' | 'neutral' | 'warning'> = {
  active: 'success',
  draft: 'neutral',
  ended: 'warning',
}
const STATUS_LABELS_FA: Record<Campaign['status'], string> = {
  active: 'فعال',
  draft: 'پیش‌نویس',
  ended: 'پایان‌یافته',
}

/**
 * review_admin's campaign-access surface (plan.md Item 16, Step G). Business
 * picker -> campaign view + the same manual editor business-owner uses
 * (shared `CampaignEditor` from packages/campaign-editor -- see that
 * package's doc comment for the "build once" rationale). Unlike the owner
 * side, admin's editor access is unconditional -- no `manualEditorEnabled`
 * gate check before rendering it, per plan.md's full-access decision. The
 * flag only controls whether *this* admin toggle affects what the owner's
 * own Settings page shows/allows them.
 */
export function AdminCampaignsHome() {
  const { show } = useToast()

  const [businesses, setBusinesses] = useState<AdminBusinessListItem[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [selected, setSelected] = useState<AdminBusinessListItem | null>(null)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loadingCampaign, setLoadingCampaign] = useState(false)
  const [campaignError, setCampaignError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    getAdminBusinesses()
      .then((data) => {
        if (mounted) {
          setBusinesses(data)
          setLoadingList(false)
        }
      })
      .catch((err) => {
        if (mounted) {
          setListError(err instanceof Error ? err.message : String(err))
          setLoadingList(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [])

  function selectBusiness(b: AdminBusinessListItem) {
    setSelected(b)
    setCampaign(null)
    setCampaignError(null)
    setLoadingCampaign(true)
    getAdminBusinessCampaign(b.id)
      .then((c) => setCampaign(c))
      .catch((err) => setCampaignError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoadingCampaign(false))
  }

  function backToList() {
    setSelected(null)
    setCampaign(null)
    setCampaignError(null)
  }

  async function toggleManualEditor(b: AdminBusinessListItem) {
    setTogglingId(b.id)
    try {
      const result = await updateAdminBusinessManualEditor(b.id, !b.manualEditorEnabled)
      setBusinesses((prev) =>
        prev.map((x) => (x.id === b.id ? { ...x, manualEditorEnabled: result.manualEditorEnabled } : x))
      )
      setSelected((prev) => (prev && prev.id === b.id ? { ...prev, manualEditorEnabled: result.manualEditorEnabled } : prev))
      show(
        result.manualEditorEnabled ? 'حالت حرفه‌ای برای این کسب‌وکار فعال شد.' : 'حالت حرفه‌ای برای این کسب‌وکار غیرفعال شد.',
        'success'
      )
    } catch (err) {
      show(err instanceof Error ? err.message : String(err), 'danger')
    } finally {
      setTogglingId(null)
    }
  }

  if (loadingList) {
    return <div className="p-6 text-sm text-slate-400">در حال بارگذاری...</div>
  }
  if (listError) {
    return <div className="p-6 text-sm text-red-400">{listError}</div>
  }

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-bold">
            <span aria-hidden="true">📋</span> کمپین‌های کسب‌وکارها
          </h1>
          <p className="text-slate-400 text-sm mt-1">مشاهده و ویرایش دستی کمپین هر کسب‌وکار</p>
        </div>
        <Link to="/admin" className="text-sm text-brand-400 hover:underline">
          پنل ادمین
        </Link>
      </header>

      {!selected ? (
        businesses.length === 0 ? (
          <Card className="p-5 text-center text-sm text-slate-400">هیچ کسب‌وکاری ثبت نشده است.</Card>
        ) : (
          <div className="flex flex-col gap-3">
            {businesses.map((b) => (
              <Card key={b.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-100 truncate">{b.name}</span>
                    <Badge tone="neutral">{b.categoryLabel}</Badge>
                    {b.manualEditorEnabled && <Badge tone="brand">حالت حرفه‌ای</Badge>}
                  </div>
                  <span dir="ltr" className="text-xs text-slate-400 text-left">
                    {b.phone}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="secondary" loading={togglingId === b.id} onClick={() => toggleManualEditor(b)}>
                    {b.manualEditorEnabled ? 'غیرفعال‌سازی حالت حرفه‌ای' : 'فعال‌سازی حالت حرفه‌ای'}
                  </Button>
                  <Button onClick={() => selectBusiness(b)}>مشاهده کمپین</Button>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-semibold text-slate-100">{selected.name}</h2>
              <p className="text-xs text-slate-400">
                {selected.categoryLabel} · <span dir="ltr">{selected.phone}</span>
              </p>
            </div>
            <Button variant="ghost" onClick={backToList}>
              ← بازگشت به فهرست
            </Button>
          </div>

          {loadingCampaign && <div className="p-4 text-sm text-slate-400">در حال بارگذاری کمپین...</div>}
          {campaignError && <div className="p-4 text-sm text-red-400">{campaignError}</div>}

          {campaign && (
            <>
              <Card className="p-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <Badge tone={STATUS_TONE[campaign.status]}>{STATUS_LABELS_FA[campaign.status]}</Badge>
                <span className="text-slate-300">{GOAL_LABELS_FA[campaign.goal]}</span>
                <span className="text-slate-400">ضریب امتیاز: {faDigits(campaign.pointMultiplier)}×</span>
                <span className="text-slate-400" dir="ltr">
                  {campaign.startDate} → {campaign.endDate}
                </span>
              </Card>

              <CampaignEditor
                key={selected.id}
                campaign={campaign}
                onSave={(data) => updateAdminBusinessCampaign(selected.id, data)}
                onSaved={(updated) => setCampaign(updated)}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
