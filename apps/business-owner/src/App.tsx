import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthScreen } from './routes/AuthScreen'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { AppShell } from './routes/AppShell'
import { BusinessOwnerHome } from './routes/BusinessOwnerHome'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthScreen />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell>
              <BusinessOwnerHome />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
