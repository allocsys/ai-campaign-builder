import { type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Button, AppHeader } from '@ai-campaign-builder/ui-kit'
import { useAuth } from '../lib/auth'

/**
 * AppShell component integrating the new AppHeader with route-aware title
 * mapping matching design.md's IA table.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { phone, logout } = useAuth()
  const location = useLocation()

  // Map route pathname to Persian title per design.md IA table
  const getTitle = (pathname: string) => {
    switch (pathname) {
      case '/dashboard':
        return 'داشبورد'
      case '/dashboard/campaign':
        return 'کمپین'
      case '/dashboard/insights':
      case '/dashboard/suggestions':
        return 'تحلیل و پیشنهاد'
      case '/dashboard/microsite':
        return 'میکروسایت'
      case '/dashboard/autopilot':
        return 'خودکارسازی'
      case '/dashboard/settings':
        return 'تنظیمات'
      case '/dashboard/staff':
        return 'کارکنان'
      case '/dashboard/sends-log':
        return 'لاگ ارسال‌ها'
      default:
        return 'داشبورد'
    }
  }

  const currentTitle = getTitle(location.pathname)

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        title={currentTitle}
        onMenuClick={() => console.log('TODO: Open drawer menu')}
      >
        <div className="flex items-center gap-3">
          {phone && <span className="text-sm text-slate-400" dir="ltr">{phone}</span>}
          <Button variant="ghost" onClick={logout}>
            خروج
          </Button>
        </div>
      </AppHeader>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
