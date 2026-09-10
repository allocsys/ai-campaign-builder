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
  /** Requests an OTP code from the backend. */
  requestOtp: (phone: string) => Promise<void>
  /** Verifies the OTP code with the backend. */
  verifyOtp: (phone: string, code: string) => Promise<boolean>
  logout: () => void
  // === DEV BYPASS START — delete this line + the matching block below (and the button in AuthScreen.tsx) to remove ===
  /** Skips OTP entirely and logs in with a fixed mock phone number, for quickly viewing mock data. Dev/QA only. */
  devBypass: () => void
  // === DEV BYPASS END ===
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
    await apiRequestOtp(client, phone, 'business_owner')
  }

  const verifyOtp = async (phone: string, code: string) => {
    // Verify OTP via backend API
    try {
      const res = await apiVerifyOtp(client, phone, 'business_owner', code)
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

  // === DEV BYPASS START — delete this block + the matching interface line above (and the button in AuthScreen.tsx) to remove ===
  const devBypass = () => {
    const next: StoredAuth = { phone: '09120000000', token: 'dev-bypass-token' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setAuth(next)
  }
  // === DEV BYPASS END ===

  return (
    <AuthContext.Provider
      value={{ phone: auth?.phone ?? null, isAuthenticated: !!auth, requestOtp, verifyOtp, logout, devBypass }}
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
