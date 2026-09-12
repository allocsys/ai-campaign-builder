import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthScreen } from './routes/AuthScreen'
import { LandingPage } from './routes/LandingPage'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { AppShell } from './routes/AppShell'
import { BusinessOwnerHome } from './routes/BusinessOwnerHome'
import { CampaignWizardTab } from './routes/tabs/CampaignWizardTab'
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
              <BusinessOwnerHome />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/campaign"
        element={
          <ProtectedRoute>
            <CampaignWizardTab />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/insights"
        element={
          <ProtectedRoute>
            <InsightsAndSuggestionsTab />
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
            <MicrositeBuilderTab />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/autopilot"
        element={
          <ProtectedRoute>
            <AutopilotTab />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/settings"
        element={
          <ProtectedRoute>
            <SettingsTab />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/staff"
        element={
          <ProtectedRoute>
            <StaffTab />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/sends-log"
        element={
          <ProtectedRoute>
            <SendsLogTab />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
