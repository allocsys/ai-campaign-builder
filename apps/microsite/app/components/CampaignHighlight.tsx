import type { CampaignHighlightContent, FeaturedCampaign } from "../lib/mock-data";

/**
 * Two states, same visual shell:
 * - campaign present: real title/description/cta_label, links to /join/:slug
 *   (a live route on this app that hands off to the customer app — see
 *   routes/join.$slug.tsx). A small badge above the title reflects the
 *   campaign's goal (added 2026-09-11, plan.md Open Item 3) — acquisition
 *   campaigns lead with "new customer" framing, retention campaigns lead
 *   with "existing customer" framing, independent of whatever specific copy
 *   a business authored for title/description/cta_label.
 * - campaign null (module enabled, nothing live yet): falls back to
 *   no_campaign_title/no_campaign_description, no link/button/badge at all.
 */
const GOAL_BADGE: Record<FeaturedCampaign["goal"], string> = {
  acquisition: "🎉 ویژه اعضای جدید",
  retention: "💚 ویژه مشتریان همیشگی",
  acquisition_retention: "✨ برای همه؛ اعضای جدید و همیشگی",
};

export function CampaignHighlight({
  content,
  campaign,
}: {
  content: CampaignHighlightContent;
  campaign: FeaturedCampaign | null;
}) {
  if (!campaign) {
    return (
      <div className="mx-auto -mt-10 max-w-2xl rounded-2xl bg-[var(--accent-bg)] px-6 py-8 text-center text-[var(--accent-text)] shadow-xl">
        <h2 className="text-xl font-semibold">
          {content.no_campaign_title ?? "کمپین بعدی به‌زودی می‌آید"}
        </h2>
        <p className="mt-2 text-[var(--accent-text)]/80">
          {content.no_campaign_description ??
            "در حال حاضر کمپین فعالی نداریم — به‌زودی جزئیات کمپین جدید و لینک عضویت اینجا نمایش داده می‌شود."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto -mt-10 max-w-2xl rounded-2xl bg-[var(--accent-bg)] px-6 py-8 text-center text-[var(--accent-text)] shadow-xl">
      <span className="inline-block rounded-full bg-[var(--accent-text)]/10 px-3 py-1 text-xs font-medium">
        {GOAL_BADGE[campaign.goal]}
      </span>
      <h2 className="mt-3 text-xl font-semibold">{content.title}</h2>
      <p className="mt-2 text-[var(--accent-text)]/80">{content.description}</p>
      <a
        href={`/join/${campaign.public_join_slug}`}
        className="mt-5 inline-block rounded-full bg-[var(--surface-card)] px-6 py-2.5 font-medium text-[var(--text)] transition hover:bg-[var(--accent-hover)]"
      >
        {content.cta_label}
      </a>
    </div>
  );
}
