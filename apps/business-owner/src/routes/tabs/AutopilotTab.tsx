import { useState } from 'react'
import { Badge, Button, Card, useToast } from '@ai-campaign-builder/ui-kit'
import { autopilotState } from '../../lib/mock-data'

/**
 * Phase 4 opt-in autopilot (plan.md) — toggle only appears/enables once
 * manualApplyCount >= eligibilityThreshold (3 manual Applies in Phase 3).
 * TODO: wire to PATCH /businesses/:id (autopilot_enabled) once backend exists.
 */
export function AutopilotTab() {
  const [enabled, setEnabled] = useState(autopilotState.enabled)
  const { show } = useToast()
  const eligible = autopilotState.manualApplyCount >= autopilotState.eligibilityThreshold

  if (!eligible) {
    return (
      <Card className="p-5">
        <p className="text-sm text-slate-300">
          خودکارسازی پس از {autopilotState.eligibilityThreshold} بار اعمال دستی پیشنهاد در دسترس قرار می‌گیرد.
        </p>
        <p className="text-xs text-slate-500 mt-1">
          تا الان {autopilotState.manualApplyCount} از {autopilotState.eligibilityThreshold} مورد اعمال شده.
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-5 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">خودکارسازی تغییرات کم‌ریسک</p>
        <p className="text-xs text-slate-400 mt-1">
          فقط امتیاز تسک، آستانه جایزه و مدت کمپین به‌صورت خودکار تغییر می‌کند — همیشه با امکان بازگردانی (Undo).
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={enabled ? 'success' : 'neutral'}>{enabled ? 'فعال' : 'غیرفعال'}</Badge>
        <Button
          variant={enabled ? 'ghost' : 'primary'}
          onClick={() => {
            setEnabled((v) => !v)
            show(!enabled ? 'خودکارسازی فعال شد' : 'خودکارسازی غیرفعال شد', 'info')
          }}
        >
          {enabled ? 'غیرفعال کردن' : 'فعال کردن'}
        </Button>
      </div>
    </Card>
  )
}
