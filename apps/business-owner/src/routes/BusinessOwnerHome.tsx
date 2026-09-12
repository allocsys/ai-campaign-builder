import { lazy, Suspense } from 'react'
import { Accordion, type AccordionItem } from '@ai-campaign-builder/ui-kit'
import { OnboardingBanner } from './OnboardingBanner'

const CampaignWizardTab = lazy(() =>
  import('./tabs/CampaignWizardTab').then((m) => ({ default: m.CampaignWizardTab })),
)
const DashboardTab = lazy(() => import('./tabs/DashboardTab').then((m) => ({ default: m.DashboardTab })))
const InsightsTab = lazy(() => import('./tabs/InsightsTab').then((m) => ({ default: m.InsightsTab })))
const SuggestionsTab = lazy(() => import('./tabs/SuggestionsTab').then((m) => ({ default: m.SuggestionsTab })))
const AutopilotTab = lazy(() => import('./tabs/AutopilotTab').then((m) => ({ default: m.AutopilotTab })))
const MicrositeBuilderTab = lazy(() =>
  import('./tabs/MicrositeBuilderTab').then((m) => ({ default: m.MicrositeBuilderTab })),
)
const SettingsTab = lazy(() => import('./tabs/SettingsTab').then((m) => ({ default: m.SettingsTab })))
const StaffTab = lazy(() => import('./tabs/StaffTab').then((m) => ({ default: m.StaffTab })))
const SendsLogTab = lazy(() => import('./tabs/SendsLogTab').then((m) => ({ default: m.SendsLogTab })))

/** Lightweight per-panel fallback while a tab chunk loads — mirrors Card's glass surface so it doesn't flash unstyled. */
function TabFallback() {
  return <div className="h-24 rounded-xl2 bg-glass-light animate-pulse" aria-hidden="true" />
}

/**
 * Main authenticated screen — click-to-expand accordion nav, mirrors the mockup's
 * business-owner.html dashboard pattern (see plan.md/session notes: accordion, not
 * horizontal tabs; no auto-advance-to-next-panel — deliberate, per earlier mockup feedback).
 * Each section's content is now wired to the real backend via packages/api-client (see lib/api-client.ts).
 *
 * Tabs are React.lazy-loaded (Step 9 bundle-size follow-up): each is its own chunk that
 * only loads when its accordion panel is first opened, since Accordion only mounts the
 * currently-open panel's content anyway.
 */
const items: AccordionItem[] = [
  {
    id: 'campaign-wizard',
    header: '🎯 طراحی کمپین جدید با AI',
    content: (
      <Suspense fallback={<TabFallback />}>
        <CampaignWizardTab />
      </Suspense>
    ),
  },
  {
    id: 'dashboard',
    header: 'داشبورد',
    content: (
      <Suspense fallback={<TabFallback />}>
        <DashboardTab />
      </Suspense>
    ),
  },
  {
    id: 'insights',
    header: 'تحلیل‌ها',
    content: (
      <Suspense fallback={<TabFallback />}>
        <InsightsTab />
      </Suspense>
    ),
  },
  {
    id: 'suggestions',
    header: 'پیشنهادها',
    content: (
      <Suspense fallback={<TabFallback />}>
        <SuggestionsTab />
      </Suspense>
    ),
  },
  {
    id: 'autopilot',
    header: 'خودکارسازی',
    content: (
      <Suspense fallback={<TabFallback />}>
        <AutopilotTab />
      </Suspense>
    ),
  },
  {
    id: 'microsite',
    header: 'سازنده وب‌سایت',
    content: (
      <Suspense fallback={<TabFallback />}>
        <MicrositeBuilderTab />
      </Suspense>
    ),
  },
  {
    id: 'settings',
    header: 'تنظیمات',
    content: (
      <Suspense fallback={<TabFallback />}>
        <SettingsTab />
      </Suspense>
    ),
  },
  {
    id: 'staff',
    header: 'کارکنان',
    content: (
      <Suspense fallback={<TabFallback />}>
        <StaffTab />
      </Suspense>
    ),
  },
  {
    id: 'sends-log',
    header: 'لاگ ارسال‌ها',
    content: (
      <Suspense fallback={<TabFallback />}>
        <SendsLogTab />
      </Suspense>
    ),
  },
]

export function BusinessOwnerHome() {
  return (
    <div className="max-w-2xl mx-auto" role="region" aria-label="پنل مدیریت کسب‌وکار">
      <OnboardingBanner />
      <Accordion items={items} defaultOpenId="dashboard" />
    </div>
  )
}
