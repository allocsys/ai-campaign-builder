import { useNavigate } from 'react-router-dom'
import { Button, Card } from '@ai-campaign-builder/ui-kit'
import { useAuth } from '../lib/auth'

/**
 * Full-page replacement for the raw ".This business account no longer
 * exists" red-text error that used to leak straight from each tab's own
 * .catch() block (DashboardTab, MicrositeBuilderTab, etc all rendered it
 * independently -- see business.ts's exists-check guard, commit 7080146).
 *
 * Rendered by ProtectedRoute whenever AuthProvider's accountDeleted flag is
 * set (see lib/account-deleted-bus.ts) -- i.e. as soon as ANY authenticated
 * request comes back with the backend's business_account_deleted code, not
 * just on a specific tab. The session is already cleared (AuthProvider's
 * bus subscriber calls the same storage-clearing logic logout() uses) by
 * the time this renders; the only action left is a deliberate "back to
 * login" tap. No auto-retry, no auto-redirect -- the account really is
 * gone, retrying won't help.
 */
export function AccountDeletedScreen() {
  const { clearAccountDeleted } = useAuth()
  const navigate = useNavigate()

  const handleBackToLogin = () => {
    clearAccountDeleted()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <Card className="max-w-sm w-full p-8 text-center flex flex-col items-center">
        <span className="text-4xl">🗑️</span>
        <h1 className="mt-4 text-lg font-bold text-slate-100">این حساب کسب‌وکار دیگر وجود ندارد</h1>
        <p className="mt-3 text-sm text-slate-400 leading-relaxed">
          دسترسی این حساب توسط مدیر سیستم حذف شده است. اگر فکر می‌کنید این یک اشتباه است، لطفاً با
          پشتیبانی تماس بگیرید.
        </p>
        <Button className="mt-6 w-full justify-center" onClick={handleBackToLogin}>
          بازگشت به صفحه ورود
        </Button>
      </Card>
    </div>
  )
}
