import { useState } from 'react'
import { Badge, Button, Card, Input, useToast } from '@ai-campaign-builder/ui-kit'
import { useAuth } from '../lib/auth'
import {
  ACTIVE_CAMPAIGN_ID,
  DEFAULT_PURCHASE_POINTS,
  formatToman,
  initialActivities,
  lookupCustomerByCode,
  lookupRedemptionByCode,
  makeIdempotencyKey,
  syncOfflineQueue,
  type ActivityEntry,
  type CustomerLookup,
  type OfflineQueueItem,
  type RedemptionLookup,
  type SyncResult,
} from '../lib/mock-data'

type Tab = 'purchase' | 'fulfill' | 'queue'

/**
 * Main Staff POS screen — 3 tabs (log purchase, fulfill reward, offline queue),
 * an offline-mode simulation toggle, and a recent-activity feed. Mirrors
 * mockup/staff-pos.html's layout and behavior 1:1, including the Gap #9 offline
 * queue dedup+validity verification on sync. All state in-memory/session-only.
 * TODO: replace each local-state mutation with a real API call as the
 * corresponding backend endpoint comes online.
 */
export function StaffPosHome() {
  const { logout } = useAuth()
  const { show } = useToast()

  const [tab, setTab] = useState<Tab>('purchase')
  const [isOffline, setIsOffline] = useState(false)
  const [activities, setActivities] = useState<ActivityEntry[]>(initialActivities)
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>([])
  const [syncedKeys, setSyncedKeys] = useState<Set<string>>(new Set())
  const [lastSyncResults, setLastSyncResults] = useState<SyncResult[] | null>(null)

  // Purchase tab state
  const [customerCode, setCustomerCode] = useState('48291')
  const [foundCustomer, setFoundCustomer] = useState<CustomerLookup | null>(lookupCustomerByCode('48291'))
  const [purchaseAmount, setPurchaseAmount] = useState('180000')

  // Fulfill tab state
  const [redemptionCode, setRedemptionCode] = useState('')
  const [foundRedemption, setFoundRedemption] = useState<RedemptionLookup | null>(null)

  const addActivity = (entry: Omit<ActivityEntry, 'id'>) => {
    setActivities((prev) => [{ id: `act_${Date.now()}`, ...entry }, ...prev])
  }

  const handleScanCustomer = (code: string) => {
    setCustomerCode(code)
    setFoundCustomer(lookupCustomerByCode(code))
    show(`بارکد مشتری خوانده شد: ${code}`, 'info')
  }

  const handleScanRedemption = (code: string) => {
    setRedemptionCode(code)
    setFoundRedemption(lookupRedemptionByCode(code))
    show(`بارکد پاداش شناسایی شد: ${code}`, 'info')
  }

  const handleSubmitPurchase = () => {
    const code = customerCode.trim() || '48291'
    const amount = Number(purchaseAmount) || 180000
    const points = DEFAULT_PURCHASE_POINTS
    const idempotencyKey = makeIdempotencyKey(code)

    if (isOffline) {
      setOfflineQueue((prev) => [
        ...prev,
        {
          id: `q_${Date.now()}`,
          idempotencyKey,
          customerCampaignCodeId: code,
          campaignId: ACTIVE_CAMPAIGN_ID,
          actionType: 'purchase',
          amountToman: amount,
          pointsAwarded: points,
          createdAt: 'همین الان',
        },
      ])
      addActivity({
        type: 'purchase',
        text: `ثبت فاکتور ${formatToman(amount)} برای کد ${code} (+${points} امتیاز)`,
        time: 'همین الان',
        status: 'queued',
      })
      show('تراکنش در صف آفلاین دستگاه ذخیره شد و پس از اتصال اینترنت همگام می‌شود.', 'warning')
    } else {
      setSyncedKeys((prev) => new Set(prev).add(idempotencyKey))
      addActivity({
        type: 'purchase',
        text: `ثبت فاکتور ${formatToman(amount)} برای کد ${code} (+${points} امتیاز)`,
        time: 'همین الان',
        status: 'synced',
      })
      show(`خرید با موفقیت ثبت شد و ${points} امتیاز به کد ${code} اعطا گردید.`, 'success')
    }

    setCustomerCode('')
    setFoundCustomer(null)
  }

  const handleSubmitFulfill = () => {
    const code = redemptionCode.trim() || 'RDM-84920'
    const idempotencyKey = makeIdempotencyKey(`rdm_${code}`)

    if (isOffline) {
      setOfflineQueue((prev) => [
        ...prev,
        {
          id: `q_${Date.now()}`,
          idempotencyKey,
          customerCampaignCodeId: foundRedemption?.customerCode ?? 'unknown',
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
      addActivity({
        type: 'fulfill',
        text: `تحویل پاداش با کد ${code}`,
        time: 'همین الان',
        status: 'synced',
      })
      show(`پاداش ${code} با موفقیت در سیستم باطل و تحویل داده شد.`, 'success')
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

  const handleSync = () => {
    if (offlineQueue.length === 0) {
      show('صف آفلاین خالی است؛ اتصال به سرور برقرار و پایدار است.', 'success')
      return
    }
    show(`در حال همگام‌سازی و راستی‌آزمایی ${offlineQueue.length} آیتم صف آفلاین با سرور مرکزی...`, 'info')

    const { results, newlySyncedKeys } = syncOfflineQueue(offlineQueue, syncedKeys)
    setSyncedKeys((prev) => {
      const next = new Set(prev)
      newlySyncedKeys.forEach((k) => next.add(k))
      return next
    })
    setOfflineQueue([])
    setLastSyncResults(results)

    const successCount = results.filter((r) => r.status === 'synced').length
    const dupCount = results.filter((r) => r.status === 'duplicate_skipped').length
    const invalidCount = results.filter((r) => r.status === 'invalid_skipped').length
    show(
      `همگام‌سازی کامل شد: ${successCount} موفق، ${dupCount} تکراری رد شد، ${invalidCount} نامعتبر رد شد.`,
      successCount > 0 ? 'success' : 'warning',
    )
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-4 p-4">
      {/* Header */}
      <Card className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧾</span>
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
        <Card className="p-3 border-2 border-dashed border-red-500/40 flex items-center justify-between">
          <span className="text-xs text-red-300">⚠️ اینترنت قطع است — عملیات در صف آفلاین ذخیره خواهند شد</span>
          <Badge tone="danger">{offlineQueue.length} در صف</Badge>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <Button variant={tab === 'purchase' ? 'primary' : 'secondary'} onClick={() => setTab('purchase')} className="flex-1">
          🛒 ثبت فاکتور
        </Button>
        <Button variant={tab === 'fulfill' ? 'primary' : 'secondary'} onClick={() => setTab('fulfill')} className="flex-1">
          🎁 تحویل پاداش
        </Button>
        <Button variant={tab === 'queue' ? 'primary' : 'secondary'} onClick={() => setTab('queue')} className="flex-1">
          📥 صف ({offlineQueue.length})
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
              onChange={(e) => {
                setCustomerCode(e.target.value)
                setFoundCustomer(lookupCustomerByCode(e.target.value))
              }}
              className="flex-1"
            />
            <Button variant="secondary" className="self-end" onClick={() => handleScanCustomer('48291')}>
              📷 اسکن
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
            ✨ به ازای این خرید {DEFAULT_PURCHASE_POINTS} امتیاز ثبت می‌شود. (اگر این مشتری با کد معرف ثبت‌نام کرده باشد، پاداش معرفی معرف پس از این اولین خرید آزاد می‌شود.)
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
              onChange={(e) => {
                setRedemptionCode(e.target.value)
                setFoundRedemption(lookupRedemptionByCode(e.target.value))
              }}
              className="flex-1"
            />
            <Button variant="secondary" className="self-end" onClick={() => handleScanRedemption('RDM-84920')}>
              📷 اسکن
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
              🔄 همگام‌سازی و راستی‌آزمایی سرور
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
                      <div className="text-slate-400">مبلغ: {formatToman(item.amountToman)} • کد مشتری: {item.customerCampaignCodeId}</div>
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

      {/* Recent activity */}
      <div>
        <h3 className="text-sm font-semibold mb-2 text-slate-300">🕒 آخرین عملیات ثبت شده صندوق</h3>
        <Card className="p-0 divide-y divide-glass-border overflow-hidden">
          {activities.slice(0, 5).map((act) => (
            <div key={act.id} className="p-3 flex justify-between items-center text-sm">
              <div>
                <div className="font-medium">{act.text}</div>
                <div className="text-xs text-slate-400">{act.time}</div>
              </div>
              <Badge tone={act.status === 'queued' ? 'warning' : 'success'}>
                {act.status === 'queued' ? 'در صف آفلاین' : 'ثبت شده'}
              </Badge>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
