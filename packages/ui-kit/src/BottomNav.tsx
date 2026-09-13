import { type HTMLAttributes } from 'react'
import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { motionDuration, motionEasing } from './animation-tokens'

export interface BottomNavProps extends HTMLAttributes<HTMLElement> {
  insightsBadgeCount?: number
  /**
   * Overrides where the "کمپین" (Campaign) nav item points. Callers should
   * pass '/dashboard/campaign/edit' once the business has a real campaign
   * (active, or draft with tasks/rewards already) and '/dashboard/campaign'
   * (the from-scratch AI wizard) otherwise -- see AppShell, which computes
   * this from the fetched campaign, not from manualEditorEnabled/pro mode.
   * Defaults to the wizard route for backward compatibility if omitted.
   */
  campaignTo?: string
}

interface NavItem {
  to: string
  label: string
  icon: (isActive: boolean) => React.ReactNode
}

function buildNavItems(campaignTo: string): NavItem[] {
  return [
  {
    to: '/dashboard',
    label: 'داشبورد',
    icon: (isActive) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className={`h-5 w-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    to: campaignTo,
    label: 'کمپین',
    icon: (isActive) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className={`h-5 w-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <circle cx="12" cy="12" r="8" strokeWidth={2} />
        <circle cx="12" cy="12" r="4" strokeWidth={2} />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    to: '/dashboard/insights',
    label: 'تحلیل و پیشنهاد',
    icon: (isActive) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className={`h-5 w-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
    ),
  },
  {
    to: '/dashboard/microsite',
    label: 'میکروسایت',
    icon: (isActive) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className={`h-5 w-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
        />
      </svg>
    ),
  },
  ]
}

/**
 * BottomNav component for the UI kit.
 * Fixed position bottom tab bar with 4 primary destinations, active-route highlighting,
 * glass/dark aesthetic matching Drawer.tsx and Card.tsx.
 */
export function BottomNav({ className = '', insightsBadgeCount, ...rest }: BottomNavProps) {
  return (
    <motion.nav
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: motionDuration.base, ease: motionEasing.out }}
      className={`fixed bottom-0 left-0 right-0 z-40 bg-glass-light backdrop-blur-md border-t border-glass-border shadow-glass px-4 py-2 ${className}`}
      {...(rest as any)}
    >
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const count = insightsBadgeCount ?? 0
          const showBadge = item.to === '/dashboard/insights' && count > 0
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'text-brand-400 font-semibold bg-brand-600/15 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    {item.icon(isActive)}
                    {showBadge && (
                      <span className="absolute -top-1 -right-2 bg-amber-500 text-slate-900 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </div>
                  <span className="text-xs tracking-tight">{item.label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </motion.nav>
  )
}
