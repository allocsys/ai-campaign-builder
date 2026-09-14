import { useEffect, useState } from 'react'
import { Badge, Button, Card, Modal, useToast } from '@ai-campaign-builder/ui-kit'
import type { AdminCustomerListItem } from '@ai-campaign-builder/api-client'
import { AdminAppShell } from './AdminAppShell'
import { getAdminCustomers, deleteAdminCustomer } from '../lib/admin-api-client'

/**
 * Admin customers page. Customers are global records (not business-scoped,
 * see AdminCustomerListItem's doc comment), so this is a flat list rather
 * than nested under a business like staff/microsite deletion is. Deleting a
 * customer cascades through every customer_campaign_codes row they have
 * across every business/campaign they've joined -- see
 * deleteCustomerCompletely on the backend for the full cascade. Irreversible,
 * confirmed via the modal below before it ever runs, same contract as the
 * campaign/business/microsite deletes on the campaigns page.
 */
export function AdminCustomersHome() {
  const { show } = useToast()

  const [customers, setCustomers] = useState<AdminCustomerListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [pendingDelete, setPendingDelete] = useState<AdminCustomerListItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let mounted = true
    getAdminCustomers()
      .then((data) => {
        if (mounted) {
          setCustomers(data)
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

  async function handleDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await deleteAdminCustomer(pendingDelete.id)
      setCustomers((prev) => prev.filter((c) => c.id !== pendingDelete.id))
      show('مشتری برای همیشه حذف شد.', 'success')
      setPendingDelete(null)
    } catch (err) {
      show(err instanceof Error ? err.message : String(err), 'danger')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <AdminAppShell title="مشتریان">
        <div className="p-6 text-sm text-slate-400">در حال بارگذاری...</div>
      </AdminAppShell>
    )
  }
  if (error) {
    return (
      <AdminAppShell title="مشتریان">
        <div className="p-6 text-sm text-red-400">{error}</div>
      </AdminAppShell>
    )
  }

  return (
    <AdminAppShell title="مشتریان">
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-slate-400 text-sm">فهرست همه مشتریان ثبت‌شده در سیستم</p>
        </div>

        {customers.length === 0 ? (
          <Card className="p-5 text-center text-sm text-slate-400">هیچ مشتری‌ای ثبت نشده است.</Card>
        ) : (
          <div className="flex flex-col gap-3">
            {customers.map((c) => (
              <Card key={c.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span dir="ltr" className="text-sm font-medium text-slate-100">
                      {c.phoneNumber}
                    </span>
                    {c.phoneVerified && <Badge tone="success">تأییدشده</Badge>}
                    {c.telegramOptedIn && <Badge tone="brand">تلگرام</Badge>}
                  </div>
                  <span className="text-xs text-slate-500">عضویت: {c.createdAt}</span>
                </div>
                <Button variant="danger" onClick={() => setPendingDelete(c)}>
                  حذف
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={pendingDelete !== null}
        onClose={() => (deleting ? undefined : setPendingDelete(null))}
        title="حذف مشتری"
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-300">
            مشتری <span dir="ltr" className="font-medium text-slate-100">{pendingDelete?.phoneNumber}</span> همراه با
            تمام کدهای عضویت، ثبت‌های تسک، جوایز دریافت‌شده و امتیازهای مربوط به او در همه کسب‌وکارها برای همیشه حذف
            می‌شود. این عملیات <span className="font-medium text-red-400">غیرقابل بازگشت</span> است.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setPendingDelete(null)} disabled={deleting}>
              انصراف
            </Button>
            <Button type="button" variant="danger" loading={deleting} onClick={handleDelete}>
              بله، برای همیشه حذف شود
            </Button>
          </div>
        </div>
      </Modal>
    </AdminAppShell>
  )
}
