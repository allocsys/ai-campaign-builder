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
  /** Calls the real backend: POST /api/review-admin/login (username+password,
   *  not phone+OTP -- see plan.md "Admin login mechanism"). */
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null)

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAdminAuth | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem(ADMIN_AUTH_STORAGE_KEY)
    if (raw) {
      try {
        setAuth(JSON.parse(raw))
      } catch {
        localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY)
      }
    }
  }, [])

  const login = async (username: string, password: string) => {
    try {
      const res = await apiAdminLogin(username, password)
      if (res.ok && res.token && res.user) {
        const next: StoredAdminAuth = { username: res.user.username, token: res.token, isRoot: res.user.isRoot }
        localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, JSON.stringify(next))
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
    setAuth(null)
  }

  return (
    <AdminAuthContext.Provider
      value={{
        username: auth?.username ?? null,
        isRoot: auth?.isRoot ?? false,
        isAuthenticated: !!auth,
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
