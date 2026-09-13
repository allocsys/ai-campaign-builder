import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Input, useToast } from '@ai-campaign-builder/ui-kit'
import { getBusinessProfile, getSubscription, updateBusinessProfile } from '@ai-campaign-builder/api-client'
import type { BusinessProfile, Subscription } from '@ai-campaign-builder/api-client'
import apiClient from '../../lib/api-client'

/**
 * Business profile + SMS wallet + subscription/billing summary.
 * Profile editing covers `name` + `smsMonthlyCapToman` + `address` (the
 * latter added 2026-09-11, plan.md Open Item 9, since it's also collected
 * in the onboarding wizard's Step 1 -- whichever place the owner reaches
 * first, it auto-fills the microsite Contact module). `phone` (auth
 * identity) and `categoryLabel`/`sizeTier` (set at onboarding, no
 * category-list endpoint exists yet to re-pick from) stay read-only for now.
 */
export function SettingsTab() {
  const { show: showToast } = useToast()
  const [profile, setProfile] = useState<BusinessProfile | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [addressInput, setAddressInput] = useState('')
  const [capInput, setCapInput] = useState('')
  const [noCap, setNoCap] = useState(false)
  const [togglingManualEditor, setTogglingManualEditor] = useState(false)

  useEffect(() => {
    let mounted = true
    Promise.all([getBusinessProfile(apiClient), getSubscription(apiClient)])
      .then(([profileData, subscriptionData]) => {
        if (mounted) {
          setProfile(profileData)
          setSubscription(subscriptionData)
          setLoading(false)
        }
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
  }, [])

  const startEditing = () => {
    if (!profile) return
    setNameInput(profile.name)
    setAddressInput(profile.address)
    setNoCap(profile.smsMonthlyCapToman === null)
    setCapInput(profile.smsMonthlyCapToman !== null ? String(profile.smsMonthlyCapToman) : '')
    setSaveError(null)
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
    setSaveError(null)
  }

  const toggleManualEditor = async () => {
    if (!profile) return
    setTogglingManualEditor(true)
    try {
      const updated = await updateBusinessProfile(apiClient, {
        manualEditorEnabled: !profile.manualEditorEnabled,
      })
      setProfile(updated)
      showToast(
        updated.manualEditorEnabled ? 'حالت حرفه‌ای فعال شد.' : 'حالت حرفه‌ای غیرفعال شد.',
        'success',
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'danger')
    } finally {
      setTogglingManualEditor(false)
    }
  }

  const save = async () => {
    if (!nameInput.trim()) {
      setSaveError('نام کسب‌وکار نمی‌تواند خالی باشد.')
      return
    }
    if (!noCap && capInput.trim() !== '' && Number.isNaN(Number(capInput))) {
      setSaveError('سقف ماهانه باید یک عدد باشد.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await updateBusinessProfile(apiClient, {
        name: nameInput.trim(),
        address: addressInput.trim(),
        smsMonthlyCapToman: noCap ? null : capInput.trim() === '' ? null : Number(capInput),
      })
      setProfile(updated)
      setEditing(false)
      showToast('تغییرات ذخیره شد.', 'success')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-4 text-sm text-slate-400">در حال بارگذاری...</div>
  }

  if (error) {
    return <div className="p-4 text-sm text-red-400">{error}</div>
  }

  if (!profile || !subscription) {
    return null
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300">اطلاعات کسب‌وکار</h3>
          {!editing && (
            <Button variant="ghost" onClick={startEditing}>
              ویرایش
            </Button>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-3">
            <Input
              label="نام کسب‌وکار"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              disabled={saving}
            />
            <Input
              label="آدرس کسب‌وکار"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              disabled={saving}
              placeholder="مثلاً تهران، ولیعصر، خیابان توانیر، پلاک ۱۲"
            />
            <div className="flex flex-col gap-1.5">
              <Input
                label="سقف ماهانه کیف پول پیامک (تومان)"
                type="number"
                inputMode="numeric"
                value={capInput}
                onChange={(e) => setCapInput(e.target.value)}
                disabled={saving || noCap}
                placeholder="بدون سقف"
              />
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={noCap}
                  onChange={(e) => setNoCap(e.target.checked)}
                  disabled={saving}
                />
                بدون سقف ماهانه
              </label>
            </div>

            <dl className="grid grid-cols-2 gap-y-2 text-sm pt-1 border-t border-glass-border">
              <dt className="text-slate-400">دسته‌بندی</dt>
              <dd>{profile.categoryLabel}</dd>
              <dt className="text-slate-400">شماره موبایل</dt>
              <dd dir="ltr" className="text-left">{profile.phone}</dd>
            </dl>

            {saveError && (
              <p role="alert" className="text-xs text-red-400">{saveError}</p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button onClick={save} loading={saving}>
                ذخیره
              </Button>
              <Button variant="ghost" onClick={cancelEditing} disabled={saving}>
                انصراف
              </Button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-400">نام</dt>
            <dd>{profile.name}</dd>
            <dt className="text-slate-400">آدرس</dt>
            <dd>{profile.address || '—'}</dd>
            <dt className="text-slate-400">دسته‌بندی</dt>
            <dd>{profile.categoryLabel}</dd>
            <dt className="text-slate-400">شماره موبایل</dt>
            <dd dir="ltr" className="text-left">{profile.phone}</dd>
          </dl>
        )}
      </Card>

      <Card className="p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">کیف پول پیامک</p>
          <p className="text-xs text-slate-500 mt-0.5">
            سقف ماهانه: {profile.smsMonthlyCapToman ? `${profile.smsMonthlyCapToman.toLocaleString('fa-IR')} تومان` : 'بدون سقف'}
          </p>
        </div>
        <span className="text-sm font-semibold" role="img" aria-label={`موجودی کیف پول: ${profile.smsWalletBalanceToman.toLocaleString('fa-IR')} تومان`}>
          {profile.smsWalletBalanceToman.toLocaleString('fa-IR')} تومان
        </span>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-medium">حالت حرفه‌ای</p>
            <p className="text-xs text-slate-500 mt-0.5">
              با فعال‌سازی این حالت، می‌تونی تسک‌ها و پاداش‌های کمپینت رو مستقیم و دستی ویرایش کنی.
            </p>
          </div>
          <Button
            variant={profile.manualEditorEnabled ? 'ghost' : 'primary'}
            onClick={toggleManualEditor}
            loading={togglingManualEditor}
          >
            {profile.manualEditorEnabled ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
          </Button>
        </div>
        {profile.manualEditorEnabled && (
          <Link
            to="/dashboard/campaign/edit"
            className="inline-flex text-sm text-brand-400 hover:text-brand-300 underline underline-offset-2"
          >
            رفتن به ویرایشگر دستی کمپین ←
          </Link>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-slate-300">طرح اشتراک و صورتحساب</h3>
          <Badge tone="success">فعال</Badge>
        </div>
        <p className="text-sm mt-2">
          {subscription.monthlyPriceToman.toLocaleString('fa-IR')} تومان/ماه — تمدید بعدی: {subscription.currentPeriodEnd}
        </p>
      </Card>
    </div>
  )
}
