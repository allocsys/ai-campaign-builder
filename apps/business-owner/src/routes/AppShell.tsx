import { type ReactNode } from 'react'
import { Button } from '@ai-campaign-builder/ui-kit'
import { useAuth } from '../lib/auth'

/**
 * Minimal authenticated shell — header with the logged-in phone + logout.
 * Deliberately just a header + content slot for now: the real dashboard nav
 * (Onboarding/Dashboard/Insights/Suggestions/Autopilot/Microsite
 * Builder/Settings/Sends Log — accordion pattern, see the Accordion
 * component and plan.md's mockup nav notes) is Phase 5 Step 4 scope, not this
 * routing/shell step.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { phone, logout } = useAuth()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-glass-border bg-glass-light backdrop-blur-md">
        <span className="font-bold">پلتفرم کمپین‌ساز هوشمند</span>
        <div className="flex items-center gap-3">
          {phone && <span className="text-sm text-slate-400" dir="ltr">{phone}</span>}
          <Button variant="ghost" onClick={logout}>
            خروج
          </Button>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
