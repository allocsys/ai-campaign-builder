import { useState } from 'react'
import { Button, Input, Modal, useToast } from '@ai-campaign-builder/ui-kit'
import { submitRetroactivePurchaseClaim, type RetroClaim } from '../lib/mock-data'

const HOURS_OPTIONS = [
  { value: 12, label: 'امروز (۱۲ ساعت پیش)' },
  { value: 24, label: 'دیروز (۲۴ ساعت پیش)' },
  { value: 48, label: 'دو روز پیش (۴۸ ساعت پیش)' },
  { value: 72, label: 'سه روز پیش (۷۲ ساعت پیش)' },
  { value: 90, label: 'بیش از ۷۲ ساعت پیش (خارج از مهلت)' },
]

interface RetroClaimModalProps {
  open: boolean
  existingClaims: RetroClaim[]
  onClose: () => void
  onClaimed: (claim: RetroClaim) => void
}

const REASON_MESSAGES: Record<string, string> = {
  outside_time_window: 'خطا: مهلت ارسال ادعای خرید بازگشتی (حداکثر ۷۲ ساعت) به پایان رسیده است.',
  duplicate_receipt: 'خطا: این رسید قبلاً ثبت شده است (تشخیص رسید تکراری).',
  rate_limited: 'خطا: شما به سقف مجاز ادعای خرید بازگشتی در این کمپین (۳ بار) رسیده‌اید.',
}

/**
 * Retroactive purchase claim modal — fallback for a missed POS scan (plan.md
 * Phase 0.5). Mirrors mockup/customer.html's #retro-claim-modal + the 3 rejection
 * rules from shared/app.js's submitRetroactivePurchaseClaim (48-72hr window,
 * receipt-hash dedup, per-customer rate limit).
 */
export function RetroClaimModal({ open, existingClaims, onClose, onClaimed }: RetroClaimModalProps) {
  const [receiptNumber, setReceiptNumber] = useState('')
  const [hoursAgo, setHoursAgo] = useState(12)
  const [receiptHash, setReceiptHash] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const { show } = useToast()

  const handleSubmit = () => {
    const result = submitRetroactivePurchaseClaim(
      existingClaims,
      receiptHash || fileName || '',
      receiptNumber,
      hoursAgo,
    )
    if (!result.success) {
      show(REASON_MESSAGES[result.reason], 'danger')
      return
    }
    show('ادعای خرید بازگشتی با موفقیت ثبت شد و به صف بررسی دستی منتقل گردید.', 'success')
    onClaimed(result.claim)
    setReceiptNumber('')
    setReceiptHash('')
    setFileName(null)
    setHoursAgo(12)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="ثبت ادعای خرید بازگشتی (فراموشی اسکن)">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-400">
          رسید فیزیکی یا اسکرین‌شات سفارش آنلاین خود را بارگذاری کرده و در صورت نیاز شماره رسید را وارد کنید.
        </p>
        <Input
          label="شماره رسید / فاکتور (اختیاری)"
          placeholder="مثال: RCP-8492"
          value={receiptNumber}
          onChange={(e) => setReceiptNumber(e.target.value)}
        />
        <label className="border-2 border-dashed border-glass-border rounded-xl2 p-5 text-center cursor-pointer hover:bg-white/5 transition-colors">
          <input type="file" className="hidden" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} />
          <span className="block text-xl mb-1" aria-hidden="true">📷</span>
          <span className="text-sm text-slate-400">
            {fileName ? `فایل انتخاب شد: ${fileName}` : 'انتخاب فایل رسید'}
          </span>
        </label>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-300">زمان خرید (مهلت قانونی: ۴۸ تا ۷۲ ساعت)</label>
          <select
            value={hoursAgo}
            onChange={(e) => setHoursAgo(Number(e.target.value))}
            className="bg-glass-light backdrop-blur-md border border-glass-border rounded-xl2 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-brand-500/60"
          >
            {HOURS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-slate-900">
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="شبیه‌سازی رسید تکراری (Duplicate Hash)"
          placeholder="خالی بگذارید یا هش تکراری برای تست وارد کنید"
          value={receiptHash}
          onChange={(e) => setReceiptHash(e.target.value)}
        />
        <p className="text-xs text-slate-500">
          ادعاهای خرید بازگشتی به دلیل عدم حضور صندوق‌دار با ضریب اطمینان احتیاطی (بررسی دستی) ثبت می‌شوند.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button onClick={handleSubmit}>ارسال ادعا به صف بررسی</Button>
        </div>
      </div>
    </Modal>
  )
}
