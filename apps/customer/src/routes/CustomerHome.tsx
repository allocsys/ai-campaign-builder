import { useEffect, useState } from 'react'
import { Badge, Button, Card, useToast } from '@ai-campaign-builder/ui-kit'
import {
  getCustomerProfile,
  getCustomerTasks,
  getCustomerRewards,
  getCustomerNotifications,
  submitTask,
  redeemReward,
  updateTelegramOptIn,
} from '@ai-campaign-builder/api-client'
import type {
  CustomerProfile,
  CustomerTask,
  CustomerReward,
  CustomerNotification,
} from '@ai-campaign-builder/api-client'
import { buildMicrositeJoinUrl } from '@ai-campaign-builder/shared-config'
import apiClient from '../lib/api-client'
import { TaskSubmitModal } from './TaskSubmitModal'
import { RetroClaimModal } from './RetroClaimModal'

// Item 14, Step D: real business subdomain routing doesn't exist in production
// yet (plan.md Open Item 3, domain undecided; architecture.md's
// business_microsites.subdomain_slug documents the intended shape as
// "{slug}.ourdomain.com" once a real domain is chosen). MICROSITE_DOMAIN
// (packages/shared-config) lets the referral link be built in the intended
// final shape now rather than falling back to the customer-app-direct shape
// apps/microsite's own CTA link uses -- per explicit user decision, matches
// the documented convention even though it won't actually resolve until a
// real domain exists. Shared with apps/business-owner's MicrositeBuilderTab.tsx
// so this placeholder only needs updating in one place once Open Item 3 is
// decided.

function formatCountdown(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatNotificationTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('fa-IR', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

/**
 * Main Customer screen — code/QR card, rewards progress, task list, redemption
 * ticket, retroactive claim entry, notifications feed. Mirrors mockup/customer.html's
 * single-screen layout. All data is now fetched from the real backend via
 * packages/api-client's customer resource (see apps/backend/src/routes/customer.ts).
 */
export function CustomerHome() {
  const { show } = useToast()

  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [tasks, setTasks] = useState<CustomerTask[]>([])
  const [rewards, setRewards] = useState<CustomerReward[]>([])
  const [notifications, setNotifications] = useState<CustomerNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalTask, setModalTask] = useState<CustomerTask | null>(null)
  const [retroOpen, setRetroOpen] = useState(false)
  const [redemption, setRedemption] = useState<{ title: string; code: string; expiresAt: string } | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    let mounted = true
    Promise.all([
      getCustomerProfile(apiClient),
      getCustomerTasks(apiClient),
      getCustomerRewards(apiClient),
      getCustomerNotifications(apiClient),
    ])
      .then(([profileRes, tasksRes, rewardsRes, notificationsRes]) => {
        if (!mounted) return
        setProfile(profileRes)
        setTasks(tasksRes)
        setRewards(rewardsRes)
        setNotifications(notificationsRes)
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  // Countdown ticket driven off the real expiresAt returned by redeemReward,
  // rather than a hardcoded 5-minute window.
  useEffect(() => {
    if (!redemption) {
      setSecondsLeft(0)
      return
    }
    const update = () => {
      const remaining = Math.max(0, Math.round((new Date(redemption.expiresAt).getTime() - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining <= 0) {
        show('مهلت ۵ دقیقه‌ای کد پاداش به پایان رسید.', 'warning')
        setRedemption(null)
      }
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redemption?.expiresAt])

  const refreshRewards = async () => {
    try {
      setRewards(await getCustomerRewards(apiClient))
    } catch {
      // Non-fatal -- rewards list just stays stale until the next full reload.
    }
  }

  const handleTaskSubmit = async (evidenceUrl: string) => {
    if (!modalTask) return
    const taskId = modalTask.id
    try {
      const res = await submitTask(apiClient, taskId, evidenceUrl)
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: res.status } : t)))
      show('مدرک با موفقیت ارسال شد و در صف بررسی قرار گرفت.', 'info')
    } catch (err) {
      show(err instanceof Error ? err.message : 'خطا در ارسال مدرک', 'danger')
    } finally {
      setModalTask(null)
    }
  }

  const handleCopyReferralLink = async () => {
    if (!profile) return
    // micrositeSlug is nullable -- null until the business creates/publishes a
    // microsite (Item 14 Step A). No real link can be built without it.
    if (!profile.micrositeSlug) {
      show('کسب‌وکار شما هنوز میکروسایت ندارد؛ لینک دعوت هنوز آماده نیست.', 'danger')
      return
    }
    const url = buildMicrositeJoinUrl({
      micrositeSlug: profile.micrositeSlug,
      joinSlug: profile.joinSlug,
      ref: profile.personalCode,
    })
    try {
      await navigator.clipboard.writeText(url)
      show(`لینک دعوت (سقف پاداش ${profile.maxReferralCap} معرفی) کپی شد.`, 'success')
    } catch {
      show('خطا در کپی کردن لینک', 'danger')
    }
  }

  const handleRedeem = async (reward: CustomerReward) => {
    try {
      const res = await redeemReward(apiClient, reward.id)
      setProfile((p) => (p ? { ...p, pointsBalance: p.pointsBalance - reward.thresholdPoints } : p))
      setRedemption({ title: reward.title, code: res.redemptionCode, expiresAt: res.expiresAt })
      show('پاداش با موفقیت دریافت شد! کد تحویل در کادر پایین نمایش داده شد.', 'success')
      await refreshRewards()
    } catch (err) {
      show(err instanceof Error ? err.message : 'خطا در دریافت پاداش', 'danger')
    }
  }

  const handleTelegramOptIn = async () => {
    try {
      const res = await updateTelegramOptIn(apiClient, true)
      setProfile((p) => (p ? { ...p, telegramOptedIn: res.telegramOptedIn } : p))
      show('اتصال به تلگرام تایید شد. از این پس پیام‌ها در تلگرام نیز ارسال می‌شوند.', 'success')
    } catch (err) {
      show(err instanceof Error ? err.message : 'خطا در اتصال تلگرام', 'danger')
    }
  }

  if (loading) {
    return <div className="p-4 text-sm text-slate-400 text-center">در حال بارگذاری...</div>
  }

  if (error) {
    return <div className="p-4 text-sm text-red-400 text-center">{error}</div>
  }

  if (!profile) {
    return null
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-4 p-4">
      {/* Code / QR / stats card */}
      <Card className="p-6 text-center bg-gradient-to-br from-slate-900 to-slate-800">
        <p className="text-xs text-slate-400">کد شناسایی اختصاصی شما در {profile.businessName}:</p>
        <p className="text-3xl font-extrabold tracking-widest text-sky-400 my-1">{profile.personalCode}</p>
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
        <p className="text-xs font-semibold text-slate-400">اسکن در صندوق {profile.businessName}</p>
        <div className="mt-3 pt-3 border-t border-glass-border flex justify-around gap-2 flex-wrap">
          <div>
            <p className="text-xs text-slate-400">موجودی امتیاز</p>
            <p className="text-lg font-bold text-emerald-400">{profile.pointsBalance}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">معرفی (سقف {profile.maxReferralCap})</p>
            <p className="text-base font-semibold text-sky-400">
              {profile.referralCount} از {profile.maxReferralCap}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">انتقالی (Carryover)</p>
            <p className="text-base font-semibold text-amber-400">+{profile.carryoverBonus}</p>
          </div>
        </div>
      </Card>

      {/* Telegram opt-in */}
      {!profile.telegramOptedIn ? (
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
          {rewards.map((r) => {
            const percent = Math.min(100, Math.round((profile.pointsBalance / r.thresholdPoints) * 100))
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <strong className="text-sm">{r.title}</strong>
                  <Badge tone={r.unlocked ? 'success' : 'neutral'}>{r.thresholdPoints} امتیاز</Badge>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={Math.min(profile.pointsBalance, r.thresholdPoints)}
                  aria-valuemin={0}
                  aria-valuemax={r.thresholdPoints}
                  aria-label={`پیشرفت پاداش ${r.title}`}
                  className="h-1.5 rounded-full bg-white/10 overflow-hidden"
                >
                  <div
                    className={`h-full rounded-full ${r.unlocked ? 'bg-emerald-500' : 'bg-brand-500'}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-400">{percent}٪ تکمیل</span>
                  {r.unlocked ? (
                    <Button variant="primary" onClick={() => handleRedeem(r)}>
                      <span aria-hidden="true">🎁 </span>دریافت پاداش
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-400">{r.thresholdPoints - profile.pointsBalance} امتیاز تا این جایزه</span>
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
          {tasks.map((t) => {
            const status = t.status
            return (
              <Card key={t.id} className="p-3.5 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <strong className="text-sm">{t.title}</strong>
                    {t.instruction && <p className="text-xs text-slate-400 mt-0.5">{t.instruction}</p>}
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
                        <span className="text-xs text-slate-400">در صف بررسی تیم مرکزی</span>
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
                <span><span aria-hidden="true">{n.channel === 'sms' ? '📱 ' : '✈️ '}</span>{n.channel === 'sms' ? 'پیامک' : 'تلگرام'} • {formatNotificationTime(n.sentAt)}</span>
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
        onClose={() => setRetroOpen(false)}
        onClaimed={() => {
          // Claim recorded server-side; no local claims list needed anymore
          // (dedup/rate-limit enforcement moved to the backend).
        }}
      />
    </div>
  )
}
