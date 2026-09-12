import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Input, Modal, useToast } from '@ai-campaign-builder/ui-kit'
import type { ReviewAdminAccount, ReviewTeamMember } from '@ai-campaign-builder/api-client'
import { useAdminAuth } from '../lib/admin-auth'
import {
  getReviewTeamMembers,
  addReviewTeamMember,
  updateReviewTeamMember,
  removeReviewTeamMember,
  getReviewAdmins,
  addReviewAdmin,
  removeReviewAdmin,
  changeAdminPassword,
} from '../lib/admin-api-client'

/**
 * Admin management page — lives inside the existing apps/review-console app
 * (not a separate app, per plan.md "Where it lives"), gated by
 * AdminProtectedRoute. Full access: register/deactivate review_team_members
 * (the reviewer roster) and add/remove other review_admins. Root sees the
 * same page as any other admin, except its own "change password" card is
 * replaced with an explanatory note (its password is fixed via env config,
 * see plan.md "Root admin password mutability").
 */
export function AdminHome() {
  const { username, isRoot, logout } = useAdminAuth()
  const { show } = useToast()

  const [members, setMembers] = useState<ReviewTeamMember[]>([])
  const [admins, setAdmins] = useState<ReviewAdminAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add team member form
  const [memberName, setMemberName] = useState('')
  const [memberPhone, setMemberPhone] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [memberFormError, setMemberFormError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Edit team member modal
  const [editingMember, setEditingMember] = useState<ReviewTeamMember | null>(null)
  const [editMemberName, setEditMemberName] = useState('')
  const [editMemberPhone, setEditMemberPhone] = useState('')
  const [editMemberError, setEditMemberError] = useState<string | null>(null)
  const [savingMemberEdit, setSavingMemberEdit] = useState(false)
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null)

  // Add admin form
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [adminFormError, setAdminFormError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  // Self-service password change
  const [pwModalOpen, setPwModalOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [changingPw, setChangingPw] = useState(false)

  useEffect(() => {
    let mounted = true
    Promise.all([getReviewTeamMembers(), getReviewAdmins()])
      .then(([m, a]) => {
        if (mounted) {
          setMembers(m)
          setAdmins(a)
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

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault()
    if (!memberName.trim() || !memberPhone.trim()) {
      setMemberFormError('لطفاً نام و شماره موبایل را وارد کنید.')
      return
    }
    setAddingMember(true)
    setMemberFormError(null)
    try {
      const created = await addReviewTeamMember({ name: memberName.trim(), phone: memberPhone.trim() })
      setMembers((prev) => [...prev, created])
      setMemberName('')
      setMemberPhone('')
      show('عضو تیم مرکزی اضافه شد.', 'success')
    } catch (err) {
      setMemberFormError(err instanceof Error ? err.message : String(err))
    } finally {
      setAddingMember(false)
    }
  }

  const handleToggleMember = async (member: ReviewTeamMember) => {
    setTogglingId(member.id)
    try {
      const updated = await updateReviewTeamMember(member.id, { active: !member.active })
      setMembers((prev) => prev.map((m) => (m.id === member.id ? updated : m)))
    } catch (err) {
      show(err instanceof Error ? err.message : String(err), 'danger')
    } finally {
      setTogglingId(null)
    }
  }

  const openEditMember = (member: ReviewTeamMember) => {
    setEditingMember(member)
    setEditMemberName(member.name)
    setEditMemberPhone(member.phone)
    setEditMemberError(null)
  }

  const handleSaveMemberEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingMember) return
    if (!editMemberName.trim() || !editMemberPhone.trim()) {
      setEditMemberError('لطفاً نام و شماره موبایل را وارد کنید.')
      return
    }
    setSavingMemberEdit(true)
    setEditMemberError(null)
    try {
      const updated = await updateReviewTeamMember(editingMember.id, {
        name: editMemberName.trim(),
        phone: editMemberPhone.trim(),
      })
      setMembers((prev) => prev.map((m) => (m.id === editingMember.id ? updated : m)))
      setEditingMember(null)
      show('اطلاعات عضو به‌روزرسانی شد.', 'success')
    } catch (err) {
      setEditMemberError(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingMemberEdit(false)
    }
  }

  const handleDeleteMember = async (member: ReviewTeamMember) => {
    setDeletingMemberId(member.id)
    try {
      await removeReviewTeamMember(member.id)
      setMembers((prev) => prev.filter((m) => m.id !== member.id))
      show('عضو حذف شد.', 'success')
    } catch (err) {
      show(err instanceof Error ? err.message : String(err), 'danger')
    } finally {
      setDeletingMemberId(null)
    }
  }

  const handleAddAdmin = async (e: FormEvent) => {
    e.preventDefault()
    if (!adminUsername.trim() || adminPassword.length < 8) {
      setAdminFormError('نام کاربری و رمز عبور (حداقل ۸ کاراکتر) را وارد کنید.')
      return
    }
    setAddingAdmin(true)
    setAdminFormError(null)
    try {
      const created = await addReviewAdmin({ username: adminUsername.trim(), password: adminPassword })
      setAdmins((prev) => [...prev, created])
      setAdminUsername('')
      setAdminPassword('')
      show('ادمین جدید اضافه شد. رمز عبور را به او اطلاع دهید.', 'success')
    } catch (err) {
      setAdminFormError(err instanceof Error ? err.message : String(err))
    } finally {
      setAddingAdmin(false)
    }
  }

  const handleRemoveAdmin = async (admin: ReviewAdminAccount) => {
    setRemovingId(admin.id)
    try {
      await removeReviewAdmin(admin.id)
      setAdmins((prev) => prev.filter((a) => a.id !== admin.id))
      show('ادمین حذف شد.', 'success')
    } catch (err) {
      show(err instanceof Error ? err.message : String(err), 'danger')
    } finally {
      setRemovingId(null)
    }
  }

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (!currentPassword || newPassword.length < 8) {
      setPwError('رمز فعلی و رمز جدید (حداقل ۸ کاراکتر) را وارد کنید.')
      return
    }
    setChangingPw(true)
    setPwError(null)
    try {
      await changeAdminPassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setPwModalOpen(false)
      show('رمز عبور با موفقیت تغییر کرد.', 'success')
    } catch (err) {
      setPwError(err instanceof Error ? err.message : String(err))
    } finally {
      setChangingPw(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">در حال بارگذاری...</div>
  }

  if (error && members.length === 0 && admins.length === 0) {
    return <div className="p-6 text-sm text-red-400">{error}</div>
  }

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-bold"><span aria-hidden="true">🔐</span> پنل ادمین</h1>
          <p className="text-slate-400 text-sm mt-1">مدیریت اعضای تیم مرکزی و ادمین‌ها</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm text-brand-400 hover:underline">
            کنسول بررسی
          </Link>
          <span className="text-sm text-slate-400" dir="ltr">
            {username} {isRoot && <Badge tone="brand" className="ms-2">ریشه</Badge>}
          </span>
          <Button variant="ghost" onClick={logout}>
            خروج
          </Button>
        </div>
      </header>

      {isRoot ? (
        <Card className="p-4 mb-6 text-sm text-slate-400">
          <span aria-hidden="true">ℹ️</span> رمز عبور ادمین ریشه از طریق پیکربندی محیط (environment) تنظیم می‌شود و از
          این پنل قابل تغییر نیست.
        </Card>
      ) : (
        <div className="flex justify-end mb-6">
          <Button variant="secondary" onClick={() => setPwModalOpen(true)}>
            تغییر رمز عبور
          </Button>
        </div>
      )}

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4"><span aria-hidden="true">👥</span> اعضای تیم مرکزی</h2>
        <Card className="p-5 mb-4">
          <h3 className="text-sm font-semibold mb-3 text-slate-300">افزودن عضو جدید</h3>
          <form onSubmit={handleAddMember} className="flex flex-col gap-3">
            <Input label="نام" placeholder="مثال: سارا احمدی" value={memberName} onChange={(e) => setMemberName(e.target.value)} />
            <Input
              label="شماره موبایل"
              placeholder="09123456789"
              dir="ltr"
              className="text-left"
              value={memberPhone}
              onChange={(e) => setMemberPhone(e.target.value)}
            />
            {memberFormError && <p className="text-xs text-red-400">{memberFormError}</p>}
            <div className="flex justify-end pt-1">
              <Button type="submit" loading={addingMember}>
                افزودن
              </Button>
            </div>
          </form>
        </Card>

        {members.length === 0 ? (
          <Card className="p-5 text-center text-sm text-slate-400">هنوز هیچ عضوی اضافه نشده است.</Card>
        ) : (
          <div className="flex flex-col gap-3">
            {members.map((m) => (
              <Card key={m.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-100 truncate">{m.name}</span>
                    <Badge tone={m.active ? 'success' : 'neutral'}>{m.active ? 'فعال' : 'غیرفعال'}</Badge>
                    {m.phoneVerified && <Badge tone="success">تأییدشده</Badge>}
                  </div>
                  <span dir="ltr" className="text-xs text-slate-400 text-left">
                    {m.phone}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => openEditMember(m)}>
                    ویرایش
                  </Button>
                  <Button variant="secondary" loading={togglingId === m.id} onClick={() => handleToggleMember(m)}>
                    {m.active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                  </Button>
                  <Button variant="danger" loading={deletingMemberId === m.id} onClick={() => handleDeleteMember(m)}>
                    حذف
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4"><span aria-hidden="true">🛡️</span> ادمین‌ها</h2>
        <Card className="p-5 mb-4">
          <h3 className="text-sm font-semibold mb-3 text-slate-300">افزودن ادمین جدید</h3>
          <p className="text-xs text-slate-500 mb-3">
            نام کاربری و رمز عبوری که وارد می‌کنید مستقیماً برای این ادمین صادر می‌شود — آن را به‌صورت امن به او اطلاع دهید.
          </p>
          <form onSubmit={handleAddAdmin} className="flex flex-col gap-3">
            <Input
              label="نام کاربری"
              dir="ltr"
              className="text-left"
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
            />
            <Input
              label="رمز عبور (حداقل ۸ کاراکتر)"
              type="password"
              dir="ltr"
              className="text-left"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
            />
            {adminFormError && <p className="text-xs text-red-400">{adminFormError}</p>}
            <div className="flex justify-end pt-1">
              <Button type="submit" loading={addingAdmin}>
                افزودن ادمین
              </Button>
            </div>
          </form>
        </Card>

        {admins.length === 0 ? (
          <Card className="p-5 text-center text-sm text-slate-400">هنوز هیچ ادمین دیگری اضافه نشده است.</Card>
        ) : (
          <div className="flex flex-col gap-3">
            {admins.map((a) => (
              <Card key={a.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <span dir="ltr" className="text-sm font-medium text-slate-100 text-left">
                    {a.username}
                  </span>
                  <span className="text-xs text-slate-500">
                    ایجادشده توسط {a.createdBy} — {a.createdAt}
                  </span>
                </div>
                <Button variant="danger" loading={removingId === a.id} onClick={() => handleRemoveAdmin(a)}>
                  حذف
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Modal open={pwModalOpen} onClose={() => setPwModalOpen(false)} title="تغییر رمز عبور">
        <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
          <Input
            label="رمز عبور فعلی"
            type="password"
            dir="ltr"
            className="text-left"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <Input
            label="رمز عبور جدید (حداقل ۸ کاراکتر)"
            type="password"
            dir="ltr"
            className="text-left"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          {pwError && <p className="text-xs text-red-400">{pwError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setPwModalOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" loading={changingPw}>
              تغییر رمز
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={editingMember !== null} onClose={() => setEditingMember(null)} title="ویرایش عضو تیم مرکزی">
        <form onSubmit={handleSaveMemberEdit} className="flex flex-col gap-3">
          <Input
            label="نام"
            placeholder="مثال: سارا احمدی"
            value={editMemberName}
            onChange={(e) => setEditMemberName(e.target.value)}
          />
          <Input
            label="شماره موبایل"
            placeholder="09123456789"
            dir="ltr"
            className="text-left"
            value={editMemberPhone}
            onChange={(e) => setEditMemberPhone(e.target.value)}
          />
          {editMemberError && <p className="text-xs text-red-400">{editMemberError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setEditingMember(null)}>
              انصراف
            </Button>
            <Button type="submit" loading={savingMemberEdit}>
              ذخیره
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
