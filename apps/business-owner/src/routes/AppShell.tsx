import { useState, useEffect } from 'react'
import { useLocation, Link, Outlet } from 'react-router-dom'
import { Button, AppHeader, Drawer, BottomNav } from '@ai-campaign-builder/ui-kit'
import { getSuggestedChanges } from '@ai-campaign-builder/api-client'
import { useAuth } from '../lib/auth'
import apiClient from '../lib/api-client'

/**
 * AppShell component integrating AppHeader, Drawer, and BottomNav
 * for persistent navigation across all /dashboard/* routes.
 *
 * Perf fix (dashboard-perf branch): this used to take a `children` prop and
 * get re-constructed fresh inside every leaf route's `element` in App.tsx.
 * React Router treats a differently-matched route as a different element
 * tree, so navigating between dashboard tabs was unmounting and remounting
 * this entire shell on every click -- including re-firing the
 * getSuggestedChanges fetch below on every single navigation, and causing
 * the header/drawer/bottom-nav to flicker and re-render from scratch. Now
 * that App.tsx nests all /dashboard/* routes under a single shared
 * <Route element={<AppShell />}> layout route, this component renders its
 * child route via <Outlet/> and stays mounted across all of them -- the
 * pendingSuggestionsCount fetch below now only runs once per session
 * instead of once per navigation.
 */
export function AppShell() {
  const { phone, logout } = useAuth()
  const location = useLocation()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [pendingSuggestionsCount, setPendingSuggestionsCount] = useState(0)

  useEffect(() => {
    let mounted = true
    getSuggestedChanges(apiClient)
      .then((data) => {
        if (mounted) {
          const pendingCount = data.filter((c) => c.status === 'pending').length
          setPendingSuggestionsCount(pendingCount)
        }
      })
      .catch(() => {
        // Silently default to 0 on error
        if (mounted) {
          setPendingSuggestionsCount(0)
        }
      })
    return () => {
      mounted = false
    }
  }, [])

  // Map route pathname to Persian title per design.md IA table. Prefix-
  // matches '/dashboard/campaign*' (plan.md Item 21) since the nav tab now
  // always points at the campaign list page (BottomNav's own default), and
  // that page fans out into '/dashboard/campaign/new' and
  // '/dashboard/campaign/:campaignId' -- a dynamic id in the pathname can't
  // be matched by an exact switch case the way the old fixed
  // '/dashboard/campaign/edit' route could.
  const getTitle = (pathname: string) => {
    if (pathname === '/dashboard') return 'داشبورد'
    if (pathname.startsWith('/dashboard/campaign')) return 'کمپین'
    if (pathname === '/dashboard/insights' || pathname === '/dashboard/suggestions') return 'تحلیل و پیشنهاد'
    if (pathname === '/dashboard/microsite') return 'میکروسایت'
    if (pathname === '/dashboard/autopilot') return 'خودکارسازی'
    if (pathname === '/dashboard/settings') return 'تنظیمات'
    if (pathname === '/dashboard/staff') return 'کارکنان'
    if (pathname === '/dashboard/sends-log') return 'لاگ ارسال‌ها'
    return 'داشبورد'
  }

  const currentTitle = getTitle(location.pathname)

  const secondaryNavItems = [
    { to: '/dashboard/autopilot', label: 'خودکارسازی' },
    { to: '/dashboard/settings', label: 'تنظیمات' },
    { to: '/dashboard/staff', label: 'کارکنان' },
    { to: '/dashboard/sends-log', label: 'لاگ ارسال‌ها' },
  ]

  return (
    <div className="min-h-screen flex flex-col pb-20">
      <AppHeader
        title={currentTitle}
        onMenuClick={() => setIsDrawerOpen(true)}
      />

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="منوی مدیریت"
      >
        <nav className="flex flex-col gap-2">
          {secondaryNavItems.map((item) => (
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
          {phone && (
            <div className="flex items-center justify-between px-2 text-sm text-slate-400">
              <span>شماره تماس:</span>
              <span dir="ltr" className="font-medium text-slate-200">{phone}</span>
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

      <main className="flex-1 p-6">
        <Outlet />
      </main>

      {/* plan.md Item 21 -- campaignTo no longer needs to be computed here:
          the nav tab always points at the campaign list page now (its own
          default '/dashboard/campaign'), regardless of whether this business
          has any campaigns yet -- CampaignListTab's own empty state handles
          that case. */}
      <BottomNav insightsBadgeCount={pendingSuggestionsCount} />
    </div>
  )
}
