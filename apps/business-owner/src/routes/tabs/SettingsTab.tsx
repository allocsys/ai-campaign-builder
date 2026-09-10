import { useEffect, useState } from 'react'
import { Badge, Card } from '@ai-campaign-builder/ui-kit'
import { getBusinessProfile, getSubscription, updateBusinessProfile } from '@ai-campaign-builder/api-client'
import type { BusinessProfile, Subscription } from '@ai-campaign-builder/api-client'
import apiClient from '../../lib/api-client'

/**
 * Business profile + SMS wallet + subscription/billing summary.
 */
export function SettingsTab() {
  const [profile, setProfile] = useState<BusinessProfile | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        <h3 className="text-sm font-semibold mb-3 text-slate-300">اطلاعات کسب‌وکار</h3>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-slate-400">نام</dt>
          <dd>{profile.name}</dd>
          <dt className="text-slate-400">دسته‌بندی</dt>
          <dd>{profile.categoryLabel}</dd>
          <dt className="text-slate-400">شماره موبایل</dt>
          <dd dir="ltr" className="text-left">{profile.phone}</dd>
        </dl>
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
