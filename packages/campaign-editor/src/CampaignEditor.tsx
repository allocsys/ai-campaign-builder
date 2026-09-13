import { useState } from 'react'
import { Badge, Button, Card, Input, useToast } from '@ai-campaign-builder/ui-kit'
import type { Campaign, CampaignReward, CampaignTask } from '@ai-campaign-builder/api-client'

/**
 * Manual field-level campaign editor (plan.md Item 16). Pure editing UI --
 * takes an already-fetched `campaign` and an `onSave` callback, has no
 * opinion on auth, gating, or which endpoint backs the save. This is what
 * makes it reusable across both callers:
 *   - apps/business-owner's CampaignEditorTab.tsx: fetches the owner's own
 *     campaign, checks `manualEditorEnabled` and redirects if off (the gate
 *     lives in the wrapper, not here), calls `updateCampaign(apiClient, data)`.
 *   - apps/review-console's AdminCampaignsHome.tsx: fetches a picked
 *     business's campaign via the businessId-scoped admin endpoint, no gate
 *     check at all (review_admin's access is unconditional per plan.md),
 *     calls `updateAdminBusinessCampaign(adminApiClient, businessId, data)`.
 *
 * Built entirely against the whole-array-replace `PUT /campaign` contract
 * (plan.md Item 16 Step E) -- edits a local copy of `tasks`/`rewards`, saves
 * the full arrays on "ذخیره تغییرات". Step E's `id` fields are used as
 * stable keys internally but are otherwise opaque here.
 *
 * Callers should pass a `key` prop (e.g. a businessId, or a constant like
 * "own" for the single-business case) at the call site so React remounts
 * this component -- and re-seeds its local state from the new `campaign`
 * prop -- whenever the underlying campaign identity changes (e.g. an admin
 * switching which business they're viewing). This component does not
 * re-sync from `campaign` on every prop change by itself, to avoid
 * clobbering in-progress local edits on unrelated parent re-renders.
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

/** select styled to match Input's glass surface -- ui-kit has no Select component yet. */
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

export interface CampaignEditorProps {
  /** The campaign to edit. Only read on mount / when `key` changes -- see the remount note above. */
  campaign: Campaign
  /** Persists the full tasks+rewards arrays. Should resolve to the saved Campaign. */
  onSave: (data: Partial<Campaign>) => Promise<Campaign>
  /** Called after a successful save with the server's response. */
  onSaved?: (updated: Campaign) => void
  /**
   * View-only mode -- disables every input, hides add/remove controls and
   * the save/discard row entirely. Used by business-owner's CampaignEditorTab
   * when the business's manualEditorEnabled is off but they still reached
   * this page (e.g. via the bottom-nav Campaign button once a real campaign
   * exists) -- lets them see current tasks/rewards without being able to
   * change anything. review-console's admin view never sets this (admin
   * access is unconditional).
   */
  readOnly?: boolean
  className?: string
}

export function CampaignEditor({ campaign, onSave, onSaved, readOnly = false, className }: CampaignEditorProps) {
  const { show: showToast } = useToast()

  const [baseline, setBaseline] = useState<Campaign>(campaign)
  const [tasks, setTasks] = useState<EditableTask[]>(() => toEditableTasks(campaign.tasks))
  const [rewards, setRewards] = useState<EditableReward[]>(() => toEditableRewards(campaign.rewards))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

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
      const updated = await onSave({
        tasks: tasks.map(({ clientKey: _clientKey, ...t }) => t),
        rewards: rewards.map(({ clientKey: _clientKey, ...r }) => r),
      })
      setBaseline(updated)
      setTasks(toEditableTasks(updated.tasks))
      setRewards(toEditableRewards(updated.rewards))
      setDirty(false)
      showToast('تغییرات کمپین ذخیره شد.', 'success')
      onSaved?.(updated)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  function discardChanges() {
    setTasks(toEditableTasks(baseline.tasks))
    setRewards(toEditableRewards(baseline.rewards))
    setDirty(false)
    setSaveError(null)
  }

  return (
    <div className={`flex flex-col gap-4 ${className ?? ''}`}>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300">تسک‌ها</h3>
          {!readOnly && (
            <Button variant="ghost" onClick={addTask} disabled={saving}>
              + افزودن تسک
            </Button>
          )}
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
                    disabled={saving || readOnly}
                  />
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeTask(t.clientKey)}
                    disabled={saving}
                    className="text-xs text-red-400 hover:text-red-300 shrink-0 py-2.5"
                  >
                    حذف
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-300">الگو</label>
                  <select
                    className={selectClassName()}
                    value={t.pattern}
                    onChange={(e) => updateTask(t.clientKey, { pattern: e.target.value })}
                    disabled={saving || readOnly}
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
                  disabled={saving || readOnly}
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
        {dirty && <Badge tone="warning">تغییرات ذخیره‌نشده</Badge>}
      </div>
    </div>
  )
}
