import { Badge, Card } from '@ai-campaign-builder/ui-kit'
import { checklistItems } from '../../lib/mock-data'

/**
 * "Next Steps" checklist (plan.md "Post-launch guidance", decided 2026-09-08) — auto-hides
 * once every item is complete. TODO: replace checklistItems with a fetch against
 * business_checklist_progress once that endpoint exists; completion here is stubbed, not
 * auto-detected.
 */
export function OnboardingTab() {
  const allDone = checklistItems.every((i) => i.completed)
  if (allDone) {
    return <p className="text-sm text-slate-400">همه مراحل تکمیل شده‌اند ✅</p>
  }
  return (
    <div className="flex flex-col gap-3">
      {checklistItems.map((item) => (
        <Card key={item.key} className="flex items-center justify-between p-4">
          <span className="text-sm">{item.label}</span>
          <Badge tone={item.completed ? 'success' : 'neutral'}>{item.completed ? 'انجام شد' : 'باقی‌مانده'}</Badge>
        </Card>
      ))}
    </div>
  )
}
