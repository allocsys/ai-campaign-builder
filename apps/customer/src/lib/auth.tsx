import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { requestOtp as apiRequestOtp, verifyOtp as apiVerifyOtp } from '@ai-campaign-builder/api-client'
import client from './api-client'

const STORAGE_KEY = 'aicb_customer_auth'

interface StoredAuth {
  phone: string
  token: string
  /** Referral code entered at signup, if any — captured client-side only. The
   * backend's verify-otp does not currently accept/consume a referral code, so
   * this is not sent to the API; it's kept here for potential future use and to
   * preserve the existing AuthScreen.tsx signature. See plan.md Phase 0.5. */
  referralCodeUsed?: string
}

interface AuthContextValue {
  phone: string | null
  isAuthenticated: boolean
  referralCodeUsed: string | null
  /** Requests an OTP code from the backend. */
  requestOtp: (phone: string) => Promise<void>
  /** Verifies the OTP code with the backend. referralCode is accepted for
   * interface compatibility but is NOT sent to the backend (see StoredAuth
   * comment above) -- it's stored locally only. */
  verifyOtp: (phone: string, code: string, referralCode?: string) => Promise<boolean>
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
    // Request OTP via backend API
    await apiRequestOtp(client, phone, 'customer')
  }

  const verifyOtp = async (phone: string, code: string, referralCode?: string) => {
    // Verify OTP via backend API
    try {
      const res = await apiVerifyOtp(client, phone, 'customer', code)
      if (res.ok && res.token) {
        const next: StoredAuth = {
          phone,
          token: res.token,
          referralCodeUsed: referralCode?.trim() || undefined,
        }
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
    <AuthContext.Provider
      value={{
        phone: auth?.phone ?? null,
        isAuthenticated: !!auth,
        referralCodeUsed: auth?.referralCodeUsed ?? null,
        requestOtp,
        verifyOtp,
        logout,
      }}
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
