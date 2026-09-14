import { type ReactNode, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { Button, AppHeader, Drawer, Badge } from '@ai-campaign-builder/ui-kit'
import { useAdminAuth } from '../lib/admin-auth'

/**
 * AdminAppShell component integrating AppHeader and Drawer
 * for persistent navigation across all /admin/* routes.
 */
export function AdminAppShell({ title, children }: { title: string; children: ReactNode }) {
  const { username, isRoot, logout } = useAdminAuth()
  const location = useLocation()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const adminNavItems = [
    { to: '/admin', label: 'پنل ادمین' },
    { to: '/admin/campaigns', label: 'کمپین‌های کسب‌وکارها' },
    { to: '/admin/customers', label: 'مشتریان' },
  ]

  return (
    <div className="min-h-screen flex flex-col pb-12">
      <AppHeader
        title={title}
        onMenuClick={() => setIsDrawerOpen(true)}
      />

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="منوی مدیریت ادمین"
      >
        <nav className="flex flex-col gap-2">
          {adminNavItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setIsDrawerOpen(false)}
              className={`px-4 py-3 rounded-xl2 transition-colors border ${
                location.pathname === item.to
                  ? 'bg-brand-600/20 border-brand-500/50 text-slate-100 font-medium'
                  : 'bg-glass-light hover:bg-white/10 border-glass-border text-slate-200'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-glass-border flex flex-col gap-4">
          {username && (
            <div className="flex items-center justify-between px-2 text-sm text-slate-400">
              <span>نام کاربری:</span>
              <span dir="ltr" className="font-medium text-slate-200 flex items-center gap-2">
                {username}
                {isRoot && <Badge tone="brand">ریشه</Badge>}
              </span>
            </div>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setIsDrawerOpen(false)
              logout()
            }}
            className="w-full justify-center"
          >
            خروج از حساب
          </Button>
        </div>
      </Drawer>

      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">{children}</main>
    </div>
  )
}
