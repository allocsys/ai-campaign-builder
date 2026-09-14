import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card } from '@ai-campaign-builder/ui-kit'
import { getCampaignSummaries } from '@ai-campaign-builder/api-client'
import apiClient from '../lib/api-client'
import { OnboardingBanner } from './OnboardingBanner'
import { DashboardTab } from './tabs/DashboardTab'

/**
 * Purely decorative stand-in for the blurred background on the "not set up
 * yet" cover screen below. Deliberately renders NO real data and makes NO
 * API calls -- it exists only so the cover screen has something dashboard-
 * shaped to blur behind the CTA card.
 *
 * Bug fixed 2026-09-14: this used to be the REAL <DashboardTab />, just
 * wrapped in blur/opacity CSS. It still fully mounted, so its own useEffect
 * still fired and called getCampaign() (legacy singular GET /campaign),
 * which calls ensureCampaign() on the backend -- and ensureCampaign()
 * auto-INSERTs a real campaign row (goal: 'acquisition', status: 'draft')
 * the first time it's read for a business with none yet. So merely loading
 * this "you have no campaign" screen silently created a real phantom draft
 * campaign, and the next GET /campaigns check then found that row and
 * permanently disabled this very cover screen for that business -- even
 * though the owner never went through the wizard. This placeholder has no
 * effects and touches no endpoints, so it can't trigger that side effect.
 * Static numbers/labels below are arbitrary -- never shown un-blurred.
 */
function DashboardBackgroundPlaceholder() {
  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5 flex flex-col gap-3">
        <Badge tone="neutral">پیش‌نویس</Badge>
        <div className="h-4 w-2/3 rounded bg-white/10" />
        <div className="h-3 w-1/2 rounded bg-white/10" />
      </Card>

      <hr className="border-glass-border my-1" />

      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3">نمای کلی عملکرد</h3>
        <div className="grid grid-cols-2 gap-2.5">
          {['اعضای کل باشگاه', 'امتیاز اعطا شده', 'پاداش‌های تحویل شده', 'نرخ تبدیل مراجعین'].map((label) => (
            <Card key={label} className="p-4 flex flex-col gap-2">
              <Badge tone="neutral">{label}</Badge>
              <div className="h-6 w-12 rounded bg-white/10" />
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-2">تسک‌های کمپین</h3>
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="p-3.5 h-14" />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-2">جوایز</h3>
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <Card key={i} className="p-3.5 h-12" />
          ))}
        </div>
      </div>
    </div>
  )
}

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
 * sees a dashboard-shaped page rendered blurred underneath a cover card
 * with a single clear CTA -- the owner can see there's a real dashboard
 * waiting, understands why it's locked, and has one obvious next step.
 * The blurred background is DashboardBackgroundPlaceholder (a static,
 * non-fetching stand-in -- see its own comment for why this can't be the
 * real, data-fetching <DashboardTab /> here). Going through the wizard
 * creates the business's first real campaign (see business.ts's
 * generateCampaignForBusiness); only once hasAnyCampaign is confirmed true
 * does this route mount the real <DashboardTab />.
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
          <DashboardBackgroundPlaceholder />
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
