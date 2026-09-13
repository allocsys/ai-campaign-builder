import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@ai-campaign-builder/ui-kit'
import { getBusinessProfile, getCampaign, updateCampaign } from '@ai-campaign-builder/api-client'
import type { BusinessProfile, Campaign } from '@ai-campaign-builder/api-client'
import { CampaignEditor } from '@ai-campaign-builder/campaign-editor'
import apiClient from '../../lib/api-client'

/**
 * Thin business-owner wrapper around the shared `CampaignEditor` component
 * (plan.md Item 16 Step G, extracted from this file into
 * packages/campaign-editor so review-console's admin campaign view -- Step
 * G's other half -- can reuse the exact same editing UI). This file's only
 * jobs: fetch the owner's own profile + campaign, wire `onSave` to the
 * owner-scoped `updateCampaign`, and decide edit-vs-view mode.
 *
 * `manualEditorEnabled` ("حالت حرفه‌ای") no longer gates ACCESS to this page --
 * the bottom-nav Campaign button now routes here for any business with a
 * real campaign regardless of pro mode (see AppShell/BottomNav), since
 * bouncing every non-pro-mode business back to /dashboard the moment they
 * tap the main Campaign nav item is worse than just showing them a
 * read-only view of their own tasks/rewards. It still gates EDITING: this
 * is re-checked on every load so a direct URL nav can't grant edit access,
 * only view access.
 */
export function CampaignEditorTab() {
  const [profile, setProfile] = useState<BusinessProfile | null>(null)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    Promise.all([getBusinessProfile(apiClient), getCampaign(apiClient)])
      .then(([profileData, campaignData]) => {
        if (!mounted) return
        setProfile(profileData)
        setCampaign(campaignData)
        setLoading(false)
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
  if (!profile || !campaign) {
    return null
  }

  const readOnly = !profile.manualEditorEnabled

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-100">
          {readOnly ? 'کمپین' : 'ویرایش دستی کمپین'}
        </h2>
        {!readOnly && <Badge tone="brand">حالت حرفه‌ای</Badge>}
      </div>
      {readOnly ? (
        <p className="text-xs text-slate-400 -mt-2">
          این فقط نمایش تسک‌ها و پاداش‌های کمپین فعلیته. برای ویرایش مستقیم،{' '}
          <Link to="/dashboard/settings" className="text-brand-400 hover:text-brand-300 underline underline-offset-2">
            حالت حرفه‌ای را از تنظیمات فعال کن
          </Link>
          .
        </p>
      ) : (
        <p className="text-xs text-slate-400 -mt-2">
          تسک‌ها و پاداش‌های کمپین رو مستقیماً ویرایش کن. تغییرات تا وقتی «ذخیره تغییرات» رو نزنی روی کمپین واقعی اعمال نمی‌شه.
        </p>
      )}

      <CampaignEditor
        key="own"
        campaign={campaign}
        onSave={(data) => updateCampaign(apiClient, data)}
        readOnly={readOnly}
      />
    </div>
  )
}
