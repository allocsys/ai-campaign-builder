import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ApiError, requestOtp as apiRequestOtp, verifyOtp as apiVerifyOtp } from '@ai-campaign-builder/api-client'
import client from './api-client'

const STORAGE_KEY = 'aicb_customer_auth'

// Open Item 13, Step B: sessionStorage key main.tsx writes ?join=<slug> to,
// before React mounts (see main.tsx for why it has to happen that early).
// Read here rather than threaded in as a param so AuthScreen.tsx doesn't
// need to know about it at all -- keeps Step C's AuthScreen changes cleanly
// separated from this plumbing.
export const JOIN_SLUG_STORAGE_KEY = 'aicb_join_slug'

// Item 14, Step C: sessionStorage key main.tsx writes ?ref=<code> to, before
// React mounts (mirrors JOIN_SLUG_STORAGE_KEY above -- same early-capture
// reasoning applies). AuthScreen.tsx reads this once, on mount, to pre-fill
// (not auto-submit) its existing manual referral-code field -- the customer
// still sees and can edit/clear it before submitting.
export const REF_CODE_STORAGE_KEY = 'aicb_ref_code'

interface StoredAuth {
  phone: string
  token: string
  /** Referral code entered at signup, if any. Sent to the backend verify-otp
   * endpoint, which consumes it server-side (customer_campaign_codes.referred_by_code_id)
   * the first time this customer's campaign code is created; kept here too for
   * local display purposes. */
  referralCodeUsed?: string
}

interface AuthContextValue {
  phone: string | null
  isAuthenticated: boolean
  referralCodeUsed: string | null
  /** Requests an OTP code from the backend. Returns the TEMPORARY dev-mode
   * OTP code (see packages/api-client's RequestOtpResponse.devOtp) so the
   * caller can surface it to the user until a real SMS provider exists. */
  requestOtp: (phone: string) => Promise<string | undefined>
  /** Verifies the OTP code with the backend, passing referralCode through so
   * the backend can link it server-side at signup time (see StoredAuth comment
   * above). */
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
    const res = await apiRequestOtp(client, phone, 'customer')
    return res.devOtp
  }

  const verifyOtp = async (phone: string, code: string, referralCode?: string) => {
    // Verify OTP via backend API
    const joinSlug = sessionStorage.getItem(JOIN_SLUG_STORAGE_KEY) || undefined
    try {
      const res = await apiVerifyOtp(
        client,
        phone,
        'customer',
        code,
        referralCode?.trim() || undefined,
        joinSlug,
      )
      if (res.ok && res.token) {
        const next: StoredAuth = {
          phone,
          token: res.token,
          referralCodeUsed: referralCode?.trim() || undefined,
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        setAuth(next)
        // Clear after a successful verify so a later, unrelated login (e.g.
        // this customer eventually logging out and back in with no fresh
        // join link) doesn't silently reuse a stale slug from this session.
        sessionStorage.removeItem(JOIN_SLUG_STORAGE_KEY)
        return true
      }
      return false
    } catch (err) {
      // Open Item 13, Step D: a 400 here specifically means "no resolvable
      // campaign" (auth.ts's Step D guard) -- a distinct, more actionable
      // failure than a wrong OTP code, so it's rethrown for AuthScreen.tsx to
      // show verbatim rather than collapsed into the generic false-return
      // below (which AuthScreen renders as "کد وارد شده اشتباه است").
      if (err instanceof ApiError && err.status === 400) {
        throw err
      }
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
