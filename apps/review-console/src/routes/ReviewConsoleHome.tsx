import { useState } from 'react'
import { Badge, Button, Card, useToast } from '@ai-campaign-builder/ui-kit'
import { useAuth } from '../lib/auth'
import {
  initialFlags,
  initialSubmissions,
  referrerAggregates,
  resolveFlag,
  resolveSubmission,
  runReferralAnomalyDetection,
  type ReferralFlag,
  type TaskSubmission,
} from '../lib/mock-data'

/**
 * Central-team review console — two sections, 1:1 port of
 * mockup/review-console.html's renderSubmissions()/renderFlags():
 * (1) uncertain AI submissions + retroactive purchase claims queue
 * (2) referral anomaly flags queue with a batch-detection trigger
 */
export function ReviewConsoleHome() {
  const { phone, logout } = useAuth()
  const { show } = useToast()

  const [submissions, setSubmissions] = useState<TaskSubmission[]>(initialSubmissions)
  const [flags, setFlags] = useState<ReferralFlag[]>(initialFlags)

  const pending = submissions.filter((s) => s.status === 'pending')

  const handleResolveSubmission = (id: string, decision: 'approved' | 'rejected') => {
    const result = resolveSubmission(submissions, id, decision, phone ?? 'unknown')
    if (!result) return
    setSubmissions(result.submissions)
    if (decision === 'approved') {
      show(`تایید شد — ${result.pointsAwarded} امتیاز به ${result.customerName} اعطا شد.`, 'success')
    } else {
      show(`رد شد — به ${result.customerName} اطلاع داده شد که می‌تواند دوباره ارسال کند.`, 'danger')
    }
  }

  const handleRunBatch = () => {
    const result = runReferralAnomalyDetection(referrerAggregates, flags)
    setFlags(result.flags)
    if (result.addedCount > 0) {
      show(`باتچ آنالیز تقلب اجرا شد: ${result.addedCount} هشدار ناهنجاری جدید شناسایی شد.`, 'success')
    } else {
      show('باتچ آنالیز تقلب اجرا شد: هیچ هشدار جدیدی اضافه نشد (موارد فعلی در حال بررسی هستند).', 'info')
    }
  }

  const handleResolveFlag = (id: string, decision: 'reviewed' | 'dismissed') => {
    setFlags(resolveFlag(flags, id, decision))
    show('وضعیت هشدار به‌روزرسانی شد.', 'success')
  }

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      <header className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-bold"><span aria-hidden="true">🛡️</span> کنسول بررسی تیم مرکزی</h1>
          <p className="text-slate-400 text-sm mt-1">
            بررسی موارد نامطمئن هوش مصنوعی، ادعاهای خرید بازگشتی و مدیریت هشدارهای تقلب معرفی
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">{phone}</span>
          <Button variant="ghost" onClick={logout}>
            خروج
          </Button>
        </div>
      </header>

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4">
          <span aria-hidden="true">📋</span> صف بررسی دستی — موارد نامطمئن AI و ادعاهای خرید بازگشتی
        </h2>
        {pending.length === 0 ? (
          <Card className="text-center text-emerald-300">همه‌ی موارد نامطمئن و ادعاها بررسی شدند. <span aria-hidden="true">✓</span></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {pending.map((s) => {
              const isRetro = s.submissionType === 'retroactive_purchase_claim'
              return (
                <Card key={s.id} className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium"><span aria-hidden="true">📎</span> {s.taskTitle}</span>
                    {isRetro ? (
                      <Badge tone="warning">ادعای خرید بازگشتی (رسید)</Badge>
                    ) : (
                      <Badge tone="warning">اعتماد AI: {s.aiConfidenceScore}٪</Badge>
                    )}
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>
                      <strong className="text-slate-300">کاربر:</strong> {s.customerName}
                    </span>
                    <span>{s.submittedAt}</span>
                  </div>
                  {s.receiptNumber && (
                    <div className="text-xs text-amber-400">
                      <strong>شماره رسید:</strong> {s.receiptNumber}
                    </div>
                  )}
                  <div className="bg-white/5 border border-dashed border-white/15 rounded-xl2 p-4 text-center text-xs text-slate-400">
                    <span aria-hidden="true">🖼️</span> فایل پیوست / رسید: <code>{s.evidenceUrl}</code>
                  </div>
                  {s.notes && <div className="text-xs bg-brand-500/10 border border-brand-500/20 rounded-xl2 p-3">{s.notes}</div>}
                  <div className="flex gap-2 mt-1">
                    <Button variant="danger" className="flex-1" onClick={() => handleResolveSubmission(s.id, 'rejected')} aria-label="رد کردن">
                      <span aria-hidden="true">✕</span> رد کردن
                    </Button>
                    <Button className="flex-1" onClick={() => handleResolveSubmission(s.id, 'approved')} aria-label="تایید و اعطای امتیاز">
                      <span aria-hidden="true">✓</span> تایید و اعطای امتیاز
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

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
        {flags.length === 0 ? (
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
