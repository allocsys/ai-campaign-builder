import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Input, useToast } from '@ai-campaign-builder/ui-kit'
import { useAuth } from '../lib/auth'

const PHONE_PATTERN = /^09\d{9}$/

type Step = 'phone' | 'otp'

/**
 * Two-step phone+OTP auth screen for staff POS, matching the customer and
 * business owner app patterns.
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ارسال کد با خطا مواجه شد، دوباره تلاش کنید')
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
        setError('کد وارد شده اشتباه است یا دسترسی پرسنل تعریف نشده است')
        return
      }
      show('ورود به صندوق با موفقیت انجام شد. خوش آمدید!', 'success')
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'کد وارد شده اشتباه است')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-sm w-full p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">
            <span aria-hidden="true">🧾</span>
          </div>
          <h1 className="text-xl font-bold mb-1">ورود به صندوق</h1>
          <p className="text-slate-400 text-sm">
            {step === 'phone' ? 'شماره موبایل پرسنل صندوق را وارد کنید' : `کد تایید ارسال شده به ${phone} را وارد کنید`}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl2 p-3 mb-4 text-xs text-red-300 text-center" role="alert">
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
              error={error ? ' ' : undefined}
              autoFocus
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
              error={error ? ' ' : undefined}
              autoFocus
            />
            <Button type="submit" loading={loading} className="w-full">
              تایید و ورود به صندوق
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
