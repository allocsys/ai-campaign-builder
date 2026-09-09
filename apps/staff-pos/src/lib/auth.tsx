import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'aicb_staff_pos_auth'

/**
 * Shared-device PIN auth (decided 2026-09-09, see plan.md POS-side UX addendum) —
 * NOT per-staff phone+OTP like Business Owner/Customer. One PIN unlocks the whole
 * device for the shift; whoever is at the counter uses the same PIN. Simpler for
 * a shop counter tablet than individual staff logins. Session persists in
 * localStorage until explicit logout (e.g. end of shift / device handoff).
 */
interface AuthContextValue {
  isAuthenticated: boolean
  /** Mocked — no backend yet. Accepts the fixed dev PIN "2468" (device-level, not per-staff). */
  login: (pin: string) => Promise<boolean>
  logout: () => void
  // === DEV BYPASS START — delete this line + the matching block below (and the button in AuthScreen.tsx) to remove ===
  /** Skips PIN entry entirely, for quickly viewing mock data. Dev/QA only. */
  devBypass: () => void
  // === DEV BYPASS END ===
}

const AuthContext = createContext<AuthContextValue | null>(null)

const MOCK_PIN = '2468'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'true') setIsAuthenticated(true)
  }, [])

  const login = async (pin: string) => {
    // TODO: replace with a real POST /pos/auth/pin once the backend exists
    // (likely business-scoped, not a single global PIN across all businesses).
    await new Promise((r) => setTimeout(r, 400))
    if (pin !== MOCK_PIN) return false
    localStorage.setItem(STORAGE_KEY, 'true')
    setIsAuthenticated(true)
    return true
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setIsAuthenticated(false)
  }

  // === DEV BYPASS START — delete this block + the matching interface line above (and the button in AuthScreen.tsx) to remove ===
  const devBypass = () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setIsAuthenticated(true)
  }
  // === DEV BYPASS END ===

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, devBypass }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
