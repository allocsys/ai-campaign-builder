import { useEffect, useState, type FormEvent } from 'react'
import { Badge, Button, Card, Input } from '@ai-campaign-builder/ui-kit'
import { getStaff, addStaff, updateStaff } from '@ai-campaign-builder/api-client'
import type { StaffMember } from '@ai-campaign-builder/api-client'
import apiClient from '../../lib/api-client'

/**
 * Staff management tab — lets business owners register staff phone numbers
 * for the staff-pos app and toggle their active status.
 */
export function StaffTab() {
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    getStaff(apiClient)
      .then((data) => {
        if (mounted) {
          setStaffList(data)
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

  const handleAddStaff = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) {
      setFormError('لطفاً نام و شماره موبایل را وارد کنید.')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const newMember = await addStaff(apiClient, { name: name.trim(), phone: phone.trim() })
      setStaffList((prev) => [...prev, newMember])
      setName('')
      setPhone('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (member: StaffMember) => {
    setTogglingId(member.id)
    setError(null)
    try {
      const updated = await updateStaff(apiClient, member.id, { active: !member.active })
      setStaffList((prev) => prev.map((s) => (s.id === member.id ? updated : s)))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setTogglingId(null)
    }
  }

  if (loading) {
    return <div className="p-4 text-sm text-slate-400">در حال بارگذاری...</div>
  }

  if (error && staffList.length === 0) {
    return <div className="p-4 text-sm text-red-400">{error}</div>
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3 text-slate-300">افزودن عضو جدید به کارکنان</h3>
        <form onSubmit={handleAddStaff} className="flex flex-col gap-3">
          <Input
            label="نام"
            placeholder="مثال: علی رضایی"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="شماره موبایل (اپلیکیشن صندوق‌دار)"
            placeholder="09123456789"
            dir="ltr"
            className="text-left"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {formError && <p className="text-xs text-red-400">{formError}</p>}
          <div className="flex justify-end pt-1">
            <Button type="submit" loading={submitting}>
              افزودن
            </Button>
          </div>
        </form>
      </Card>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-300 px-1">لیست کارکنان ({staffList.length.toLocaleString('fa-IR')})</h3>
        {staffList.length === 0 ? (
          <Card className="p-5 text-center text-sm text-slate-400">
            هنوز هیچ عضوی به کارکنان اضافه نشده است.
          </Card>
        ) : (
          staffList.map((member) => (
            <Card key={member.id} className="p-4 flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-100 truncate">{member.name}</span>
                  <Badge tone={member.active ? 'success' : 'neutral'}>
                    {member.active ? 'فعال' : 'غیرفعال'}
                  </Badge>
                  {member.phoneVerified && (
                    <Badge tone="success">تأییدشده</Badge>
                  )}
                </div>
                <span dir="ltr" className="text-xs text-slate-400 text-left">
                  {member.phone}
                </span>
              </div>
              <Button
                variant="secondary"
                loading={togglingId === member.id}
                onClick={() => handleToggleActive(member)}
              >
                {member.active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
              </Button>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
