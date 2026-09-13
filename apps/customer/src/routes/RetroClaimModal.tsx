import { useState } from 'react'
import { Button, Input, Modal, useToast } from '@ai-campaign-builder/ui-kit'
import { submitRetroClaim, uploadEvidence, ApiError } from '@ai-campaign-builder/api-client'
import type { RetroClaim } from '@ai-campaign-builder/api-client'
import apiClient from '../lib/api-client'

const HOURS_OPTIONS = [
  { value: 12, label: 'امروز (۱۲ ساعت پیش)' },
  { value: 24, label: 'دیروز (۲۴ ساعت پیش)' },
  { value: 48, label: 'دو روز پیش (۴۸ ساعت پیش)' },
  { value: 72, label: 'سه روز پیش (۷۲ ساعت پیش)' },
  { value: 90, label: 'بیش از ۷۲ ساعت پیش (خارج از مهلت)' },
]

interface RetroClaimModalProps {
  open: boolean
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
 * Phase 0.5). Mirrors mockup/customer.html's #retro-claim-modal. The 3 rejection
 * rules (72hr window, receipt-hash dedup, per-customer rate limit) are now
 * enforced server-side (apps/backend/src/routes/customer.ts POST /retro-claims) --
 * this modal just calls the real endpoint and surfaces whichever reason comes back.
 */
export function RetroClaimModal({ open, onClose, onClaimed }: RetroClaimModalProps) {
  const [receiptNumber, setReceiptNumber] = useState('')
  const [hoursAgo, setHoursAgo] = useState(12)
  const [receiptHash, setReceiptHash] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { show } = useToast()

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      // Upload the receipt photo first (same two-step pattern TaskSubmitModal.tsx
      // uses for screenshots) -- this was previously a real gap: the file picker
      // existed but the selected file was never actually sent anywhere, only its
      // name was used as a receiptHash fallback. Now the real evidenceUrl is
      // passed through, which is what lets AI confidence-score the claim and
      // auto-approve/route it to staff instead of leaving every claim to be
      // resolved blind.
      let evidenceUrl: string | undefined
      if (file) {
        try {
          const uploaded = await uploadEvidence(apiClient, file)
          evidenceUrl = uploaded.evidenceUrl
        } catch (uploadErr) {
          if (uploadErr instanceof ApiError && uploadErr.status === 503) {
            show('آپلود تصویر رسید در حال حاضر فعال نیست. ادعا بدون تصویر ثبت می‌شود.', 'warning')
          } else {
            show('آپلود تصویر رسید ناموفق بود. ادعا بدون تصویر ثبت می‌شود.', 'warning')
          }
        }
      }

      const result = await submitRetroClaim(apiClient, {
        receiptHash: receiptHash || file?.name || undefined,
        receiptNumber: receiptNumber || undefined,
        hoursAgo,
        evidenceUrl,
      })
      if (!result.success) {
        show(REASON_MESSAGES[result.reason], 'danger')
        return
      }
      show('ادعای خرید بازگشتی با موفقیت ثبت شد.', 'success')
      onClaimed(result.claim)
      setReceiptNumber('')
      setReceiptHash('')
      setFile(null)
      setHoursAgo(12)
      onClose()
    } catch (err) {
      show(err instanceof Error ? err.message : 'خطا در ثبت ادعا', 'danger')
    } finally {
      setSubmitting(false)
    }
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
          <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <span className="block text-xl mb-1" aria-hidden="true">📷</span>
          <span className="text-sm text-slate-400">
            {file ? `فایل انتخاب شد: ${file.name}` : 'انتخاب فایل رسید'}
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
          تصویر رسید توسط هوش مصنوعی بررسی می‌شود؛ در صورت اطمینان بالا امتیاز بلافاصله اعطا می‌گردد، در غیر این صورت کارمند فروشگاه آن را بررسی می‌کند.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button loading={submitting} onClick={handleSubmit}>ارسال ادعا به صف بررسی</Button>
        </div>
      </div>
    </Modal>
  )
}
