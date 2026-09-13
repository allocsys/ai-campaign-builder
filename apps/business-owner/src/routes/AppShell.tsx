import { type ReactNode, useState, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { Button, AppHeader, Drawer, BottomNav } from '@ai-campaign-builder/ui-kit'
import { getSuggestedChanges, getCampaign } from '@ai-campaign-builder/api-client'
import { useAuth } from '../lib/auth'
import apiClient from '../lib/api-client'

/**
 * AppShell component integrating AppHeader, Drawer, and BottomNav
 * for persistent navigation across all /dashboard/* routes.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { phone, logout } = useAuth()
  const location = useLocation()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [pendingSuggestionsCount, setPendingSuggestionsCount] = useState(0)
  // Default to the wizard route until the campaign fetch resolves, and stay
  // there if it fails -- worst case a business with a real campaign briefly
  // sees the wizard on first paint, same as today, rather than us guessing.
  const [campaignTo, setCampaignTo] = useState('/dashboard/campaign')

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

  useEffect(() => {
    let mounted = true
    getCampaign(apiClient)
      .then((campaign) => {
        if (!mounted) return
        // Same "has this business ever actually gotten a real campaign"
        // signal as CampaignEditorTab/CampaignWizardTab -- ensureCampaign()
        // auto-provisions an empty draft row on first-ever GET, so row
        // existence alone can't distinguish "fresh business" from "has a
        // campaign".
        const hasRealCampaign =
          campaign.status === 'active' || campaign.tasks.length > 0 || campaign.rewards.length > 0
        setCampaignTo(hasRealCampaign ? '/dashboard/campaign/edit' : '/dashboard/campaign')
      })
      .catch(() => {
        // Silently keep the wizard default on error
      })
    return () => {
      mounted = false
    }
  }, [])

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

      <main className="flex-1 p-6">{children}</main>

      <BottomNav insightsBadgeCount={pendingSuggestionsCount} campaignTo={campaignTo} />
    </div>
  )
}
