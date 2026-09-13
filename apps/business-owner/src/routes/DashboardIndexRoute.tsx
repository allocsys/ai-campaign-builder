import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { getCampaign } from '@ai-campaign-builder/api-client'
import apiClient from '../lib/api-client'
import { OnboardingBanner } from './OnboardingBanner'
import { DashboardTab } from './tabs/DashboardTab'

/**
 * Root /dashboard route.
 *
 * routes/auth.ts auto-creates a placeholder business row on a brand-new
 * phone number's first OTP login (hardcoded name "کسب‌وکار جدید" + an
 * arbitrary category), and business.ts's ensureCampaign() auto-provisions
 * an empty draft campaign the first time GET /campaign is called. Without
 * this gate, a new owner's very first screen after login was DashboardTab
 * rendering that placeholder data as if it were real: an unfamiliar
 * category label, "کسب‌وکار جدید" as the business name, and a "پیش‌نویس"
 * (draft) badge for a campaign the owner never created -- disorienting on
 * a first login, since none of it reflects anything the owner chose.
 *
 * Uses the same hasRealCampaign signal already relied on by AppShell's
 * campaignTo redirect and by CampaignWizardTab/CampaignEditorTab's own
 * guards (row existence alone can't distinguish "fresh business" from
 * "has a campaign", since ensureCampaign() always creates a row on first
 * read). A business with no real campaign yet is sent straight to the
 * wizard instead of the dashboard; going through it overwrites the
 * placeholder name/category with the owner's real answers (see
 * business.ts's generateCampaignForBusiness).
 */
export function DashboardIndexRoute() {
  const [hasRealCampaign, setHasRealCampaign] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true
    getCampaign(apiClient)
      .then((campaign) => {
        if (mounted) {
          setHasRealCampaign(
            campaign.status === 'active' || campaign.tasks.length > 0 || campaign.rewards.length > 0
          )
        }
      })
      .catch(() => {
        // On fetch failure, fail open to the dashboard rather than risking a
        // redirect loop -- same fail-open choice AppShell's own campaignTo
        // effect makes on error.
        if (mounted) setHasRealCampaign(true)
      })
    return () => {
      mounted = false
    }
  }, [])

  if (hasRealCampaign === null) {
    return <div className="p-4 text-sm text-slate-400">در حال بارگذاری...</div>
  }

  if (!hasRealCampaign) {
    return <Navigate to="/dashboard/campaign" replace />
  }

  return (
    <>
      <OnboardingBanner />
      <DashboardTab />
    </>
  )
}
