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
  /** Calls the real backend: POST /api/auth/request-otp with role='review_team'.
   * Returns the TEMPORARY dev-mode OTP code (see packages/api-client's
   * RequestOtpResponse.devOtp) so the caller can surface it to the user until
   * a real SMS provider exists. */
  requestOtp: (phone: string) => Promise<string | undefined>
  /** Calls the real backend: POST /api/auth/verify-otp with role='review_team'.
   *  Dev-mode OTP is a fixed stub (9911) on the backend side, not here. */
  verifyOtp: (phone: string, code: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        setAuth(JSON.parse(raw))
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  const requestOtp = async (phone: string) => {
    const res = await apiRequestOtp(client, phone, 'review_team')
    return res.devOtp
  }

  const verifyOtp = async (phone: string, code: string) => {
    try {
      const res = await apiVerifyOtp(client, phone, 'review_team', code)
      if (res.ok && res.token) {
        const next: StoredAuth = { phone, token: res.token }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
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
    setAuth(null)
  }

  return (
    <AuthContext.Provider value={{ phone: auth?.phone ?? null, isAuthenticated: !!auth, requestOtp, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
