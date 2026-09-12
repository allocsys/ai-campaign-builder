import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { requestOtp as apiRequestOtp, verifyOtp as apiVerifyOtp } from '@ai-campaign-builder/api-client'
import client from './api-client'

const STORAGE_KEY = 'aicb_staff_auth'

interface StaffUser {
  id: string
  phone: string
  role: string
  businessId?: string
}

interface StoredAuth {
  phone: string
  token: string
  businessId?: string
  user?: StaffUser
}

interface AuthContextValue {
  phone: string | null
  businessId: string | null
  user: StaffUser | null
  isAuthenticated: boolean
  loading: boolean
  isLoading: boolean
  /** Requests an OTP code from the backend. Returns the TEMPORARY dev-mode
   * OTP code (see packages/api-client's RequestOtpResponse.devOtp) so the
   * caller can surface it to the user until a real SMS provider exists. */
  requestOtp: (phone: string) => Promise<string | undefined>
  /** Verifies the OTP code with the backend. */
  verifyOtp: (phone: string, code: string) => Promise<boolean>
  /** Alias for verifyOtp */
  login: (phone: string, code: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        setAuth(JSON.parse(raw))
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
    setLoading(false)
  }, [])

  const requestOtp = async (phone: string) => {
    const res = await apiRequestOtp(client, phone, 'staff')
    return res.devOtp
  }

  const verifyOtp = async (phone: string, code: string) => {
    try {
      const res = await apiVerifyOtp(client, phone, 'staff', code)
      if (res.ok && res.token) {
        const businessId = res.user?.businessId
        const user: StaffUser = res.user ? {
          id: res.user.id,
          phone: res.user.phone,
          role: res.user.role,
          businessId,
        } : {
          id: '',
          phone,
          role: 'staff',
          businessId,
        }
        const next: StoredAuth = {
          phone,
          token: res.token,
          businessId,
          user,
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
        phone: auth?.phone ?? auth?.user?.phone ?? null,
        businessId: auth?.businessId ?? auth?.user?.businessId ?? null,
        user: auth?.user ?? null,
        isAuthenticated: !!auth,
        loading,
        isLoading: loading,
        requestOtp,
        verifyOtp,
        login: verifyOtp,
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
