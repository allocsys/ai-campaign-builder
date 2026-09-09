import { Badge } from '@ai-campaign-builder/ui-kit'
import { sendsLog } from '../../lib/mock-data'

const statusTone = { sent: 'success', failed: 'danger', skipped: 'neutral' } as const
const statusLabel = { sent: 'ارسال شد', failed: 'ناموفق', skipped: 'رد شد' } as const
const channelLabel = { sms: 'پیامک', telegram: 'تلگرام' } as const

/**
 * "لاگ ارسال‌ها" (Sends Log) — confirmation/audit view for notifications_log (plan.md
 * "Campaign invite dedup & confirmation", decided 2026-09-08). table-layout:fixed + explicit
 * column widths carried forward from the mobile-rendering bug fixed in the mockup (see
 * session history) — a plain table here would hit the same collapsing-column issue on mobile.
 * TODO: replace sendsLog with GET /notifications_log?business_id=.
 */
export function SendsLogTab() {
  if (sendsLog.length === 0) {
    return <p className="text-sm text-slate-400">هنوز پیامی ارسال نشده است.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ tableLayout: 'fixed' }} aria-label="لاگ ارسال پیام‌ها">
        <colgroup>
          <col style={{ width: '30%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '25%' }} />
          <col style={{ width: '25%' }} />
        </colgroup>
        <thead>
          <tr className="text-slate-400 text-xs border-b border-glass-border">
            <th className="text-right font-medium py-2">مخاطب</th>
            <th className="text-right font-medium py-2">کانال</th>
            <th className="text-right font-medium py-2">وضعیت</th>
            <th className="text-right font-medium py-2">زمان</th>
          </tr>
        </thead>
        <tbody>
          {sendsLog.map((row) => (
            <tr key={row.id} className="border-b border-glass-border last:border-0">
              <td className="py-2.5 truncate" dir="ltr">{row.contact}</td>
              <td className="py-2.5">{channelLabel[row.channel]}</td>
              <td className="py-2.5">
                <Badge tone={statusTone[row.status]}>{statusLabel[row.status]}</Badge>
              </td>
              <td className="py-2.5 text-slate-400 truncate">{row.sentAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
