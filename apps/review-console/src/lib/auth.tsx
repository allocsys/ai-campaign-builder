import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { requestOtp as apiRequestOtp, verifyOtp as apiVerifyOtp } from '@ai-campaign-builder/api-client'
import client from './api-client'

const STORAGE_KEY = 'aicb_review_console_auth'

interface StoredAuth {
  phone: string
  token: string
}

interface AuthContextValue {
  /** The logged-in team member's phone number — used as the `reviewed_by` /
   *  flag-resolver identity in the audit trail, replacing the mockup's fixed
   *  'central_team' string. See plan.md "Review Console authentication". */
  phone: string | null
  isAuthenticated: boolean
  /** True until the initial synchronous read of localStorage/sessionStorage
   * has completed. ProtectedRoute must wait for this before deciding
   * whether to redirect -- otherwise a page refresh with a valid stored
   * session still bounces to /login for one render, because `auth` starts
   * null and isAuthenticated is false until the useEffect below runs. */
  loading: boolean
  /** Calls the real backend: POST /api/auth/request-otp with role='review_team'.
   * Returns the TEMPORARY dev-mode OTP code (see packages/api-client's
   * RequestOtpResponse.devOtp) so the caller can surface it to the user until
   * a real SMS provider exists. */
  requestOtp: (phone: string) => Promise<string | undefined>
  /** Calls the real backend: POST /api/auth/verify-otp with role='review_team'.
   *  Dev-mode OTP is a fixed stub (9911) on the backend side, not here.
   *  `remember` (default true) controls where the session is persisted:
   *  true -> localStorage, same as today's always-on behavior; false ->
   *  sessionStorage, cleared as soon as the tab/browser closes. */
  verifyOtp: (phone: string, code: string, remember?: boolean) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredAuth(): StoredAuth | null {
  const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setAuth(readStoredAuth())
    setLoading(false)
  }, [])

  const requestOtp = async (phone: string) => {
    const res = await apiRequestOtp(client, phone, 'review_team')
    return res.devOtp
  }

  const verifyOtp = async (phone: string, code: string, remember = true) => {
    try {
      const res = await apiVerifyOtp(client, phone, 'review_team', code)
      if (res.ok && res.token) {
        const next: StoredAuth = { phone, token: res.token }
        localStorage.removeItem(STORAGE_KEY)
        sessionStorage.removeItem(STORAGE_KEY)
        ;(remember ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(next))
        setAuth(next)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(STORAGE_KEY)
    setAuth(null)
  }

  return (
    <AuthContext.Provider value={{ phone: auth?.phone ?? null, isAuthenticated: !!auth, loading, requestOtp, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
