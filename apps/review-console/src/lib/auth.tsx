import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

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
  /** Mocked — no backend yet. Always "succeeds" after a short delay; see plan.md Phase 5 stub-until-backend-exists note. */
  requestOtp: (phone: string) => Promise<void>
  /** Mocked — accepts the fixed dev OTP "9911" (distinct per-app dev OTP, see README), rejects anything else. */
  verifyOtp: (phone: string, code: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const MOCK_OTP = '9911'

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

  const verifyOtp = async (phone: string, code: string) => {
    // TODO: replace with real POST /auth/otp/verify once the backend exists.
    await new Promise((r) => setTimeout(r, 600))
    if (code !== MOCK_OTP) return false
    const next: StoredAuth = { phone, token: `mock-token-${phone}` }
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
