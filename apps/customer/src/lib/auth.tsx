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
  // === DEV BYPASS START — delete this line + the matching block below (and the button in AuthScreen.tsx) to remove ===
  /** Skips OTP entirely and logs in with a fixed mock phone number, for quickly viewing mock data. Dev/QA only. */
  devBypass: () => void
  // === DEV BYPASS END ===
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

  // === DEV BYPASS START — delete this block + the matching interface line above (and the button in AuthScreen.tsx) to remove ===
  const devBypass = () => {
    const next: StoredAuth = { phone: '09120000000', token: 'dev-bypass-token' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setAuth(next)
  }
  // === DEV BYPASS END ===

  return (
    <AuthContext.Provider
      value={{
        phone: auth?.phone ?? null,
        isAuthenticated: !!auth,
        referralCodeUsed: auth?.referralCodeUsed ?? null,
        requestOtp,
        verifyOtp,
        logout,
        devBypass,
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
