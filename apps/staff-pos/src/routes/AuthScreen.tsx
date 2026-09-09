import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Input } from '@ai-campaign-builder/ui-kit'
import { useAuth } from '../lib/auth'

/**
 * Single-step shared-device PIN entry (not phone+OTP — see lib/auth.tsx for the
 * 2026-09-09 decision). No "forgot PIN" flow yet — device PIN reset/rotation
 * is a business-owner-side Settings concern for a later phase, not built here.
 */
export function AuthScreen() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { login, devBypass } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const ok = await login(pin)
      if (!ok) {
        setError('پین وارد شده اشتباه است')
        return
      }
      navigate('/', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-xs w-full p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🧾</div>
          <h1 className="text-lg font-bold mb-1">ورود به صندوق</h1>
          <p className="text-slate-400 text-sm">پین مشترک دستگاه صندوق را وارد کنید</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="پین دستگاه"
            type="password"
            inputMode="numeric"
            placeholder="----"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            error={error ?? undefined}
            autoFocus
          />
          <Button type="submit" loading={loading} className="w-full">
            ورود
          </Button>
        </form>

        {/* === DEV BYPASS START — delete this block + the devBypass wiring in auth.tsx to remove === */}
        <Button
          type="button"
          variant="ghost"
          className="w-full mt-4 border border-dashed border-amber-500/50 text-amber-500"
          onClick={() => {
            devBypass()
            navigate('/', { replace: true })
          }}
        >
          🔓 ورود آزمایشی (Dev Bypass)
        </Button>
        {/* === DEV BYPASS END === */}
      </Card>
    </div>
  )
}
