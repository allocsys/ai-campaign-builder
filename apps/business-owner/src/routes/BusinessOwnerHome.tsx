import { Accordion, type AccordionItem } from '@ai-campaign-builder/ui-kit'
import { OnboardingTab } from './tabs/OnboardingTab'
import { DashboardTab } from './tabs/DashboardTab'
import { InsightsTab } from './tabs/InsightsTab'
import { SuggestionsTab } from './tabs/SuggestionsTab'
import { AutopilotTab } from './tabs/AutopilotTab'
import { MicrositeBuilderTab } from './tabs/MicrositeBuilderTab'
import { SettingsTab } from './tabs/SettingsTab'
import { SendsLogTab } from './tabs/SendsLogTab'

/**
 * Main authenticated screen — click-to-expand accordion nav, mirrors the mockup's
 * business-owner.html dashboard pattern (see plan.md/session notes: accordion, not
 * horizontal tabs; no auto-advance-to-next-panel — deliberate, per earlier mockup feedback).
 * Each section's content is a Phase-5-Step-4 stub screen backed by mock-data.ts.
 */
const items: AccordionItem[] = [
  { id: 'onboarding', header: 'مراحل شروع', content: <OnboardingTab /> },
  { id: 'dashboard', header: 'داشبورد', content: <DashboardTab /> },
  { id: 'insights', header: 'تحلیل‌ها', content: <InsightsTab /> },
  { id: 'suggestions', header: 'پیشنهادها', content: <SuggestionsTab /> },
  { id: 'autopilot', header: 'خودکارسازی', content: <AutopilotTab /> },
  { id: 'microsite', header: 'سازنده وب‌سایت', content: <MicrositeBuilderTab /> },
  { id: 'settings', header: 'تنظیمات', content: <SettingsTab /> },
  { id: 'sends-log', header: 'لاگ ارسال‌ها', content: <SendsLogTab /> },
]

export function BusinessOwnerHome() {
  return (
    <div className="max-w-2xl mx-auto" role="region" aria-label="پنل مدیریت کسب‌وکار">
      <Accordion items={items} defaultOpenId="dashboard" />
    </div>
  )
}
