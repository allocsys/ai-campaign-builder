import { useEffect, useState } from 'react'
import { Badge, Button, Card, useToast } from '@ai-campaign-builder/ui-kit'
import type { ReferralFlag } from '@ai-campaign-builder/api-client'
import { useAuth } from '../lib/auth'
import { getReferralFlags, runReferralDetection, resolveFlag as apiResolveFlag } from '../lib/api-client'

/**
 * Central-team review console (apps/backend/src/routes/review.ts) —
 * referral anomaly flags queue with a batch-detection trigger.
 *
 * The uncertain-AI-submissions / retroactive-purchase-claims queue that used
 * to live here was removed 2026-09-13: staff now handle ALL screenshot AND
 * receipt_claim review firsthand (see apps/staff-pos/src/routes/StaffPosHome.tsx),
 * since the central review team has no way to recognize a given business's
 * receipts/products out of context. AI-scored submissions only ever reach
 * staff's queue when confidence is below the auto-approve threshold or
 * scoring fails/isn't configured -- high-confidence ones auto-approve
 * server-side without any human touching them at all.
 */
export function ReviewConsoleHome() {
  const { phone, logout } = useAuth()
  const { show } = useToast()

  const [flags, setFlags] = useState<ReferralFlag[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const fl = await getReferralFlags()
        if (!cancelled) setFlags(fl)
      } catch {
        if (!cancelled) show('خطا در بارگذاری اطلاعات از سرور.', 'danger')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRunBatch = async () => {
    try {
      const result = await runReferralDetection()
      setFlags(result.flags)
      if (result.addedCount > 0) {
        show(`باتچ آنالیز تقلب اجرا شد: ${result.addedCount} هشدار ناهنجاری جدید شناسایی شد.`, 'success')
      } else {
        show('باتچ آنالیز تقلب اجرا شد: هیچ هشدار جدیدی اضافه نشد (موارد فعلی در حال بررسی هستند).', 'info')
      }
    } catch {
      show('خطا در اجرای آنالیز تقلب. دوباره تلاش کنید.', 'danger')
    }
  }

  const handleResolveFlag = async (id: string, decision: 'reviewed' | 'dismissed') => {
    try {
      const result = await apiResolveFlag(id, decision)
      setFlags((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: result.status, notes: result.notes } : f))
      )
      show('وضعیت هشدار به‌روزرسانی شد.', 'success')
    } catch {
      show('خطا در به‌روزرسانی هشدار. دوباره تلاش کنید.', 'danger')
    }
  }

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      <header className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-bold"><span aria-hidden="true">🛡️</span> کنسول بررسی تیم مرکزی</h1>
          <p className="text-slate-400 text-sm mt-1">
            مدیریت هشدارهای تقلب معرفی (بررسی محتوا و ادعاهای خرید بازگشتی اکنون توسط کارمندان هر کسب‌وکار به‌صورت حضوری انجام می‌شود)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">{phone}</span>
          <Button variant="ghost" onClick={logout}>
            خروج
          </Button>
        </div>
      </header>

      <section>
        <div className="flex items-center justify-between gap-4 mb-2">
          <h2 className="text-lg font-semibold"><span aria-hidden="true">🚩</span> صف هشدارهای ناهنجاری معرفی (Referral Flags)</h2>
          <Button variant="secondary" onClick={handleRunBatch} aria-label="اجرای شبیه‌سازی دسته‌ای آنالیز تقلب">
            <span aria-hidden="true">🔄</span> اجرای شبیه‌سازی دسته‌ای آنالیز تقلب
          </Button>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          این هشدارها بر اساس قوانین قانون‌محور (سرعت بیش از ۵ معرفی در روز، یا نسبت بالای دعوت‌های بدون خرید) توسط
          باتچ شبیه‌سازی تولید می‌شوند. این هشدارها صرفاً جنبه اطلاع‌رسانی دارند — پاداش معرفی همچنان بر اساس سه لایه
          دفاعی موجود کنترل می‌شود؛ هیچ اکشن خودکاری از این صف اجرا نمی‌شود.
        </p>
        {loading ? (
          <Card className="text-center text-slate-400">در حال بارگذاری…</Card>
        ) : flags.length === 0 ? (
          <Card className="text-center text-slate-400">
            <div className="text-2xl mb-2" aria-hidden="true">🛡️</div>
            <h3 className="font-medium text-slate-200 mb-1">هیچ هشدار تقلب فعالی وجود ندارد</h3>
            <p className="text-sm">روی دکمه «اجرای شبیه‌سازی دسته‌ای آنالیز تقلب» کلیک کنید.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {flags.map((f) => (
              <Card key={f.id} className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium"><span aria-hidden="true">👤</span> {f.referrerName}</span>
                  <Badge tone={f.status === 'open' ? 'warning' : f.status === 'reviewed' ? 'brand' : 'neutral'}>
                    {f.status === 'open' ? 'در انتظار بررسی' : f.status === 'reviewed' ? 'بررسی شد' : 'رد شده'}
                  </Badge>
                </div>
                <Badge tone="neutral" className="w-fit">
                  {f.ruleNameFa}
                </Badge>
                <p className="text-sm">{f.description}</p>
                <p className="text-xs text-slate-500">شناسایی شده در: {f.triggeredAt}</p>
                {f.notes && (
                  <div className="text-xs bg-brand-500/10 border border-brand-500/20 rounded-xl2 p-3"><span aria-hidden="true">📝</span> {f.notes}</div>
                )}
                {f.status === 'open' && (
                  <div className="flex gap-2 mt-1">
                    <Button variant="secondary" className="flex-1" onClick={() => handleResolveFlag(f.id, 'dismissed')}>
                      رد هشدار (بی‌خطر بود)
                    </Button>
                    <Button className="flex-1" onClick={() => handleResolveFlag(f.id, 'reviewed')}>
                      علامت‌گذاری به‌عنوان بررسی‌شده
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
