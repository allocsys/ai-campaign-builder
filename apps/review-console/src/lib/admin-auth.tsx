import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { adminLogin as apiAdminLogin, ADMIN_AUTH_STORAGE_KEY } from './admin-api-client'

interface StoredAdminAuth {
  username: string
  token: string
  isRoot: boolean
}

interface AdminAuthContextValue {
  username: string | null
  isRoot: boolean
  isAuthenticated: boolean
  /** True until the initial synchronous read of localStorage/sessionStorage
   * has completed. AdminProtectedRoute must wait for this before deciding
   * whether to redirect -- otherwise a page refresh with a valid stored
   * session still bounces to /admin/login for one render, because `auth`
   * starts null and isAuthenticated is false until the useEffect below runs. */
  loading: boolean
  /** Calls the real backend: POST /api/review-admin/login (username+password,
   *  not phone+OTP -- see plan.md "Admin login mechanism"). `remember`
   *  (default true) controls where the session is persisted: true ->
   *  localStorage, same as today's always-on behavior; false ->
   *  sessionStorage, cleared as soon as the tab/browser closes. */
  login: (username: string, password: string, remember?: boolean) => Promise<boolean>
  logout: () => void
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null)

function readStoredAdminAuth(): StoredAdminAuth | null {
  const raw = localStorage.getItem(ADMIN_AUTH_STORAGE_KEY) ?? sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY)
    sessionStorage.removeItem(ADMIN_AUTH_STORAGE_KEY)
    return null
  }
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAdminAuth | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setAuth(readStoredAdminAuth())
    setLoading(false)
  }, [])

  const login = async (username: string, password: string, remember = true) => {
    try {
      const res = await apiAdminLogin(username, password)
      if (res.ok && res.token && res.user) {
        const next: StoredAdminAuth = { username: res.user.username, token: res.token, isRoot: res.user.isRoot }
        localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY)
        sessionStorage.removeItem(ADMIN_AUTH_STORAGE_KEY)
        ;(remember ? localStorage : sessionStorage).setItem(ADMIN_AUTH_STORAGE_KEY, JSON.stringify(next))
        setAuth(next)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  const logout = () => {
    localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY)
    sessionStorage.removeItem(ADMIN_AUTH_STORAGE_KEY)
    setAuth(null)
  }

  return (
    <AdminAuthContext.Provider
      value={{
        username: auth?.username ?? null,
        isRoot: auth?.isRoot ?? false,
        isAuthenticated: !!auth,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  return ctx
}
