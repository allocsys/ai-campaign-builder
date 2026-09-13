import { useState, useEffect } from 'react'
import { Badge, Button, Card, Input, useToast } from '@ai-campaign-builder/ui-kit'
import { useAuth } from '../lib/auth'
import {
  getCustomerByCode,
  logPurchase,
  getRedemptionByCode,
  fulfillRedemption,
  syncOfflineQueue,
  getActivity,
  getPendingSubmissions,
  resolveSubmission,
  getSubmissionEvidenceBlob,
} from '../lib/api-client'

type Tab = 'purchase' | 'fulfill' | 'queue' | 'screenshots'

interface CustomerLookupData {
  personalCode: string
  name: string
  pointsBalance: number
  campaignId: string
}

interface RedemptionLookupData {
  code: string
  rewardTitle: string
  customerName: string
  customerCode: string
  pointsDeducted: number
}

interface ActivityEntryData {
  id: string
  type: 'purchase' | 'fulfill'
  text: string
  time: string
  status: 'synced' | 'queued'
}

interface OfflineQueueItemData {
  id: string
  idempotencyKey: string
  personalCode?: string
  redemptionCode?: string
  campaignId: string
  actionType: 'purchase' | 'fulfill_reward'
  amountToman: number
  pointsAwarded: number
  createdAt: string
}

interface SyncResultData {
  itemId: string
  idempotencyKey: string
  actionType: OfflineQueueItemData['actionType']
  status: 'synced' | 'duplicate_skipped' | 'invalid_skipped'
  pointsAwarded?: number
  reason: string
}

// Firsthand verification queue -- social_proof/review_ugc screenshot
// submissions (Instagram story/post shares, written reviews) AND
// receipt_claim submissions (retroactive purchase claims) both moved out of
// the central review console so staff can check them firsthand, instead of
// routing through the central review team, which has no way to recognize a
// given business's receipts/products out of context. A submission only ever
// reaches this queue when its AI confidence score was below the auto-approve
// threshold, or scoring failed/wasn't configured -- high-confidence ones are
// auto-approved server-side before staff ever see them. Shape matches
// apps/backend/src/routes/staff-pos.ts's /submissions response.
interface PendingSubmissionData {
  id: string
  customerName: string
  taskTitle: string
  submissionType: 'screenshot' | 'receipt_claim'
  taskPattern: 'social_proof' | 'review_ugc' | null
  evidenceUrl: string | null
  receiptNumber: string | null
  aiConfidenceScore: number | null
  status: 'pending' | 'approved' | 'rejected'
  pointsAwarded: number | null
  submittedAt: string
  taskPointsValue: number
}

const ACTIVE_CAMPAIGN_ID = 'c_narvan_autumn'

// Estimate only, shown in the pre-submit preview line below -- there's no
// endpoint yet to fetch this campaign's actual configured pos_scan
// points_value ahead of time. The REAL awarded amount always comes back from
// the backend on submit (StaffPosLogPurchaseResponse.pointsAwarded) or sync
// (StaffPosSyncResultItem.pointsAwarded) and is what's actually displayed and
// recorded once known -- this constant must never be used as if it were the
// confirmed award amount. Previously it was used for exactly that (silent
// drift risk: any campaign whose real pos_scan task isn't worth exactly this
// many points would show staff/customers the wrong number while the ledger
// recorded the correct one), same bug shape as the dead Gemini model names
// fixed in PR #72.
const ESTIMATED_PURCHASE_POINTS = 60

function formatToman(amount: number): string {
  return `${amount.toLocaleString('fa-IR')} تومان`
}

function makeIdempotencyKey(prefix: string, deviceId = 'staffDevA'): string {
  return `${prefix}_${Date.now()}_${deviceId}`
}

/**
 * Main Staff POS screen — 3 tabs (log purchase, fulfill reward, offline queue),
 * an offline-mode simulation toggle / browser online-status listener, and a recent-activity feed.
 * Rewired to call the real backend API client instead of mock data.
 */
export function StaffPosHome() {
  const { logout } = useAuth()
  const { show } = useToast()

  const [tab, setTab] = useState<Tab>('purchase')
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [activities, setActivities] = useState<ActivityEntryData[]>([])
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItemData[]>([])
  const [syncedKeys, setSyncedKeys] = useState<Set<string>>(new Set())
  const [lastSyncResults, setLastSyncResults] = useState<SyncResultData[] | null>(null)

  // Screenshots tab state
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingSubmissionData[]>([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  const [evidenceImageUrls, setEvidenceImageUrls] = useState<Record<string, string>>({})
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  // Purchase tab state
  const [customerCode, setCustomerCode] = useState('48291')
  const [foundCustomer, setFoundCustomer] = useState<CustomerLookupData | null>(null)
  const [purchaseAmount, setPurchaseAmount] = useState('180000')

  // Fulfill tab state
  const [redemptionCode, setRedemptionCode] = useState('')
  const [foundRedemption, setFoundRedemption] = useState<RedemptionLookupData | null>(null)

  // Initial load of activities and initial customer lookup
  useEffect(() => {
    getActivity()
      .then((res: any) => {
        if (Array.isArray(res)) {
          setActivities(res)
        }
      })
      .catch(() => {
        // Fallback default activities if backend not reachable on start
        setActivities([
          { id: 'a1', type: 'purchase', text: 'ثبت فاکتور ۲۴۰,۰۰۰ تومان برای کد 33812 (+۶۰ امتیاز)', time: '۱۵ دقیقه پیش', status: 'synced' },
        ])
      })

    // Initial customer lookup for default code '48291'
    getCustomerByCode('48291')
      .then((cust: CustomerLookupData) => {
        if (cust) setFoundCustomer(cust)
      })
      .catch(() => {
        // Non-fatal if offline on load
      })
  }, [])

  // Load the pending screenshot queue the first time the tab is opened, and
  // fetch each submission's evidence image as an object URL (the image is
  // served through an authenticated proxy, not a public URL -- see
  // getSubmissionEvidenceBlob). Object URLs are revoked on unmount to avoid
  // leaking memory.
  useEffect(() => {
    if (tab !== 'screenshots') return
    let cancelled = false
    setLoadingSubmissions(true)
    getPendingSubmissions('pending')
      .then(async (subs: PendingSubmissionData[]) => {
        if (cancelled) return
        setPendingSubmissions(subs)
        for (const s of subs) {
          if (!s.evidenceUrl) continue
          try {
            const blob = await getSubmissionEvidenceBlob(s.id)
            if (cancelled) return
            setEvidenceImageUrls((prev) => ({ ...prev, [s.id]: URL.createObjectURL(blob) }))
          } catch {
            // Non-fatal per item -- the card just shows a fallback below.
          }
        }
      })
      .catch(() => {
        if (!cancelled) show('خطا در بارگذاری صف بررسی اسکرین‌شات.', 'danger')
      })
      .finally(() => {
        if (!cancelled) setLoadingSubmissions(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  useEffect(() => {
    return () => {
      Object.values(evidenceImageUrls).forEach((url) => URL.revokeObjectURL(url))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleResolveScreenshot = async (submission: PendingSubmissionData, decision: 'approved' | 'rejected') => {
    setResolvingId(submission.id)
    try {
      const result = await resolveSubmission(submission.id, decision)
      setPendingSubmissions((prev) => prev.filter((s) => s.id !== submission.id))
      const url = evidenceImageUrls[submission.id]
      if (url) URL.revokeObjectURL(url)
      if (decision === 'approved') {
        addActivity({
          type: 'purchase',
          text: `تایید محتوا (${submission.taskTitle}) برای ${submission.customerName} (+${result.pointsAwarded} امتیاز)`,
          time: 'همین الان',
          status: 'synced',
        })
        show(`تایید شد — ${result.pointsAwarded} امتیاز به ${submission.customerName} اعطا شد.`, 'success')
      } else {
        show(`رد شد — به ${submission.customerName} اطلاع داده می‌شود که می‌تواند دوباره ارسال کند.`, 'danger')
      }
    } catch (err) {
      show(err instanceof Error ? err.message : 'خطا در ثبت تصمیم. دوباره تلاش کنید.', 'danger')
    } finally {
      setResolvingId(null)
    }
  }

  // Listen to browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false)
      show('اتصال اینترنت برقرار شد. در حال همگام‌سازی صف آفلاین...', 'info')
      handleSync()
    }
    const handleOffline = () => {
      setIsOffline(true)
      show('اینترنت قطع شد. دستگاه به حالت آفلاین رفت.', 'warning')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [offlineQueue, syncedKeys])

  const addActivity = (entry: Omit<ActivityEntryData, 'id'>) => {
    setActivities((prev) => [{ id: `act_${Date.now()}`, ...entry }, ...prev])
  }

  const handleScanCustomer = async (code: string) => {
    setCustomerCode(code)
    try {
      const cust = await getCustomerByCode(code)
      setFoundCustomer(cust)
      show(`بارکد مشتری خوانده شد: ${code}`, 'info')
    } catch (err) {
      setFoundCustomer(null)
      show(err instanceof Error ? err.message : 'مشتری یافت نشد', 'danger')
    }
  }

  const handleScanRedemption = async (code: string) => {
    setRedemptionCode(code)
    try {
      const rdm = await getRedemptionByCode(code)
      setFoundRedemption(rdm)
      show(`بارکد پاداش شناسایی شد: ${code}`, 'info')
    } catch (err) {
      setFoundRedemption(null)
      show(err instanceof Error ? err.message : 'کد پاداش معتبر نیست', 'danger')
    }
  }

  const handleSubmitPurchase = async () => {
    const code = customerCode.trim() || '48291'
    const amount = Number(purchaseAmount) || 180000
    const idempotencyKey = makeIdempotencyKey(code)

    if (isOffline) {
      setOfflineQueue((prev) => [
        ...prev,
        {
          id: `q_${Date.now()}`,
          idempotencyKey,
          personalCode: code,
          campaignId: ACTIVE_CAMPAIGN_ID,
          actionType: 'purchase',
          amountToman: amount,
          pointsAwarded: ESTIMATED_PURCHASE_POINTS,
          createdAt: 'همین الان',
        },
      ])
      addActivity({
        type: 'purchase',
        text: `ثبت فاکتور ${formatToman(amount)} برای کد ${code} (امتیاز پس از همگام‌سازی نهایی می‌شود)`,
        time: 'همین الان',
        status: 'queued',
      })
      show('تراکنش در صف آفلاین دستگاه ذخیره شد و پس از اتصال اینترنت همگام می‌شود.', 'warning')
    } else {
      try {
        // pointsAwarded here is the real, backend-configured value for this
        // campaign's pos_scan task (apps/backend/src/routes/staff-pos.ts) --
        // never assume it equals ESTIMATED_PURCHASE_POINTS, which is only a
        // pre-submit guess and can silently drift from the real per-campaign
        // config.
        const result = await logPurchase({
          idempotencyKey,
          personalCode: code,
          amountToman: amount,
        })
        setSyncedKeys((prev) => new Set(prev).add(idempotencyKey))
        if (result.status === 'duplicate_skipped') {
          addActivity({
            type: 'purchase',
            text: `فاکتور برای کد ${code} قبلاً ثبت شده بود (تکراری، امتیاز مجدد اعطا نشد).`,
            time: 'همین الان',
            status: 'synced',
          })
          show('این تراکنش قبلاً ثبت شده بود؛ امتیازی دوباره اعطا نشد.', 'info')
        } else {
          const awarded = result.pointsAwarded ?? 0
          addActivity({
            type: 'purchase',
            text: `ثبت فاکتور ${formatToman(amount)} برای کد ${code} (+${awarded} امتیاز)`,
            time: 'همین الان',
            status: 'synced',
          })
          show(`خرید با موفقیت ثبت شد و ${awarded} امتیاز به کد ${code} اعطا گردید.`, 'success')
        }
      } catch (err) {
        // Fallback to queue if network error occurs during submission -- the
        // real awarded amount isn't known until this item is synced (see the
        // "نتایج آخرین همگام‌سازی" card), so don't assert a specific number here.
        setOfflineQueue((prev) => [
          ...prev,
          {
            id: `q_${Date.now()}`,
            idempotencyKey,
            personalCode: code,
            campaignId: ACTIVE_CAMPAIGN_ID,
            actionType: 'purchase',
            amountToman: amount,
            pointsAwarded: ESTIMATED_PURCHASE_POINTS,
            createdAt: 'همین الان',
          },
        ])
        addActivity({
          type: 'purchase',
          text: `ثبت فاکتور ${formatToman(amount)} برای کد ${code} (امتیاز پس از همگام‌سازی نهایی می‌شود)`,
          time: 'همین الان',
          status: 'queued',
        })
        show('خطای شبکه رخ داد. تراکنش در صف آفلاین ذخیره شد.', 'warning')
      }
    }

    setCustomerCode('')
    setFoundCustomer(null)
  }

  const handleSubmitFulfill = async () => {
    const code = redemptionCode.trim() || 'RDM-84920'
    const idempotencyKey = makeIdempotencyKey(`rdm_${code}`)

    if (isOffline) {
      setOfflineQueue((prev) => [
        ...prev,
        {
          id: `q_${Date.now()}`,
          idempotencyKey,
          redemptionCode: code,
          campaignId: ACTIVE_CAMPAIGN_ID,
          actionType: 'fulfill_reward',
          amountToman: 0,
          pointsAwarded: 0,
          createdAt: 'همین الان',
        },
      ])
      addActivity({
        type: 'fulfill',
        text: `تحویل پاداش با کد ${code}`,
        time: 'همین الان',
        status: 'queued',
      })
      show('تحویل پاداش در صف آفلاین ذخیره شد (راستی‌آزمایی مضاعف در سرور انجام خواهد شد).', 'warning')
    } else {
      try {
        await fulfillRedemption(code)
        addActivity({
          type: 'fulfill',
          text: `تحویل پاداش با کد ${code}`,
          time: 'همین الان',
          status: 'synced',
        })
        show(`پاداش ${code} با موفقیت در سیستم باطل و تحویل داده شد.`, 'success')
      } catch (err) {
        setOfflineQueue((prev) => [
          ...prev,
          {
            id: `q_${Date.now()}`,
            idempotencyKey,
            redemptionCode: code,
            campaignId: ACTIVE_CAMPAIGN_ID,
            actionType: 'fulfill_reward',
            amountToman: 0,
            pointsAwarded: 0,
            createdAt: 'همین الان',
          },
        ])
        addActivity({
          type: 'fulfill',
          text: `تحویل پاداش با کد ${code}`,
          time: 'همین الان',
          status: 'queued',
        })
        show('خطای شبکه رخ داد. تحویل پاداش در صف آفلاین ذخیره شد.', 'warning')
      }
    }

    setRedemptionCode('')
    setFoundRedemption(null)
  }

  const handleToggleOffline = (next: boolean) => {
    setIsOffline(next)
    if (next) {
      show('دستگاه به حالت آفلاین رفت. کلیه عملیات در صف آفلاین ذخیره خواهند شد.', 'warning')
    } else {
      handleSync()
    }
  }

  const handleSync = async () => {
    if (offlineQueue.length === 0) {
      show('صف آفلاین خالی است؛ اتصال به سرور برقرار و پایدار است.', 'success')
      return
    }
    show(`در حال همگام‌سازی و راستی‌آزمایی ${offlineQueue.length} آیتم صف آفلاین با سرور مرکزی...`, 'info')

    try {
      const res = await syncOfflineQueue({ items: offlineQueue })
      const results: SyncResultData[] = res.results || []
      // The real backend dedups via the idempotency_key DB index and doesn't
      // echo back a separate "newly synced" list -- derive it from results
      // instead (both 'synced' and 'duplicate_skipped' mean the server
      // already has this key recorded, so it's safe to stop tracking locally).
      const newlySynced: string[] = results
        .filter((r) => r.status === 'synced' || r.status === 'duplicate_skipped')
        .map((r) => r.idempotencyKey)

      setSyncedKeys((prev) => {
        const next = new Set(prev)
        newlySynced.forEach((k) => next.add(k))
        return next
      })
      setOfflineQueue([])
      setLastSyncResults(results)

      const successCount = results.filter((r: any) => r.status === 'synced').length
      const dupCount = results.filter((r: any) => r.status === 'duplicate_skipped').length
      const invalidCount = results.filter((r: any) => r.status === 'invalid_skipped').length
      show(
        `همگام‌سازی کامل شد: ${successCount} موفق، ${dupCount} تکراری رد شد، ${invalidCount} نامعتبر رد شد.`,
        successCount > 0 ? 'success' : 'warning',
      )
    } catch (err) {
      show(err instanceof Error ? err.message : 'خطا در ارتباط با سرور هنگام همگام‌سازی', 'danger')
    }
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-4 p-4">
      {/* Header */}
      <Card className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden="true">🧾</span>
          <strong className="text-sm">صندوق کافه نارون</strong>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={isOffline ? 'danger' : 'success'}>
            {isOffline ? 'آفلاین (بدون اینترنت)' : 'آنلاین (متصل به سرور)'}
          </Badge>
          <Button variant="ghost" onClick={logout}>
            خروج
          </Button>
        </div>
      </Card>

      {/* Offline mode toggle */}
      <Card className="p-3.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300">شبیه‌سازی قطعی اینترنت (حالت آفلاین)</span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={isOffline}
            onChange={(e) => handleToggleOffline(e.target.checked)}
          />
          <div className="w-10 h-5 bg-white/15 peer-checked:bg-red-500/70 rounded-full transition-colors" />
          <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:-translate-x-5" />
        </label>
      </Card>

      {isOffline && (
        <Card className="p-3 border-2 border-dashed border-red-500/40 flex items-center justify-between" role="img" aria-label="هشدار: اینترنت قطع است — عملیات در صف آفلاین ذخیره خواهند شد">
          <span className="text-xs text-red-300"><span aria-hidden="true">⚠️</span> اینترنت قطع است — عملیات در صف آفلاین ذخیره خواهند شد</span>
          <Badge tone="danger">{offlineQueue.length} در صف</Badge>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <Button variant={tab === 'purchase' ? 'primary' : 'secondary'} onClick={() => setTab('purchase')} className="flex-1">
          <span aria-hidden="true">🛒</span> ثبت فاکتور
        </Button>
        <Button variant={tab === 'fulfill' ? 'primary' : 'secondary'} onClick={() => setTab('fulfill')} className="flex-1">
          <span aria-hidden="true">🎁</span> تحویل پاداش
        </Button>
        <Button variant={tab === 'queue' ? 'primary' : 'secondary'} onClick={() => setTab('queue')} className="flex-1">
          <span aria-hidden="true">📥</span> صف ({offlineQueue.length})
        </Button>
        <Button variant={tab === 'screenshots' ? 'primary' : 'secondary'} onClick={() => setTab('screenshots')} className="flex-1">
          <span aria-hidden="true">📸</span> بررسی محتوا ({pendingSubmissions.length})
        </Button>
      </div>

      {/* Purchase tab */}
      {tab === 'purchase' && (
        <Card className="p-4 flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              label="کد یا بارکد مشتری"
              placeholder="کد ۵ رقمی"
              value={customerCode}
              onChange={async (e) => {
                const val = e.target.value
                setCustomerCode(val)
                if (val.trim().length >= 3) {
                  try {
                    const cust = await getCustomerByCode(val.trim())
                    setFoundCustomer(cust)
                  } catch {
                    setFoundCustomer(null)
                  }
                } else {
                  setFoundCustomer(null)
                }
              }}
              className="flex-1"
            />
            <Button variant="secondary" className="self-end" onClick={() => handleScanCustomer('48291')} aria-label="اسکن بارکد مشتری">
              <span aria-hidden="true">📷</span>
            </Button>
          </div>
          {foundCustomer && (
            <div className="bg-white/5 border border-glass-border rounded-xl2 p-3 flex justify-between items-center text-sm">
              <strong>{foundCustomer.name} (کد {foundCustomer.personalCode})</strong>
              <Badge tone="success">{foundCustomer.pointsBalance} امتیاز</Badge>
            </div>
          )}
          <Input
            label="مبلغ فاکتور مشتری (تومان)"
            type="number"
            value={purchaseAmount}
            onChange={(e) => setPurchaseAmount(e.target.value)}
          />
          <p className="text-xs text-slate-400">
            <span aria-hidden="true">✨</span> به ازای این خرید حدود {ESTIMATED_PURCHASE_POINTS} امتیاز (تقریبی) ثبت می‌شود؛ مقدار دقیق پس از ثبت نمایش داده خواهد شد. (اگر این مشتری با کد معرف ثبت‌نام کرده باشد، پاداش معرفی معرف پس از این اولین خرید آزاد می‌شود.)
          </p>
          <Button onClick={handleSubmitPurchase} className="w-full">
            ✓ ثبت خرید و اعمال امتیاز
          </Button>
        </Card>
      )}

      {/* Fulfill tab */}
      {tab === 'fulfill' && (
        <Card className="p-4 flex flex-col gap-3">
          <p className="text-xs text-slate-400">
            مشتری پس از زدن دکمه «دریافت پاداش» در گوشی خود، یک کد یک‌بار مصرف ۵ دقیقه‌ای دریافت می‌کند.
          </p>
          <div className="flex gap-2">
            <Input
              label="کد یک‌بار مصرف پاداش"
              placeholder="مثال: RDM-84920"
              value={redemptionCode}
              onChange={async (e) => {
                const val = e.target.value
                setRedemptionCode(val)
                if (val.trim().length >= 5) {
                  try {
                    const rdm = await getRedemptionByCode(val.trim())
                    setFoundRedemption(rdm)
                  } catch {
                    setFoundRedemption(null)
                  }
                } else {
                  setFoundRedemption(null)
                }
              }}
              className="flex-1"
            />
            <Button variant="secondary" className="self-end" onClick={() => handleScanRedemption('RDM-84920')} aria-label="اسکن کد یک‌بار مصرف پاداش">
              <span aria-hidden="true">📷</span>
            </Button>
          </div>
          {foundRedemption && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl2 p-3 text-sm">
              <div className="font-bold text-emerald-300">✓ کد پاداش معتبر است</div>
              <div className="text-emerald-300 mt-1">عنوان پاداش: {foundRedemption.rewardTitle}</div>
              <div className="text-xs text-emerald-400 mt-1">
                مشتری: {foundRedemption.customerName} ({foundRedemption.customerCode}) • کسر شده: {foundRedemption.pointsDeducted} امتیاز
              </div>
            </div>
          )}
          <Button onClick={handleSubmitFulfill} className="w-full">
            🎁 تایید تحویل پاداش به مشتری
          </Button>
        </Card>
      )}

      {/* Queue tab */}
      {tab === 'queue' && (
        <div className="flex flex-col gap-3">
          <Card className="p-4">
            <p className="text-xs text-slate-400 mb-3">
              آیتم‌های زیر در زمان قطع ارتباط در حافظه دستگاه ذخیره شده‌اند. هنگام همگام‌سازی، سرور مرکزی به طور خودکار بررسی‌های تشخیص تکراری (Idempotency) و راستی‌آزمایی اعتبار کد/کمپین را انجام می‌دهد.
            </p>
            <Button variant="secondary" onClick={handleSync} className="w-full">
              <span aria-hidden="true">🔄</span> همگام‌سازی و راستی‌آزمایی سرور
            </Button>
          </Card>

          <div>
            <h3 className="text-sm font-semibold mb-2 text-slate-300">📋 اقلام صف آفلاین فعلی</h3>
            {offlineQueue.length === 0 ? (
              <Card className="p-4 text-center text-xs text-slate-400">صف آفلاین خالی است. همه اقلام همگام‌سازی شده‌اند. ✓</Card>
            ) : (
              <div className="flex flex-col gap-2">
                {offlineQueue.map((item) => (
                  <Card key={item.id} className="p-3 text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <strong>{item.actionType === 'purchase' ? 'ثبت فاکتور' : 'تحویل پاداش'}</strong>
                      <Badge tone="warning">در صف انتظار</Badge>
                    </div>
                    {item.actionType === 'purchase' && (
                      <div className="text-slate-400">مبلغ: {formatToman(item.amountToman)} • کد مشتری: {item.personalCode}</div>
                    )}
                    <div className="text-slate-500 mt-1 break-all">کلید یکتا: {item.idempotencyKey}</div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {lastSyncResults && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-slate-300">📊 نتایج آخرین همگام‌سازی</h3>
              <div className="flex flex-col gap-2">
                {lastSyncResults.map((r) => (
                  <Card
                    key={r.idempotencyKey}
                    className={`p-3 text-xs ${r.status === 'synced' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <strong className="break-all">{r.idempotencyKey.slice(0, 18)}...</strong>
                      <Badge tone={r.status === 'synced' ? 'success' : 'danger'}>
                        {r.status === 'synced' ? '✓ همگام و تایید شد' : r.status === 'duplicate_skipped' ? '✕ تکراری' : '✕ نامعتبر'}
                      </Badge>
                    </div>
                    <p className="text-slate-400">{r.reason}</p>
                    {r.pointsAwarded ? <div className="text-emerald-400 mt-1">امتیاز اعطا شده: +{r.pointsAwarded}</div> : null}
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content review tab -- Instagram story/post shares, written reviews,
          AND receipt claims, all verified firsthand by staff instead of the
          central review console. Only shows up here when AI confidence was
          below the auto-approve threshold or scoring wasn't available. */}
      {tab === 'screenshots' && (
        <div className="flex flex-col gap-3">
          <Card className="p-3">
            <p className="text-xs text-slate-400">
              <span aria-hidden="true">📸</span> این موارد (اشتراک‌گذاری استوری/پست اینستاگرام، ثبت نظر، ادعای خرید بازگشتی) دیگر توسط تیم مرکزی بررسی نمی‌شوند — فقط مواردی که هوش مصنوعی دربارهشان مطمئن نبوده اینجا می‌رسند؛ کارمند فروشگاه صحت آن را همین‌جا تایید می‌کند.
            </p>
          </Card>
          {loadingSubmissions ? (
            <Card className="p-4 text-center text-xs text-slate-400">در حال بارگذاری…</Card>
          ) : pendingSubmissions.length === 0 ? (
            <Card className="p-4 text-center text-xs text-emerald-300">همه موارد بررسی شدند. <span aria-hidden="true">✓</span></Card>
          ) : (
            <div className="flex flex-col gap-3">
              {pendingSubmissions.map((s) => {
                const badgeLabel =
                  s.submissionType === 'receipt_claim'
                    ? 'ادعای خرید بازگشتی (رسید)'
                    : s.taskPattern === 'social_proof'
                      ? 'اشتراک‌گذاری استوری/پست'
                      : 'ثبت نظر'
                return (
                  <Card key={s.id} className="p-3 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <strong className="text-sm">{s.taskTitle}</strong>
                      <Badge tone="warning">{badgeLabel}</Badge>
                    </div>
                    <div className="text-xs text-slate-400">{s.customerName} • {s.submittedAt}</div>
                    {s.receiptNumber && (
                      <div className="text-xs text-amber-400"><strong>شماره رسید:</strong> {s.receiptNumber}</div>
                    )}
                    {s.aiConfidenceScore !== null && (
                      <div className="text-xs text-slate-400">
                        <strong className="text-slate-300">اعتماد AI:</strong> {Math.round(s.aiConfidenceScore * 100)}٪ (زیر آستانه تایید خودکار، نیاز به بررسی دستی دارد)
                      </div>
                    )}
                    {evidenceImageUrls[s.id] ? (
                      <img
                        src={evidenceImageUrls[s.id]}
                        alt="تصویر ارسالی مشتری"
                        className="rounded-xl2 border border-glass-border max-h-64 w-full object-contain bg-black/20"
                      />
                    ) : (
                      <div className="bg-white/5 border border-dashed border-white/15 rounded-xl2 p-4 text-center text-xs text-slate-400">
                        <span aria-hidden="true">🖼️</span> {s.evidenceUrl ? 'در حال بارگذاری تصویر…' : 'بدون تصویر پیوست'}
                      </div>
                    )}
                    <div className="flex gap-2 mt-1">
                      <Button
                        variant="danger"
                        className="flex-1"
                        disabled={resolvingId === s.id}
                        onClick={() => handleResolveScreenshot(s, 'rejected')}
                      >
                        <span aria-hidden="true">✕</span> رد کردن
                      </Button>
                      <Button
                        className="flex-1"
                        disabled={resolvingId === s.id}
                        onClick={() => handleResolveScreenshot(s, 'approved')}
                      >
                        <span aria-hidden="true">✓</span> تایید (+{s.taskPointsValue} امتیاز)
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Recent activity */}
      <div>
        <h3 className="text-sm font-semibold mb-2 text-slate-300">🕒 آخرین عملیات ثبت شده صندوق</h3>
        <Card className="p-0 divide-y divide-glass-border overflow-hidden">
          {activities.length === 0 ? (
            <div className="p-3 text-xs text-slate-400 text-center">هیچ فعالیتی ثبت نشده است</div>
          ) : (
            activities.slice(0, 5).map((act) => (
              <div key={act.id} className="p-3 flex justify-between items-center text-sm">
                <div>
                  <div className="font-medium">{act.text}</div>
                  <div className="text-xs text-slate-400">{act.time}</div>
                </div>
                <Badge tone={act.status === 'queued' ? 'warning' : 'success'}>
                  {act.status === 'queued' ? 'در صف آفلاین' : 'ثبت شده'}
                </Badge>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  )
}
