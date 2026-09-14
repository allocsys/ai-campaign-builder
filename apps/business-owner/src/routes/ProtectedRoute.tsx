import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { AccountDeletedScreen } from './AccountDeletedScreen'

/**
 * Redirects to /login if not authenticated. Wraps the whole authenticated app shell.
 * Waits for `loading` to resolve first -- on a page refresh, auth state starts
 * as logged-out and only becomes known after AuthProvider's effect reads the
 * stored session, so redirecting on the very first render would bounce an
 * already-logged-in user to /login before that read completes.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading, accountDeleted } = useAuth()
  if (loading) return null
  // Checked before isAuthenticated: the account-deleted bus subscriber
  // clears the stored session as soon as it fires, so isAuthenticated is
  // already false here too -- without this ordering, every route would
  // just silently bounce to /login instead of showing AccountDeletedScreen.
  if (accountDeleted) return <AccountDeletedScreen />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}
