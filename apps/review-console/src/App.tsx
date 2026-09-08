import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthScreen } from './routes/AuthScreen'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { ReviewConsoleHome } from './routes/ReviewConsoleHome'

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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
