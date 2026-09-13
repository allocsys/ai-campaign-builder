import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Input, useToast } from '@ai-campaign-builder/ui-kit'
import { getBusinessProfile, getCampaign, updateCampaign } from '@ai-campaign-builder/api-client'
import type { BusinessProfile, Campaign, CampaignReward, CampaignTask } from '@ai-campaign-builder/api-client'
import apiClient from '../../lib/api-client'

/**
 * Manual field-level campaign editor (plan.md Item 16 Step F). Only reachable
 * when the business's "حالت حرفه‌ای" (Professional Mode) flag is on --
 * `manualEditorEnabled` on BusinessProfile, toggled from SettingsTab. Guards
 * against direct URL nav bypassing the gate by re-checking the flag on load
 * (not just hiding the entry point).
 *
 * Built entirely against the existing GET/PUT /campaign whole-array-replace
 * contract (plan.md Item 16 Step E) -- no granular per-item endpoint exists,
 * so this edits a local copy of `tasks`/`rewards` and saves the full arrays
 * on "ذخیره". Step E's `id` fields (now returned by GET) are used as stable
 * React keys but are otherwise opaque to this component -- the backend
 * ignores whatever `id` is sent on write either way.
 *
 * Reused as-is (same component/logic) by review-console's Step G, per the
 * "build once" decision -- keep this component free of any business-owner-
 * specific assumptions beyond calling the standard api-client campaign
 * functions, so Step G can wrap it with an admin-supplied businessId context
 * later without a rewrite.
 */

const TASK_PATTERN_OPTIONS: { value: string; labelFa: string }[] = [
  { value: 'social_proof', labelFa: 'اثبات اجتماعی (Social Proof)' },
  { value: 'referral', labelFa: 'معرفی به دیگران (Referral)' },
  { value: 'repeat_purchase', labelFa: 'خرید مجدد (Repeat Purchase)' },
  { value: 'milestone_streak', labelFa: 'روند/نقطه عطف (Milestone/Streak)' },
  { value: 'specific_product_push', labelFa: 'تبلیغ محصول خاص' },
  { value: 'review_ugc', labelFa: 'نظر/محتوای کاربر (Review/UGC)' },
  { value: 'first_action', labelFa: 'اولین اقدام/تبدیل' },
  { value: 'off_peak', labelFa: 'بازدید ساعات کم‌ترافیک' },
  { value: 'anniversary_birthday', labelFa: 'سالگرد/تولد' },
]

const REWARD_PATTERN_OPTIONS: { value: string; labelFa: string }[] = [
  { value: 'percentage_discount', labelFa: 'درصد تخفیف' },
  { value: 'free_item', labelFa: 'کالای رایگان' },
  { value: 'free_shipping', labelFa: 'ارسال رایگان' },
  { value: 'vip_tier', labelFa: 'عضویت ویژه VIP' },
  { value: 'promo_item', labelFa: 'کالای پروموشنال' },
  { value: 'early_access', labelFa: 'دسترسی زودهنگام' },
]

/** select styled to match Input's glass surface -- ui-kit has no Select component yet (same workaround CampaignWizardTab uses). */
function selectClassName() {
  return 'bg-glass-light backdrop-blur-md border border-glass-border rounded-xl2 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-brand-500/60 transition-shadow'
}

function makeKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `k_${Math.random().toString(36).slice(2)}`
}

interface EditableTask extends CampaignTask {
  clientKey: string
}
interface EditableReward extends CampaignReward {
  clientKey: string
}

function toEditableTasks(tasks: CampaignTask[]): EditableTask[] {
  return tasks.map((t) => ({ ...t, clientKey: makeKey() }))
}
function toEditableRewards(rewards: CampaignReward[]): EditableReward[] {
  return rewards.map((r) => ({ ...r, clientKey: makeKey() }))
}

export function CampaignEditorTab() {
  const { show: showToast } = useToast()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<BusinessProfile | null>(null)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [tasks, setTasks] = useState<EditableTask[]>([])
  const [rewards, setRewards] = useState<EditableReward[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let mounted = true
    Promise.all([getBusinessProfile(apiClient), getCampaign(apiClient)])
      .then(([profileData, campaignData]) => {
        if (!mounted) return
        if (!profileData.manualEditorEnabled) {
          showToast('حالت حرفه‌ای برای این کسب‌وکار فعال نیست.', 'warning')
          navigate('/dashboard', { replace: true })
          return
        }
        setProfile(profileData)
        setCampaign(campaignData)
        setTasks(toEditableTasks(campaignData.tasks))
        setRewards(toEditableRewards(campaignData.rewards))
        setLoading(false)
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      })
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function markDirty() {
    setDirty(true)
    setSaveError(null)
  }

  function updateTask(key: string, patch: Partial<CampaignTask>) {
    setTasks((prev) => prev.map((t) => (t.clientKey === key ? { ...t, ...patch } : t)))
    markDirty()
  }
  function removeTask(key: string) {
    setTasks((prev) => prev.filter((t) => t.clientKey !== key))
    markDirty()
  }
  function addTask() {
    setTasks((prev) => [
      ...prev,
      { clientKey: makeKey(), name: '', pattern: TASK_PATTERN_OPTIONS[0].value, points: 10 },
    ])
    markDirty()
  }

  function updateReward(key: string, patch: Partial<CampaignReward>) {
    setRewards((prev) => prev.map((r) => (r.clientKey === key ? { ...r, ...patch } : r)))
    markDirty()
  }
  function removeReward(key: string) {
    setRewards((prev) => prev.filter((r) => r.clientKey !== key))
    markDirty()
  }
  function addReward() {
    setRewards((prev) => [
      ...prev,
      { clientKey: makeKey(), name: '', pattern: REWARD_PATTERN_OPTIONS[0].value, threshold: 100 },
    ])
    markDirty()
  }

  async function handleSave() {
    if (tasks.some((t) => !t.name.trim())) {
      setSaveError('نام همه تسک‌ها باید پر باشد.')
      return
    }
    if (rewards.some((r) => !r.name.trim())) {
      setSaveError('نام همه پاداش‌ها باید پر باشد.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await updateCampaign(apiClient, {
        tasks: tasks.map(({ clientKey: _clientKey, ...t }) => t),
        rewards: rewards.map(({ clientKey: _clientKey, ...r }) => r),
      })
      setCampaign(updated)
      setTasks(toEditableTasks(updated.tasks))
      setRewards(toEditableRewards(updated.rewards))
      setDirty(false)
      showToast('تغییرات کمپین ذخیره شد.', 'success')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  function discardChanges() {
    if (!campaign) return
    setTasks(toEditableTasks(campaign.tasks))
    setRewards(toEditableRewards(campaign.rewards))
    setDirty(false)
    setSaveError(null)
  }

  if (loading) {
    return <div className="p-4 text-sm text-slate-400">در حال بارگذاری...</div>
  }
  if (error) {
    return <div className="p-4 text-sm text-red-400">{error}</div>
  }
  if (!profile || !campaign) {
    return null
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-100">ویرایش دستی کمپین</h2>
        <Badge tone="brand">حالت حرفه‌ای</Badge>
      </div>
      <p className="text-xs text-slate-400 -mt-2">
        تسک‌ها و پاداش‌های کمپین رو مستقیماً ویرایش کن. تغییرات تا وقتی «ذخیره تغییرات» رو نزنی روی کمپین واقعی اعمال نمی‌شه.
      </p>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300">تسک‌ها</h3>
          <Button variant="ghost" onClick={addTask} disabled={saving}>
            + افزودن تسک
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {tasks.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-2">هنوز تسکی وجود ندارد.</p>
          )}
          {tasks.map((t) => (
            <div key={t.clientKey} className="flex flex-col gap-2 rounded-xl2 border border-glass-border p-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    label="نام تسک"
                    value={t.name}
                    onChange={(e) => updateTask(t.clientKey, { name: e.target.value })}
                    disabled={saving}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeTask(t.clientKey)}
                  disabled={saving}
                  className="text-xs text-red-400 hover:text-red-300 shrink-0 py-2.5"
                >
                  حذف
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-300">الگو</label>
                  <select
                    className={selectClassName()}
                    value={t.pattern}
                    onChange={(e) => updateTask(t.clientKey, { pattern: e.target.value })}
                    disabled={saving}
                  >
                    {TASK_PATTERN_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.labelFa}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="امتیاز"
                  type="number"
                  inputMode="numeric"
                  value={String(t.points)}
                  onChange={(e) => updateTask(t.clientKey, { points: Number(e.target.value) || 0 })}
                  disabled={saving}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300">پاداش‌ها</h3>
          <Button variant="ghost" onClick={addReward} disabled={saving}>
            + افزودن پاداش
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {rewards.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-2">هنوز پاداشی وجود ندارد.</p>
          )}
          {rewards.map((r) => (
            <div key={r.clientKey} className="flex flex-col gap-2 rounded-xl2 border border-glass-border p-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    label="نام پاداش"
                    value={r.name}
                    onChange={(e) => updateReward(r.clientKey, { name: e.target.value })}
                    disabled={saving}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeReward(r.clientKey)}
                  disabled={saving}
                  className="text-xs text-red-400 hover:text-red-300 shrink-0 py-2.5"
                >
                  حذف
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-300">نوع پاداش</label>
                  <select
                    className={selectClassName()}
                    value={r.pattern}
                    onChange={(e) => updateReward(r.clientKey, { pattern: e.target.value })}
                    disabled={saving}
                  >
                    {REWARD_PATTERN_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.labelFa}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="آستانه امتیاز"
                  type="number"
                  inputMode="numeric"
                  value={String(r.threshold)}
                  onChange={(e) => updateReward(r.clientKey, { threshold: Number(e.target.value) || 0 })}
                  disabled={saving}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {saveError && (
        <p role="alert" className="text-xs text-red-400">
          {saveError}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button onClick={handleSave} loading={saving} disabled={!dirty}>
          ذخیره تغییرات
        </Button>
        <Button variant="ghost" onClick={discardChanges} disabled={saving || !dirty}>
          انصراف از تغییرات
        </Button>
      </div>
    </div>
  )
}
