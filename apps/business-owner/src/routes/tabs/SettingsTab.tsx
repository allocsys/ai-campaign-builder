import { Badge, Card } from '@ai-campaign-builder/ui-kit'
import { businessProfile, subscription } from '../../lib/mock-data'

/**
 * Business profile + SMS wallet + subscription/billing summary. Read-only display for now.
 * TODO: wire to GET/PATCH /businesses/:id, /business_ai_constraints, /business_subscriptions.
 */
export function SettingsTab() {
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3 text-slate-300">اطلاعات کسب‌وکار</h3>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-slate-400">نام</dt>
          <dd>{businessProfile.name}</dd>
          <dt className="text-slate-400">دسته‌بندی</dt>
          <dd>{businessProfile.categoryLabel}</dd>
          <dt className="text-slate-400">شماره موبایل</dt>
          <dd dir="ltr" className="text-left">{businessProfile.phone}</dd>
        </dl>
      </Card>

      <Card className="p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">کیف پول پیامک</p>
          <p className="text-xs text-slate-500 mt-0.5">
            سقف ماهانه: {businessProfile.smsMonthlyCapToman ? `${businessProfile.smsMonthlyCapToman.toLocaleString('fa-IR')} تومان` : 'بدون سقف'}
          </p>
        </div>
        <span className="text-sm font-semibold">{businessProfile.smsWalletBalanceToman.toLocaleString('fa-IR')} تومان</span>
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
