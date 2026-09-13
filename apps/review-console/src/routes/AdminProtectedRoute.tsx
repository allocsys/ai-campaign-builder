import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAdminAuth } from '../lib/admin-auth'

/**
 * Redirects to /admin/login if not authenticated as a review_admin.
 * Waits for `loading` to resolve first -- on a page refresh, auth state
 * starts as logged-out and only becomes known after AdminAuthProvider's
 * effect reads the stored session, so redirecting on the very first render
 * would bounce an already-logged-in admin to /admin/login before that read
 * completes.
 */
export function AdminProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAdminAuth()
  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />
  return <>{children}</>
}
