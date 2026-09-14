import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, useToast } from '@ai-campaign-builder/ui-kit'
import { getBusinessProfile, getCampaign, updateBusinessProfile, updateCampaign } from '@ai-campaign-builder/api-client'
import type { BusinessProfile, Campaign } from '@ai-campaign-builder/api-client'
import { CampaignEditor } from '@ai-campaign-builder/campaign-editor'
import { CampaignWizardForm } from './CampaignWizardTab'
import { CampaignChatAssistant } from './CampaignChatAssistant'
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
 * real campaign regardless of pro mode (see AppShell/BottomNav). It gates
 * which UI shows: pro mode on renders the manual field-level `CampaignEditor`
 * below; pro mode off renders `CampaignWizardForm` inline instead (2026-09-13
 * -- a disabled/read-only dump of the manual editor's own fields turned out
 * to be redundant with the dashboard's existing summary and gave non-pro
 * owners no way to actually do anything here; the AI wizard lets them
 * regenerate/relaunch instead). This is re-checked on every load so a
 * direct URL nav can't grant manual-edit access, only the wizard.
 *
 * The top-right pill doubles as the toggle for pro mode itself (added so
 * owners don't have to detour through Settings just to flip it -- same
 * `updateBusinessProfile({ manualEditorEnabled })` call SettingsTab uses).
 */
export function CampaignEditorTab() {
  const navigate = useNavigate()
  const { show: showToast } = useToast()
  const [profile, setProfile] = useState<BusinessProfile | null>(null)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingManualEditor, setTogglingManualEditor] = useState(false)

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

  const toggleManualEditor = async () => {
    if (!profile) return
    setTogglingManualEditor(true)
    try {
      const updated = await updateBusinessProfile(apiClient, {
        manualEditorEnabled: !profile.manualEditorEnabled,
      })
      setProfile(updated)
      showToast(
        updated.manualEditorEnabled ? 'حالت حرفه‌ای فعال شد.' : 'حالت حرفه‌ای غیرفعال شد.',
        'success',
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'danger')
    } finally {
      setTogglingManualEditor(false)
    }
  }

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
        <button
          type="button"
          onClick={toggleManualEditor}
          disabled={togglingManualEditor}
          aria-pressed={!readOnly}
          className="disabled:opacity-60 disabled:cursor-wait"
        >
          <Badge
            tone={readOnly ? 'neutral' : 'brand'}
            className={`cursor-pointer select-none transition-colors ${
              readOnly ? 'hover:bg-white/20' : 'hover:bg-brand-500/25'
            }`}
          >
            {togglingManualEditor
              ? 'در حال تغییر...'
              : readOnly
                ? 'فعال‌سازی حالت حرفه‌ای'
                : 'حالت حرفه‌ای'}
          </Badge>
        </button>
      </div>
      {readOnly ? (
        <p className="text-xs text-slate-400 -mt-2">
          از دستیار هوشمند زیر برای ساخت یا بازسازی خودکار کمپین استفاده کن. برای ویرایش دستی تسک‌ها و پاداش‌ها، روی «فعال‌سازی حالت حرفه‌ای» بالا بزن.
        </p>
      ) : (
        <p className="text-xs text-slate-400 -mt-2">
          تسک‌ها و پاداش‌های کمپین رو مستقیماً ویرایش کن. تغییرات تا وقتی «ذخیره تغییرات» رو نزنی روی کمپین واقعی اعمال نمی‌شه.
        </p>
      )}

      {/* plan.md Open Item 20 Part B -- shown regardless of pro-mode: an NL
          request is a different way to REACH a suggestion (via the existing
          SuggestionsTab Apply/Dismiss flow), independent of whether this
          owner also has manual field-level editing access below. */}
      <CampaignChatAssistant />

      {readOnly ? (
        <CampaignWizardForm key="wizard" onLaunched={() => navigate('/dashboard')} />
      ) : (
        <CampaignEditor
          key="own"
          campaign={campaign}
          onSave={(data) => updateCampaign(apiClient, data)}
        />
      )}
    </div>
  )
}
