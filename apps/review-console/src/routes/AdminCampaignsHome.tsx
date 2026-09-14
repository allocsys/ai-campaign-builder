import { useEffect, useState } from 'react'
import { Badge, Button, Card, Modal, useToast } from '@ai-campaign-builder/ui-kit'
import { CampaignEditor } from '@ai-campaign-builder/campaign-editor'
import type { AdminBusinessListItem, Campaign, StaffMember } from '@ai-campaign-builder/api-client'
import { AdminAppShell } from './AdminAppShell'
import {
  getAdminBusinesses,
  getAdminBusinessCampaign,
  updateAdminBusinessCampaign,
  deleteAdminBusinessCampaign,
  updateAdminBusinessManualEditor,
  getAdminBusinessStaff,
  deleteAdminStaff,
  deleteAdminMicrosite,
  deleteAdminBusiness,
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
  const [pausing, setPausing] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [staffError, setStaffError] = useState<string | null>(null)
  const [deletingStaffId, setDeletingStaffId] = useState<string | null>(null)

  const [micrositeModalOpen, setMicrositeModalOpen] = useState(false)
  const [deletingMicrosite, setDeletingMicrosite] = useState(false)

  const [businessDeleteModalOpen, setBusinessDeleteModalOpen] = useState(false)
  const [deletingBusiness, setDeletingBusiness] = useState(false)

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

    setStaff([])
    setStaffError(null)
    setLoadingStaff(true)
    getAdminBusinessStaff(b.id)
      .then((rows) => setStaff(rows))
      .catch((err) => setStaffError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoadingStaff(false))
  }

  function backToList() {
    setSelected(null)
    setCampaign(null)
    setCampaignError(null)
    setDeleteModalOpen(false)
    setStaff([])
    setStaffError(null)
    setMicrositeModalOpen(false)
    setBusinessDeleteModalOpen(false)
  }

  // "Pause" reuses the plain status field -- no separate DB concept, no
  // separate endpoint, just the same PUT /campaign the manual editor already
  // uses (see plan.md decision: pause = status -> 'draft').
  async function handlePause() {
    if (!selected || !campaign) return
    setPausing(true)
    try {
      const updated = await updateAdminBusinessCampaign(selected.id, { status: 'draft' })
      setCampaign(updated)
      show('کمپین موقتاً متوقف شد (به حالت پیش‌نویس بازگشت).', 'success')
    } catch (err) {
      show(err instanceof Error ? err.message : String(err), 'danger')
    } finally {
      setPausing(false)
    }
  }

  // Irreversible hard delete -- see deleteCampaignForBusiness on the backend
  // for the full cascade (customer codes, submissions, redemptions, points,
  // etc. all go with it). Confirmed via the modal below before this ever runs.
  async function handleDeleteCampaign() {
    if (!selected) return
    setDeleting(true)
    try {
      await deleteAdminBusinessCampaign(selected.id)
      show('کمپین برای همیشه حذف شد.', 'success')
      backToList()
    } catch (err) {
      show(err instanceof Error ? err.message : String(err), 'danger')
    } finally {
      setDeleting(false)
    }
  }

  // Staff rows have no children referencing them -- a plain delete on the
  // backend, scoped to this business so an id from a different business
  // can't be deleted by mistake.
  async function handleDeleteStaff(staffId: string) {
    if (!selected) return
    setDeletingStaffId(staffId)
    try {
      await deleteAdminStaff(selected.id, staffId)
      setStaff((prev) => prev.filter((s) => s.id !== staffId))
      show('عضو تیم حذف شد.', 'success')
    } catch (err) {
      show(err instanceof Error ? err.message : String(err), 'danger')
    } finally {
      setDeletingStaffId(null)
    }
  }

  // Irreversible: removes the business's published microsite + its modules.
  async function handleDeleteMicrosite() {
    if (!selected) return
    setDeletingMicrosite(true)
    try {
      await deleteAdminMicrosite(selected.id)
      show('سایت اختصاصی این کسب‌وکار برای همیشه حذف شد.', 'success')
      setMicrositeModalOpen(false)
    } catch (err) {
      show(err instanceof Error ? err.message : String(err), 'danger')
    } finally {
      setDeletingMicrosite(false)
    }
  }

  // The most destructive action in the admin panel -- removes the business
  // owner entirely: every campaign, staff member, microsite, subscription,
  // SMS wallet history, and everything else tied to business_id. See
  // deleteBusinessCompletely on the backend for the full cascade.
  async function handleDeleteBusiness() {
    if (!selected) return
    setDeletingBusiness(true)
    try {
      await deleteAdminBusiness(selected.id)
      setBusinesses((prev) => prev.filter((x) => x.id !== selected.id))
      show('کسب‌وکار برای همیشه حذف شد.', 'success')
      backToList()
    } catch (err) {
      show(err instanceof Error ? err.message : String(err), 'danger')
    } finally {
      setDeletingBusiness(false)
    }
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
    return (
      <AdminAppShell title="کمپین‌های کسب‌وکارها">
        <div className="p-6 text-sm text-slate-400">در حال بارگذاری...</div>
      </AdminAppShell>
    )
  }
  if (listError) {
    return (
      <AdminAppShell title="کمپین‌های کسب‌وکارها">
        <div className="p-6 text-sm text-red-400">{listError}</div>
      </AdminAppShell>
    )
  }

  return (
    <AdminAppShell title="کمپین‌های کسب‌وکارها">
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-slate-400 text-sm">مشاهده و ویرایش دستی کمپین هر کسب‌وکار</p>
        </div>

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
              <div className="flex gap-2 flex-wrap">
                <Button variant="danger" onClick={() => setBusinessDeleteModalOpen(true)}>
                  حذف کسب‌وکار
                </Button>
                <Button variant="ghost" onClick={backToList}>
                  ← بازگشت به فهرست
                </Button>
              </div>
            </div>

            <Card className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-sm font-medium text-slate-100">اعضای تیم</h3>
                <Button variant="secondary" onClick={() => setMicrositeModalOpen(true)}>
                  حذف سایت اختصاصی
                </Button>
              </div>
              {loadingStaff && <div className="text-sm text-slate-400">در حال بارگذاری...</div>}
              {staffError && <div className="text-sm text-red-400">{staffError}</div>}
              {!loadingStaff && !staffError && staff.length === 0 && (
                <div className="text-sm text-slate-400">هیچ عضو تیمی برای این کسب‌وکار ثبت نشده است.</div>
              )}
              {staff.length > 0 && (
                <div className="flex flex-col gap-2">
                  {staff.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 flex-wrap text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-200">{s.name}</span>
                        <span dir="ltr" className="text-xs text-slate-400">
                          {s.phone}
                        </span>
                        {!s.active && <Badge tone="neutral">غیرفعال</Badge>}
                      </div>
                      <Button
                        variant="danger"
                        loading={deletingStaffId === s.id}
                        onClick={() => handleDeleteStaff(s.id)}
                      >
                        حذف
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {loadingCampaign && <div className="p-4 text-sm text-slate-400">در حال بارگذاری کمپین...</div>}
            {campaignError && <div className="p-4 text-sm text-red-400">{campaignError}</div>}

            {campaign && (
              <>
                <Card className="p-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Badge tone={STATUS_TONE[campaign.status]}>{STATUS_LABELS_FA[campaign.status]}</Badge>
                    <span className="text-slate-300">{GOAL_LABELS_FA[campaign.goal]}</span>
                    <span className="text-slate-400">ضریب امتیاز: {faDigits(campaign.pointMultiplier)}×</span>
                    <span className="text-slate-400" dir="ltr">
                      {campaign.startDate} → {campaign.endDate}
                    </span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {campaign.status === 'active' && (
                      <Button variant="secondary" loading={pausing} onClick={handlePause}>
                        توقف موقت کمپین
                      </Button>
                    )}
                    <Button variant="danger" onClick={() => setDeleteModalOpen(true)}>
                      حذف کمپین
                    </Button>
                  </div>
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

      <Modal open={deleteModalOpen} onClose={() => (deleting ? undefined : setDeleteModalOpen(false))} title="حذف کمپین">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-300">
            این عملیات کمپین فعلی <span className="font-medium text-slate-100">{selected?.name}</span> را همراه با تمام
            کدهای مشتریان، ثبت‌های تسک، جوایز دریافت‌شده و امتیازهای مربوط به آن برای همیشه حذف می‌کند. این عملیات{' '}
            <span className="font-medium text-red-400">غیرقابل بازگشت</span> است.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>
              انصراف
            </Button>
            <Button type="button" variant="danger" loading={deleting} onClick={handleDeleteCampaign}>
              بله، برای همیشه حذف شود
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={micrositeModalOpen}
        onClose={() => (deletingMicrosite ? undefined : setMicrositeModalOpen(false))}
        title="حذف سایت اختصاصی"
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-300">
            سایت اختصاصی (میکروسایت) کسب‌وکار <span className="font-medium text-slate-100">{selected?.name}</span> برای
            همیشه حذف می‌شود. این عملیات <span className="font-medium text-red-400">غیرقابل بازگشت</span> است.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setMicrositeModalOpen(false)} disabled={deletingMicrosite}>
              انصراف
            </Button>
            <Button type="button" variant="danger" loading={deletingMicrosite} onClick={handleDeleteMicrosite}>
              بله، برای همیشه حذف شود
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={businessDeleteModalOpen}
        onClose={() => (deletingBusiness ? undefined : setBusinessDeleteModalOpen(false))}
        title="حذف کسب‌وکار"
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-300">
            کسب‌وکار <span className="font-medium text-slate-100">{selected?.name}</span> همراه با تمام کمپین‌ها، اعضای
            تیم، سایت اختصاصی، اشتراک، تاریخچه کیف‌پول پیامکی و هر چیز دیگری که به این کسب‌وکار مرتبط است برای همیشه
            حذف می‌شود. این عملیات <span className="font-medium text-red-400">غیرقابل بازگشت</span> است.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setBusinessDeleteModalOpen(false)}
              disabled={deletingBusiness}
            >
              انصراف
            </Button>
            <Button type="button" variant="danger" loading={deletingBusiness} onClick={handleDeleteBusiness}>
              بله، برای همیشه حذف شود
            </Button>
          </div>
        </div>
      </Modal>
    </AdminAppShell>
  )
}
