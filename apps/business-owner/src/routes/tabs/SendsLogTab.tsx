import { useEffect, useState } from 'react'
import { Badge } from '@ai-campaign-builder/ui-kit'
import { getSendsLog } from '@ai-campaign-builder/api-client'
import type { SendLogEntry } from '@ai-campaign-builder/api-client'
import apiClient from '../../lib/api-client'

const statusTone = { sent: 'success', failed: 'danger', skipped: 'neutral' } as const
const statusLabel = { sent: 'ارسال شد', failed: 'ناموفق', skipped: 'رد شد' } as const
const channelLabel = { sms: 'پیامک', telegram: 'تلگرام' } as const

/**
 * "لاگ ارسال‌ها" (Sends Log) — confirmation/audit view for notifications_log.
 */
export function SendsLogTab() {
  const [sendsLog, setSendsLog] = useState<SendLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    getSendsLog(apiClient)
      .then((data) => {
        if (mounted) {
          setSendsLog(data)
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
