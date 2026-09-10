import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAdminAuth } from '../lib/admin-auth'

/** Redirects to /admin/login if not authenticated as a review_admin. */
export function AdminProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAdminAuth()
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />
  return <>{children}</>
}
