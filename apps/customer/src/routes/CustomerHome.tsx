import { useEffect, useRef, useState } from 'react'
import { Badge, Button, Card, useToast } from '@ai-campaign-builder/ui-kit'
import { useAuth } from '../lib/auth'
import {
  businessName,
  campaignRewards,
  campaignTasks,
  initialNotifications,
  initialProfile,
  processReferralSignup,
  type CampaignTask,
  type NotificationEntry,
  type RetroClaim,
  type SubmissionStatus,
} from '../lib/mock-data'
import { TaskSubmitModal } from './TaskSubmitModal'
import { RetroClaimModal } from './RetroClaimModal'

const REDEMPTION_WINDOW_SECONDS = 5 * 60

function formatCountdown(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Main Customer screen — code/QR card, rewards progress, task list, redemption
 * ticket, retroactive claim entry, notifications feed. Mirrors mockup/customer.html's
 * single-screen layout (no accordion here — the customer flow is linear, unlike
 * Business Owner's multi-section dashboard). All state is in-memory/session-only,
 * same convention as mock-data.ts. TODO: replace each local-state mutation with a
 * real API call as the corresponding backend endpoint comes online.
 */
export function CustomerHome() {
  const { referralCodeUsed } = useAuth()
  const { show } = useToast()

  const [pointsBalance, setPointsBalance] = useState(initialProfile.pointsBalance)
  const [referralCount] = useState(initialProfile.referralCount)
  const [telegramOptedIn, setTelegramOptedIn] = useState(initialProfile.telegramOptedIn)
  const [notifications, setNotifications] = useState<NotificationEntry[]>(initialNotifications)
  const [submissions, setSubmissions] = useState<Record<string, SubmissionStatus>>({})
  const [modalTask, setModalTask] = useState<CampaignTask | null>(null)
  const [retroOpen, setRetroOpen] = useState(false)
  const [retroClaims, setRetroClaims] = useState<RetroClaim[]>([])
  const [redemption, setRedemption] = useState<{ title: string; code: string } | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const processedReferral = useRef(false)

  // One-time referral processing on first mount, mirrors mockup's verifyOtp-time handling.
  useEffect(() => {
    if (processedReferral.current || !referralCodeUsed) return
    processedReferral.current = true
    const result = processReferralSignup(referralCodeUsed, initialProfile.maxReferralCap)
    if (!result.success) {
      show('کد معرف نامعتبر است یا در این کمپین یافت نشد؛ ثبت‌نام بدون معرف انجام شد.', 'warning')
      return
    }
    if (result.capped) {
      show(
        `نکته: معرف شما (${result.referrerLabel}) به سقف ${result.maxCap} معرفی این کمپین رسیده است؛ شما به طور عادی عضو شدید اما امتیاز معرفی اضافی تعلق نمی‌گیرد.`,
        'warning',
      )
    } else {
      show(`کد معرف «${referralCodeUsed}» ثبت شد (امتیاز معرف پس از اولین خرید شما واریز خواهد شد).`, 'success')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referralCodeUsed])

  useEffect(() => {
    if (secondsLeft <= 0) return
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [secondsLeft])

  useEffect(() => {
    if (redemption && secondsLeft === 0) {
      show('مهلت ۵ دقیقه‌ای کد پاداش به پایان رسید.', 'warning')
      setRedemption(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft])

  const addNotification = (channel: NotificationEntry['channel'], trigger: string, text: string) => {
    setNotifications((prev) => [{ id: `n_${Date.now()}`, channel, trigger, text, time: 'همین الان' }, ...prev])
  }

  const handleAiApproveSimulation = (task: CampaignTask) => {
    setSubmissions((prev) => ({ ...prev, [task.id]: 'approved' }))
    setPointsBalance((p) => p + task.pointsValue)
    addNotification('sms', 'submission_reviewed', `تبریک! مدرک تسک «${task.title}» تایید شد و ${task.pointsValue} امتیاز اضافه گردید.`)
    show(`بررسی هوش مصنوعی موفق بود! +${task.pointsValue} امتیاز واریز شد.`, 'success')
  }

  const handleTaskSubmit = () => {
    if (!modalTask) return
    setSubmissions((prev) => ({ ...prev, [modalTask.id]: 'pending' }))
    show('مدرک با موفقیت ارسال شد و در صف بررسی قرار گرفت.', 'info')
    setModalTask(null)
  }

  const handleCopyReferralLink = () => {
    show(`لینک دعوت (سقف پاداش ${initialProfile.maxReferralCap} معرفی) کپی شد.`, 'success')
  }

  const handleRedeem = (title: string, threshold: number) => {
    if (pointsBalance < threshold) return
    setPointsBalance((p) => p - threshold)
    const code = `RDM-${Math.floor(10000 + Math.random() * 90000)}`
    setRedemption({ title, code })
    setSecondsLeft(REDEMPTION_WINDOW_SECONDS)
    addNotification('telegram', 'reward_unlocked', `کد دریافت پاداش ${title}: ${code} به مدت ۵ دقیقه معتبر است.`)
    show('پاداش با موفقیت دریافت شد! کد تحویل در کادر پایین نمایش داده شد.', 'success')
  }

  const handleTelegramOptIn = () => {
    setTelegramOptedIn(true)
    show('اتصال به تلگرام تایید شد. از این پس پیام‌ها در تلگرام نیز ارسال می‌شوند.', 'success')
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-4 p-4">
      {/* Code / QR / stats card */}
      <Card className="p-6 text-center bg-gradient-to-br from-slate-900 to-slate-800">
        <p className="text-xs text-slate-400">کد شناسایی اختصاصی شما در {businessName}:</p>
        <p className="text-3xl font-extrabold tracking-widest text-sky-400 my-1">{initialProfile.personalCode}</p>
        <div
          role="img"
          aria-label="کد QR اختصاصی مشتری جهت شناسایی در صندوق و ثبت امتیاز"
          className="mx-auto my-3 grid grid-cols-6 gap-1 w-32"
        >
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              aria-hidden="true"
              className={`aspect-square rounded-sm ${i % 5 === 0 ? 'bg-transparent' : 'bg-slate-100'}`}
            />
          ))}
        </div>
        <p className="text-xs font-semibold text-slate-400">اسکن در صندوق {businessName}</p>
        <div className="mt-3 pt-3 border-t border-glass-border flex justify-around gap-2 flex-wrap">
          <div>
            <p className="text-xs text-slate-400">موجودی امتیاز</p>
            <p className="text-lg font-bold text-emerald-400">{pointsBalance}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">معرفی (سقف {initialProfile.maxReferralCap})</p>
            <p className="text-base font-semibold text-sky-400">
              {referralCount} از {initialProfile.maxReferralCap}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">انتقالی (Carryover)</p>
            <p className="text-base font-semibold text-amber-400">+{initialProfile.carryoverBonus}</p>
          </div>
        </div>
      </Card>

      {/* Telegram opt-in */}
      {!telegramOptedIn ? (
        <Card className="p-4 flex items-center justify-between">
          <span className="text-sm"><span aria-hidden="true">✈️ </span>دریافت نوتیفیکیشن‌ها در تلگرام</span>
          <Button variant="secondary" onClick={handleTelegramOptIn}>
            فعال‌سازی در بات
          </Button>
        </Card>
      ) : (
        <Card className="p-4">
          <span className="text-sm"><span aria-hidden="true">✅ </span>اتصال به تلگرام فعال شد</span>
        </Card>
      )}

      {/* Retroactive claim entry */}
      <Card className="p-5 text-center border-2 border-dashed border-glass-border">
        <h3 className="text-sm font-semibold mb-1"><span aria-hidden="true">❓ </span>فراموش کردید کد خود را در صندوق اسکن کنید؟</h3>
        <p className="text-xs text-slate-400 mb-3">
          می‌توانید رسید خرید یا سفارش خود را تا ۷۲ ساعت بعد آپلود کنید تا پس از بررسی تیم مرکزی امتیاز شما ثبت شود.
        </p>
        <Button variant="secondary" onClick={() => setRetroOpen(true)}>
          <span aria-hidden="true">🧾 </span>ثبت ادعای خرید بازگشتی
        </Button>
      </Card>

      {/* Rewards progress */}
      <div>
        <h3 className="text-sm font-semibold mb-2 text-slate-300"><span aria-hidden="true">🎁 </span>پیشرفت تا پاداش‌ها</h3>
        <div className="flex flex-col gap-3">
          {campaignRewards.map((r) => {
            const canRedeem = pointsBalance >= r.thresholdPoints
            const percent = Math.min(100, Math.round((pointsBalance / r.thresholdPoints) * 100))
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <strong className="text-sm">{r.title}</strong>
                  <Badge tone={canRedeem ? 'success' : 'neutral'}>{r.thresholdPoints} امتیاز</Badge>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={Math.min(pointsBalance, r.thresholdPoints)}
                  aria-valuemin={0}
                  aria-valuemax={r.thresholdPoints}
                  aria-label={`پیشرفت پاداش ${r.title}`}
                  className="h-1.5 rounded-full bg-white/10 overflow-hidden"
                >
                  <div
                    className={`h-full rounded-full ${canRedeem ? 'bg-emerald-500' : 'bg-brand-500'}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-400">{percent}٪ تکمیل</span>
                  {canRedeem ? (
                    <Button variant="primary" onClick={() => handleRedeem(r.title, r.thresholdPoints)}>
                      <span aria-hidden="true">🎁 </span>دریافت پاداش
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-400">{r.thresholdPoints - pointsBalance} امتیاز تا این جایزه</span>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Tasks */}
      <div>
        <h3 className="text-sm font-semibold mb-2 text-slate-300"><span aria-hidden="true">⚡ </span>تسک‌های دریافت امتیاز</h3>
        <div className="flex flex-col gap-2">
          {campaignTasks.map((t) => {
            const status = submissions[t.id] ?? null
            return (
              <Card key={t.id} className="p-3.5 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <strong className="text-sm">{t.title}</strong>
                    <p className="text-xs text-slate-400 mt-0.5">{t.instruction}</p>
                  </div>
                  <Badge tone="brand">+{t.pointsValue}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    {status === 'approved' ? (
                      <Badge tone="success">تایید شده</Badge>
                    ) : status === 'pending' ? (
                      <Badge tone="warning">در انتظار بررسی</Badge>
                    ) : (
                      <Badge tone="neutral">انجام نشده</Badge>
                    )}
                  </div>
                  <div>
                    {t.verificationMethod === 'screenshot_ai' ? (
                      status === 'approved' ? (
                        <span className="text-xs text-emerald-400">✓ امتیاز ثبت شد</span>
                      ) : status === 'pending' ? (
                        <Button variant="secondary" onClick={() => handleAiApproveSimulation(t)}>
                          <span aria-hidden="true">🤖 </span>شبیه‌سازی بررسی AI
                        </Button>
                      ) : (
                        <Button onClick={() => setModalTask(t)}><span aria-hidden="true">📷 </span>ارسال مدرک</Button>
                      )
                    ) : t.verificationMethod === 'code_link_auto' ? (
                      <Button variant="secondary" onClick={handleCopyReferralLink}>
                        <span aria-hidden="true">🔗 </span>کپی لینک دعوت
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">اسکن خودکار در صندوق</span>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Redemption ticket */}
      {redemption && (
        <Card className="p-6 text-center border-2 border-dashed border-emerald-500/50 bg-emerald-500/5">
          <Badge tone="success">کد یک‌بار مصرف تحویل جایزه به صندوقدار</Badge>
          <h3 className="text-base font-semibold mt-3 mb-1">{redemption.title}</h3>
          <p className="text-2xl font-black tracking-widest text-emerald-400 my-2">{redemption.code}</p>
          <p className="text-xs text-emerald-300 mb-2">این کد را جهت دریافت جایزه به صندوقدار نشان دهید.</p>
          <div className="bg-emerald-500/10 rounded-xl2 py-1.5 text-sm font-bold text-emerald-300">
            <span aria-hidden="true">⏱️ </span>زمان باقی‌مانده تا ابطال کد: {formatCountdown(secondsLeft)}
          </div>
        </Card>
      )}

      {/* Notifications feed */}
      <div>
        <h3 className="text-sm font-semibold mb-2 text-slate-300"><span aria-hidden="true">🔔 </span>پیامک‌ها و اطلاعیه‌های دریافتی</h3>
        <Card className="p-0 divide-y divide-glass-border overflow-hidden">
          {notifications.slice(0, 4).map((n) => (
            <div key={n.id} className="p-3 text-sm">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span><span aria-hidden="true">{n.channel === 'sms' ? '📱 ' : '✈️ '}</span>{n.channel === 'sms' ? 'پیامک' : 'تلگرام'} • {n.time}</span>
                <Badge tone="neutral">{n.trigger}</Badge>
              </div>
              <p>{n.text}</p>
            </div>
          ))}
        </Card>
      </div>

      <TaskSubmitModal task={modalTask} onClose={() => setModalTask(null)} onSubmit={handleTaskSubmit} />
      <RetroClaimModal
        open={retroOpen}
        existingClaims={retroClaims}
        onClose={() => setRetroOpen(false)}
        onClaimed={(claim) => setRetroClaims((prev) => [...prev, claim])}
      />
    </div>
  )
}
