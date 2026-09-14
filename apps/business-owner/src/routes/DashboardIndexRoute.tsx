import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card } from '@ai-campaign-builder/ui-kit'
import { getCampaignSummaries } from '@ai-campaign-builder/api-client'
import apiClient from '../lib/api-client'
import { OnboardingBanner } from './OnboardingBanner'
import { DashboardTab } from './tabs/DashboardTab'

/**
 * Root /dashboard route.
 *
 * routes/auth.ts auto-creates a placeholder business row on a brand-new
 * phone number's first OTP login (hardcoded name "کسب‌وکار جدید" + an
 * arbitrary category). Without this gate, a new owner's very first screen
 * after login was DashboardTab rendering that placeholder data as if it
 * were real: an unfamiliar category label and "کسب‌وکار جدید" as the
 * business name -- disorienting on a first login, since none of it
 * reflects anything the owner chose.
 *
 * plan.md Item 21 -- switched from the legacy single-campaign
 * hasRealCampaign signal (GET /campaign, which auto-provisions an empty
 * draft row on first read via ensureCampaign(), so row existence alone
 * couldn't distinguish "fresh business" from "has a campaign") to GET
 * /campaigns (the new list endpoint, which does NOT auto-provision
 * anything -- a truly fresh business gets back an empty array). A simple
 * "has at least one campaign row" check is now sufficient and no longer
 * needs the tasks.length/rewards.length heuristic the old signal required.
 *
 * Rather than a hard redirect straight into the wizard (which just swaps
 * one unexplained screen for another), a business with no campaigns yet
 * sees the normal dashboard rendered blurred underneath a cover card
 * with a single clear CTA -- the owner can see there's a real dashboard
 * waiting, understands why it's locked, and has one obvious next step.
 * The underlying placeholder data is blurred/non-interactive either way,
 * so its exact contents don't matter here. Going through the wizard
 * overwrites the placeholder name/category with the owner's real answers
 * (see business.ts's generateCampaignForBusiness).
 */
export function DashboardIndexRoute() {
  const navigate = useNavigate()
  const [hasAnyCampaign, setHasAnyCampaign] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true
    getCampaignSummaries(apiClient)
      .then((campaigns) => {
        if (mounted) setHasAnyCampaign(campaigns.length > 0)
      })
      .catch(() => {
        // On fetch failure, fail open to the real dashboard rather than
        // risking a stuck cover screen.
        if (mounted) setHasAnyCampaign(true)
      })
    return () => {
      mounted = false
    }
  }, [])

  if (hasAnyCampaign === null) {
    return <div className="p-4 text-sm text-slate-400">در حال بارگذاری...</div>
  }

  if (!hasAnyCampaign) {
    return (
      <div className="relative min-h-[70vh]">
        <div className="pointer-events-none select-none blur-md opacity-50" aria-hidden="true">
          <DashboardTab />
        </div>
        <div className="absolute inset-0 flex items-start justify-center pt-16 px-4">
          <Card className="max-w-sm w-full p-6 flex flex-col items-center gap-4 text-center shadow-2xl border-brand-500/40">
            <span className="text-3xl" aria-hidden="true">
              ✨
            </span>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-base font-bold text-slate-100">کسب‌وکار شما هنوز راه‌اندازی نشده</h2>
              <p className="text-sm text-slate-400">
                برای مشاهده داشبورد، ابتدا با کمک دستیار هوشمند کمپین اولیه خود را بسازید. چند دقیقه بیشتر طول نمی‌کشد.
              </p>
            </div>
            <Button onClick={() => navigate('/dashboard/campaign/new')} className="w-full justify-center">
              ساخت کمپین با دستیار هوشمند
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <>
      <OnboardingBanner />
      <DashboardTab />
    </>
  )
}
