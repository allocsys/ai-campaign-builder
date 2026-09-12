import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Input, useToast } from '@ai-campaign-builder/ui-kit'
import { useAdminAuth } from '../lib/admin-auth'

/**
 * Admin login screen — username + password, NOT phone+OTP. Deliberate
 * departure from every other persona's auth (see plan.md "Admin login
 * mechanism"). Separate screen and route (/admin/login) from the review_team
 * phone+OTP screen, since these are two entirely different credential types
 * for two different roles.
 */
export function AdminLoginScreen() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { login } = useAdminAuth()
  const { show } = useToast()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!username.trim() || !password) {
      setError('نام کاربری و رمز عبور را وارد کنید')
      return
    }
    setLoading(true)
    try {
      const ok = await login(username.trim(), password, remember)
      if (!ok) {
        setError('نام کاربری یا رمز عبور اشتباه است')
        return
      }
      show('ورود ادمین با موفقیت انجام شد', 'success')
      navigate('/admin', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-sm w-full p-8">
        <h1 className="text-xl font-bold mb-1 text-center"><span aria-hidden="true">🔐</span> ورود ادمین</h1>
        <p className="text-slate-400 text-sm text-center mb-6">
          مدیریت اعضای تیم مرکزی و سایر ادمین‌ها
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="نام کاربری"
            dir="ltr"
            className="text-left"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <Input
            label="رمز عبور"
            type="password"
            dir="ltr"
            className="text-left"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error ?? undefined}
          />
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            مرا به خاطر بسپار
          </label>
          <Button type="submit" loading={loading} className="w-full">
            ورود
          </Button>
        </form>
      </Card>
    </div>
  )
}
