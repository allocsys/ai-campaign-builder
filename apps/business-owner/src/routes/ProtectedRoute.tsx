import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

/**
 * Redirects to /login if not authenticated. Wraps the whole authenticated app shell.
 * Waits for `loading` to resolve first -- on a page refresh, auth state starts
 * as logged-out and only becomes known after AuthProvider's effect reads the
 * stored session, so redirecting on the very first render would bounce an
 * already-logged-in user to /login before that read completes.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}
