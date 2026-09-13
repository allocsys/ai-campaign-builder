import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card } from '@ai-campaign-builder/ui-kit'
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
 * read).
 *
 * Rather than a hard redirect straight into the wizard (which just swaps
 * one unexplained screen for another), a business with no real campaign
 * yet sees the normal dashboard rendered blurred underneath a cover card
 * with a single clear CTA -- the owner can see there's a real dashboard
 * waiting, understands why it's locked, and has one obvious next step.
 * The underlying placeholder data is blurred/non-interactive either way,
 * so its exact contents don't matter here. Going through the wizard
 * overwrites the placeholder name/category with the owner's real answers
 * (see business.ts's generateCampaignForBusiness).
 */
export function DashboardIndexRoute() {
  const navigate = useNavigate()
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
        // On fetch failure, fail open to the real dashboard rather than
        // risking a stuck cover screen -- same fail-open choice AppShell's
        // own campaignTo effect makes on error.
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
            <Button onClick={() => navigate('/dashboard/campaign')} className="w-full justify-center">
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
