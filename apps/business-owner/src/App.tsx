import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthScreen } from './routes/AuthScreen'
import { LandingPage } from './routes/LandingPage'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { AppShell } from './routes/AppShell'
import { OnboardingBanner } from './routes/OnboardingBanner'
import { DashboardTab } from './routes/tabs/DashboardTab'
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
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppShell>
              <OnboardingBanner />
              <DashboardTab />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/campaign"
        element={
          <ProtectedRoute>
            <AppShell>
              <CampaignWizardTab />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/campaign/edit"
        element={
          <ProtectedRoute>
            <AppShell>
              <CampaignEditorTab />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/insights"
        element={
          <ProtectedRoute>
            <AppShell>
              <InsightsAndSuggestionsTab />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/suggestions"
        element={<Navigate to="/dashboard/insights" replace />}
      />
      <Route
        path="/dashboard/microsite"
        element={
          <ProtectedRoute>
            <AppShell>
              <MicrositeBuilderTab />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/autopilot"
        element={
          <ProtectedRoute>
            <AppShell>
              <AutopilotTab />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/settings"
        element={
          <ProtectedRoute>
            <AppShell>
              <SettingsTab />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/staff"
        element={
          <ProtectedRoute>
            <AppShell>
              <StaffTab />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/sends-log"
        element={
          <ProtectedRoute>
            <AppShell>
              <SendsLogTab />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
