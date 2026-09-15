import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthScreen } from './routes/AuthScreen'
import { LandingPage } from './routes/LandingPage'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { AppShell } from './routes/AppShell'
import { DashboardIndexRoute } from './routes/DashboardIndexRoute'
import { CampaignListTab } from './routes/tabs/CampaignListTab'
import { CampaignWizardTab } from './routes/tabs/CampaignWizardTab'
import { CampaignEditorTab } from './routes/tabs/CampaignEditorTab'
import { InsightsAndSuggestionsTab } from './routes/tabs/InsightsAndSuggestionsTab'
import { MicrositeBuilderTab } from './routes/tabs/MicrositeBuilderTab'
import { AutopilotTab } from './routes/tabs/AutopilotTab'
import { SettingsTab } from './routes/tabs/SettingsTab'
import { StaffTab } from './routes/tabs/StaffTab'
import { SendsLogTab } from './routes/tabs/SendsLogTab'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthScreen />} />

      {/* Perf fix (dashboard-perf branch): every /dashboard/* route used to
          construct its OWN <AppShell> instance inline. React Router treats a
          differently-matched route as a different element tree, so simply
          navigating between dashboard tabs unmounted and remounted the whole
          header/drawer/bottom-nav shell every time -- including re-firing
          AppShell's getSuggestedChanges fetch on every single navigation.
          Nesting these routes under one shared AppShell layout route (which
          now renders its child via <Outlet/>, see AppShell.tsx) keeps the
          shell mounted across all of them; only the inner tab content swaps. */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardIndexRoute />} />
        {/* plan.md Item 21 -- '/dashboard/campaign' is now the campaign list
            page (previously the from-scratch wizard); '/dashboard/campaign/new'
            is the wizard (previously the fixed edit route lived at
            '/dashboard/campaign/edit', now replaced by the :campaignId-scoped
            route below). */}
        <Route path="/dashboard/campaign" element={<CampaignListTab />} />
        <Route path="/dashboard/campaign/new" element={<CampaignWizardTab />} />
        <Route path="/dashboard/campaign/:campaignId" element={<CampaignEditorTab />} />
        <Route path="/dashboard/insights" element={<InsightsAndSuggestionsTab />} />
        <Route path="/dashboard/microsite" element={<MicrositeBuilderTab />} />
        <Route path="/dashboard/autopilot" element={<AutopilotTab />} />
        <Route path="/dashboard/settings" element={<SettingsTab />} />
        <Route path="/dashboard/staff" element={<StaffTab />} />
        <Route path="/dashboard/sends-log" element={<SendsLogTab />} />
      </Route>

      <Route path="/dashboard/suggestions" element={<Navigate to="/dashboard/insights" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
