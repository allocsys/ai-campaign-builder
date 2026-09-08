import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'aicb_customer_auth'

interface StoredAuth {
  phone: string
  token: string
  /** Referral code entered at signup, if any — captured once here so mock-data can
   * process the referral link (cap enforcement, pending-until-first-purchase payout)
   * the first time the customer's profile is initialized. See plan.md Phase 0.5. */
  referralCodeUsed?: string
}

interface AuthContextValue {
  phone: string | null
  isAuthenticated: boolean
  referralCodeUsed: string | null
  /** Mocked — no backend yet. Always "succeeds" after a short delay; see plan.md Phase 5 stub-until-backend-exists note. */
  requestOtp: (phone: string) => Promise<void>
  /** Mocked — accepts the fixed dev OTP "5432" (matches mockup/customer.html's convention), rejects anything else. */
  verifyOtp: (phone: string, code: string, referralCode?: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const MOCK_OTP = '5432'

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

  const requestOtp = async (_phone: string) => {
    // TODO: replace with real POST /auth/otp/request once the backend exists.
    await new Promise((r) => setTimeout(r, 600))
  }

  const verifyOtp = async (phone: string, code: string, referralCode?: string) => {
    // TODO: replace with real POST /auth/otp/verify once the backend exists.
    await new Promise((r) => setTimeout(r, 600))
    if (code !== MOCK_OTP) return false
    const next: StoredAuth = {
      phone,
      token: `mock-token-${phone}`,
      referralCodeUsed: referralCode?.trim() || undefined,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setAuth(next)
    return true
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
