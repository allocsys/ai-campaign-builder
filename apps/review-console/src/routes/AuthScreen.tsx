import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, Input, useToast } from '@ai-campaign-builder/ui-kit'
import { useAuth } from '../lib/auth'

const PHONE_PATTERN = /^09\d{9}$/

type Step = 'phone' | 'otp'

/**
 * Two-step phone+OTP auth screen — per plan.md "Review Console authentication"
 * (decided 2026-09-09): each central-team member logs in with their own phone,
 * not a shared credential, so the audit trail can identify who reviewed what.
 * Same component shape as the Business Owner / Customer auth screens.
 */
export function AuthScreen() {
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
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
      await requestOtp(phone)
      setStep('otp')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const ok = await verifyOtp(phone, code)
      if (!ok) {
        setError('کد وارد شده اشتباه است')
        return
      }
      show('ورود با موفقیت انجام شد', 'success')
      navigate('/', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-sm w-full p-8">
        <h1 className="text-xl font-bold mb-1 text-center">ورود تیم مرکزی</h1>
        <p className="text-slate-400 text-sm text-center mb-6">
          {step === 'phone' ? 'شماره موبایل خود را وارد کنید' : `کد ارسال شده به ${phone} را وارد کنید`}
        </p>

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
            <Button type="submit" loading={loading} className="w-full">
              دریافت کد تایید
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
              تایید و ورود
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

        <div className="text-center mt-6">
          <Link to="/admin/login" className="text-xs text-slate-500 hover:text-brand-400 hover:underline">
            ورود ادمین
          </Link>
        </div>
      </Card>
    </div>
  )
}
