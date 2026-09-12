import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Input, useToast } from '@ai-campaign-builder/ui-kit'
import { ApiError } from '@ai-campaign-builder/api-client'
import { useAuth } from '../lib/auth'

const PHONE_PATTERN = /^09\d{9}$/

type Step = 'phone' | 'otp'

/**
 * Two-step phone+OTP join screen, plus optional referral code field on the phone
 * step (mirrors mockup/customer.html's join flow). Kept as one component with
 * internal step state — same pattern as the Business Owner app's AuthScreen —
 * so the entered phone/referral survive the phone→OTP transition without router
 * state/params.
 */
export function AuthScreen() {
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { requestOtp, verifyOtp } = useAuth()
  const { show } = useToast()
  const navigate = useNavigate()

  const handlePhoneSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!PHONE_PATTERN.test(phone)) {
      setError('شماره موبایل معتبر نیست (مثال: 09121111111)')
      return
    }
    setLoading(true)
    try {
      const devOtp = await requestOtp(phone)
      setStep('otp')
      // TEMPORARY (dev-mode only): no real SMS provider is wired in yet, so
      // surface the backend's fixed dev OTP directly instead of leaving the
      // person to guess/dig it out of server logs. Remove once real SMS exists.
      if (devOtp) {
        show(`کد تست (حالت توسعه): ${devOtp}`, 'warning')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const ok = await verifyOtp(phone, code, referralCode)
      if (!ok) {
        setError('کد وارد شده اشتباه است')
        return
      }
      show('ورود با موفقیت انجام شد. خوش آمدید!', 'success')
      navigate('/', { replace: true })
    } catch (err) {
      // Open Item 13, Step D: useAuth().verifyOtp rethrows specifically for a
      // 400 "no resolvable campaign" failure (first-ever signup with no join
      // link) -- surfaced verbatim here since it's a distinct, more actionable
      // message than the generic wrong-OTP case above.
      if (err instanceof ApiError && err.status === 400) {
        setError(err.message)
        return
      }
      throw err
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-sm w-full p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">
            <span aria-hidden="true">☕</span>
          </div>
          {/* Open Item 13, Step C: generic copy, not a specific business name --
              no public/unauthenticated endpoint exists to resolve a business
              name from the join slug pre-login, and per plan.md this is the
              deliberately-chosen simpler option over building one. Post-login,
              CustomerHome.tsx already shows the real business name dynamically
              via profile.businessName from GET /api/customer/profile. */}
          <h1 className="text-xl font-bold mb-1">به باشگاه مشتریان خوش آمدید!</h1>
          <p className="text-slate-400 text-sm">
            {step === 'phone' ? 'با عضویت، در ازای هر سفارش، استوری یا معرفی دوستان امتیاز بگیرید.' : `کد ارسال شده به ${phone} را وارد کنید`}
          </p>
        </div>

        {error && (
          <div role="alert" className="sr-only">
            {error}
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-4">
            <Input
              label="شماره موبایل"
              type="tel"
              inputMode="numeric"
              placeholder="09121111111"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={error ?? undefined}
              autoFocus
            />
            <Input
              label="کد معرف (اختیاری)"
              placeholder="مثال: 48291"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
            />
            <Button type="submit" loading={loading} className="w-full">
              دریافت کد تایید پیامکی
            </Button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
            <Input
              label="کد تایید"
              inputMode="numeric"
              placeholder="----"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              error={error ?? undefined}
              autoFocus
            />
            <Button type="submit" loading={loading} className="w-full">
              تایید و ورود به باشگاه
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setStep('phone')
                setCode('')
                setError(null)
              }}
            >
              تغییر شماره موبایل
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
