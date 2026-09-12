import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { requestOtp as apiRequestOtp, verifyOtp as apiVerifyOtp } from '@ai-campaign-builder/api-client'
import client from './api-client'

const STORAGE_KEY = 'aicb_business_owner_auth'

interface StoredAuth {
  phone: string
  token: string
}

interface AuthContextValue {
  phone: string | null
  isAuthenticated: boolean
  /** Requests an OTP code from the backend. Returns the TEMPORARY dev-mode
   * OTP code (see packages/api-client's RequestOtpResponse.devOtp) so the
   * caller can surface it to the user until a real SMS provider exists. */
  requestOtp: (phone: string) => Promise<string | undefined>
  /** Verifies the OTP code with the backend. `remember` (default true)
   * controls where the session is persisted: true -> localStorage, same as
   * today's always-on behavior, survives closing the browser entirely;
   * false -> sessionStorage, cleared as soon as the tab/browser closes. */
  verifyOtp: (phone: string, code: string, remember?: boolean) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredAuth(): StoredAuth | null {
  // Check both -- a prior login could have landed in either storage
  // depending on the remember-me choice made at the time.
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

  useEffect(() => {
    setAuth(readStoredAuth())
  }, [])

  const requestOtp = async (phone: string) => {
    // Request OTP via backend API
    const res = await apiRequestOtp(client, phone, 'business_owner')
    return res.devOtp
  }

  const verifyOtp = async (phone: string, code: string, remember = true) => {
    // Verify OTP via backend API
    try {
      const res = await apiVerifyOtp(client, phone, 'business_owner', code)
      if (res.ok && res.token) {
        const next: StoredAuth = { phone, token: res.token }
        // Clear the other storage first so a re-login with a different
        // remember-me choice doesn't leave a stale copy of the session behind.
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
    <AuthContext.Provider
      value={{ phone: auth?.phone ?? null, isAuthenticated: !!auth, requestOtp, verifyOtp, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
