import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthScreen } from './routes/AuthScreen'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { ReviewConsoleHome } from './routes/ReviewConsoleHome'
import { AdminLoginScreen } from './routes/AdminLoginScreen'
import { AdminProtectedRoute } from './routes/AdminProtectedRoute'
import { AdminHome } from './routes/AdminHome'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthScreen />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ReviewConsoleHome />
          </ProtectedRoute>
        }
      />
      {/* Admin page lives inside this same app, gated by its own auth (see
          plan.md "Where it lives") -- separate provider/routes from the
          review_team phone+OTP ones above, since it's a different role with
          a different credential type. */}
      <Route path="/admin/login" element={<AdminLoginScreen />} />
      <Route
        path="/admin"
        element={
          <AdminProtectedRoute>
            <AdminHome />
          </AdminProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
