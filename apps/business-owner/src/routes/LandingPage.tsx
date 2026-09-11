import { Navigate, useNavigate } from 'react-router-dom'
import { Badge, Button, Card } from '@ai-campaign-builder/ui-kit'
import { useAuth } from '../lib/auth'

interface Feature {
  title: string
  description: string
  icon: string
}

const FEATURES: Feature[] = [
  {
    icon: '🎯',
    title: 'کمپین با هوش مصنوعی',
    description:
      'فقط هدفت رو بگو — جذب مشتری جدید یا نگه‌داشتن مشتری‌های قدیمی. هوش مصنوعی برات کمپین کامل با تسک، جایزه و چالش می‌سازه.',
  },
  {
    icon: '📍',
    title: 'ردیابی دقیق فعالیت',
    description:
      'از اسکرین‌شات فالو و استوری تا خرید حضوری و رفرال — همه چیز با کد شخصی مشتری و بررسی هوشمند تایید می‌شه.',
  },
  {
    icon: '📈',
    title: 'بینش و پیشنهاد هوشمند',
    description:
      'داشبورد بهت نشون می‌ده کدوم تسک‌ها خوب کار می‌کنن و کدوم نه، و برای بهتر شدن کمپین پیشنهاد می‌ده.',
  },
  {
    icon: '💬',
    title: 'اطلاع‌رسانی خودکار',
    description:
      'پیامک و تلگرام برای دعوت، یادآوری و اعلام جایزه — بدون این‌که خودت لازم باشه چیزی بنویسی یا بفرستی.',
  },
]

const STEPS = [
  { step: '۱', title: 'هدفت رو بگو', description: 'کسب‌وکار، هدف، مخاطب و پیشنهادت رو در چند سوال ساده جواب بده.' },
  { step: '۲', title: 'کمپین رو بساز', description: 'هوش مصنوعی یک پیشنهاد کامل می‌سازه؛ همون‌طور که هست اجرا کن یا ویرایشش کن.' },
  { step: '۳', title: 'راه بنداز و ببین', description: 'مشتری‌ها دعوت می‌شن، فعالیت‌ها ردیابی می‌شن و نتیجه رو در داشبورد می‌بینی.' },
]

/**
 * Public, unauthenticated front door for the business-owner app (plan.md
 * Open Item 7). Previously "/" was wrapped in ProtectedRoute and bounced
 * straight to the bare OTP screen — no branding, no value-prop, no
 * self-signup story. This is the marketing/value-prop surface; AuthScreen
 * (now at /login) stays the actual sign-in mechanism, reached via the CTAs
 * here. Already-authenticated visitors are sent straight to /dashboard
 * instead of seeing marketing copy again.
 */
export function LandingPage() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen">
      <header className="max-w-5xl mx-auto flex items-center justify-between px-6 py-6">
        <span className="font-bold text-lg">ai-campaign-builder</span>
        <Button variant="secondary" onClick={() => navigate('/login')}>
          ورود
        </Button>
      </header>

      <main>
        {/* Hero */}
        <section className="max-w-3xl mx-auto px-6 pt-10 pb-16 text-center flex flex-col items-center">
          <Badge tone="brand">پلتفرم کمپین وفاداری هوشمند</Badge>
          <h1 className="mt-6 text-3xl sm:text-4xl font-bold leading-relaxed">
            هدفت رو بگو.
            <br />
            هوش مصنوعی کمپینت رو می‌سازه.
          </h1>
          <p className="mt-4 text-slate-400 max-w-xl">
            برای کافی‌شاپ، فروشگاه، رستوران، باشگاه و هر کسب‌وکار دیگه — بدون نیاز به تجربه قبلی
            در طراحی کمپین وفاداری یا بازاریابی.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button className="px-8" onClick={() => navigate('/login')}>
              شروع کنید
            </Button>
            <Button variant="ghost" onClick={() => navigate('/login')}>
              از قبل حساب دارید؟ ورود
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <div className="grid sm:grid-cols-2 gap-4">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="text-right">
                <span className="text-2xl">{feature.icon}</span>
                <h3 className="mt-3 font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-4xl mx-auto px-6 pb-20">
          <h2 className="text-xl font-bold text-center mb-8">چطور کار می‌کنه؟</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {STEPS.map((s) => (
              <Card key={s.step} className="text-center">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/20 text-brand-400 font-bold">
                  {s.step}
                </span>
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">{s.description}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="max-w-3xl mx-auto px-6 pb-24 text-center">
          <Card className="p-8">
            <h2 className="text-xl font-bold">آماده شروعی؟</h2>
            <p className="mt-2 text-sm text-slate-400">
              با شماره موبایلت وارد شو و اولین کمپینت رو همین امروز بساز.
            </p>
            <Button className="mt-6 px-8" onClick={() => navigate('/login')}>
              شروع کنید
            </Button>
          </Card>
        </section>
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-8 text-center text-xs text-slate-500">
        © ai-campaign-builder
      </footer>
    </div>
  )
}
