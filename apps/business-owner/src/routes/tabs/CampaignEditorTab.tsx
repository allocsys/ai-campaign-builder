import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, useToast } from '@ai-campaign-builder/ui-kit'
import { getBusinessProfile, getCampaign, updateCampaign } from '@ai-campaign-builder/api-client'
import type { BusinessProfile, Campaign } from '@ai-campaign-builder/api-client'
import { CampaignEditor } from '@ai-campaign-builder/campaign-editor'
import apiClient from '../../lib/api-client'

/**
 * Thin business-owner wrapper around the shared `CampaignEditor` component
 * (plan.md Item 16 Step G, extracted from this file into
 * packages/campaign-editor so review-console's admin campaign view -- Step
 * G's other half -- can reuse the exact same editing UI). This file's only
 * jobs: fetch the owner's own profile + campaign, enforce the
 * "حالت حرفه‌ای" (`manualEditorEnabled`) gate (re-checked here on every load
 * so a direct URL nav can't bypass it -- not just hiding the entry point on
 * SettingsTab/DashboardTab), and wire `onSave` to the owner-scoped
 * `updateCampaign`. All the actual tasks/rewards editing logic now lives in
 * the shared package.
 */
export function CampaignEditorTab() {
  const { show: showToast } = useToast()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<BusinessProfile | null>(null)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    Promise.all([getBusinessProfile(apiClient), getCampaign(apiClient)])
      .then(([profileData, campaignData]) => {
        if (!mounted) return
        if (!profileData.manualEditorEnabled) {
          showToast('حالت حرفه‌ای برای این کسب‌وکار فعال نیست.', 'warning')
          navigate('/dashboard', { replace: true })
          return
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-100">ویرایش دستی کمپین</h2>
        <Badge tone="brand">حالت حرفه‌ای</Badge>
      </div>
      <p className="text-xs text-slate-400 -mt-2">
        تسک‌ها و پاداش‌های کمپین رو مستقیماً ویرایش کن. تغییرات تا وقتی «ذخیره تغییرات» رو نزنی روی کمپین واقعی اعمال نمی‌شه.
      </p>

      <CampaignEditor
        key="own"
        campaign={campaign}
        onSave={(data) => updateCampaign(apiClient, data)}
      />
    </div>
  )
}
