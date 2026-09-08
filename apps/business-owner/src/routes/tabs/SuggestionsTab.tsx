import { useState } from 'react'
import { Badge, Button, Card, useToast } from '@ai-campaign-builder/ui-kit'
import { suggestedChanges as initialChanges } from '../../lib/mock-data'

type Status = 'pending' | 'applied' | 'dismissed'

/**
 * Phase 3 human-in-the-loop suggestions (plan.md). Apply/Dismiss here only updates local
 * state — TODO: wire to PATCH /suggested_changes/:id once the backend exists, and to
 * business_ai_constraints for the high-risk pre-filter (currently just shown, not enforced
 * client-side — enforcement is a backend concern per architecture.md).
 */
export function SuggestionsTab() {
  const [changes, setChanges] = useState(initialChanges.map((c) => ({ ...c, status: c.status as Status })))
  const { show } = useToast()

  const setStatus = (id: string, status: Status) => {
    setChanges((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)))
    show(status === 'applied' ? 'تغییر اعمال شد' : 'تغییر رد شد', status === 'applied' ? 'success' : 'info')
  }

  return (
    <div className="flex flex-col gap-3">
      {changes.map((c) => (
        <Card key={c.id} className="p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm">{c.rationale}</p>
            <Badge tone={c.riskTier === 'high' ? 'danger' : 'neutral'} className="shrink-0">
              {c.riskTier === 'high' ? 'ریسک بالا' : 'ریسک پایین'}
            </Badge>
          </div>
          {c.status === 'pending' ? (
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => setStatus(c.id, 'applied')}>
                اعمال کن
              </Button>
              <Button variant="ghost" onClick={() => setStatus(c.id, 'dismissed')}>
                رد کن
              </Button>
            </div>
          ) : (
            <Badge tone={c.status === 'applied' ? 'success' : 'neutral'}>
              {c.status === 'applied' ? 'اعمال شد' : 'رد شد'}
            </Badge>
          )}
        </Card>
      ))}
    </div>
  )
}
