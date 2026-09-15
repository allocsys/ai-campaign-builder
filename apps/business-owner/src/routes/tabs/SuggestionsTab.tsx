import { useEffect, useState } from 'react'
import { Badge, Button, Card, useToast } from '@ai-campaign-builder/ui-kit'
import { getSuggestedChanges, applySuggestedChange, dismissSuggestedChange } from '@ai-campaign-builder/api-client'
import type { SuggestedChange } from '@ai-campaign-builder/api-client'
import apiClient from '../../lib/api-client'

type Status = 'pending' | 'applied' | 'dismissed'

/**
 * Phase 3 human-in-the-loop suggestions. Fetches suggested changes and handles Apply/Dismiss API calls.
 */
export function SuggestionsTab({
  onPendingCountChange,
}: {
  /** Called whenever the pending-suggestions count changes, so a parent (e.g. the tab header) can show a badge. */
  onPendingCountChange?: (count: number) => void
} = {}) {
  const [changes, setChanges] = useState<(SuggestedChange & { status: Status })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({})
  const { show } = useToast()

  useEffect(() => {
    let mounted = true
    getSuggestedChanges(apiClient)
      .then((data) => {
        if (mounted) {
          setChanges(data.map((c) => ({ ...c, status: c.status as Status })))
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

  // Keep the caller (InsightsAndSuggestionsTab's header badge, per design.md)
  // in sync with the live pending count -- fires on initial load and on every
  // apply/dismiss, since those update `changes` too.
  useEffect(() => {
    onPendingCountChange?.(changes.filter((c) => c.status === 'pending').length)
  }, [changes, onPendingCountChange])

  const handleApply = async (id: string) => {
    setItemErrors((prev) => ({ ...prev, [id]: '' }))
    try {
      await applySuggestedChange(apiClient, id)
      setChanges((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'applied' } : c)))
      show('تغییر اعمال شد', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setItemErrors((prev) => ({ ...prev, [id]: msg }))
    }
  }

  const handleDismiss = async (id: string) => {
    setItemErrors((prev) => ({ ...prev, [id]: '' }))
    try {
      await dismissSuggestedChange(apiClient, id)
      setChanges((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'dismissed' } : c)))
      show('تغییر رد شد', 'info')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setItemErrors((prev) => ({ ...prev, [id]: msg }))
    }
  }

  if (loading) {
    return <div className="p-4 text-sm text-slate-400">در حال بارگذاری...</div>
  }

  if (error) {
    return <div className="p-4 text-sm text-red-400">{error}</div>
  }

  if (changes.length === 0) {
    return <p className="text-sm text-slate-400">پیشنهادی وجود ندارد.</p>
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
          {itemErrors[c.id] && (
            <p className="text-xs text-red-400">{itemErrors[c.id]}</p>
          )}
          {c.status === 'pending' ? (
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => handleApply(c.id)}>
                اعمال کن
              </Button>
              <Button variant="ghost" onClick={() => handleDismiss(c.id)}>
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
