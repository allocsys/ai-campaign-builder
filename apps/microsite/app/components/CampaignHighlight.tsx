import type { CampaignHighlightContent, FeaturedCampaign } from "../lib/mock-data";

export function CampaignHighlight({
  content,
  campaign,
}: {
  content: CampaignHighlightContent;
  campaign: FeaturedCampaign;
}) {
  return (
    <div className="mx-auto -mt-10 max-w-2xl rounded-2xl bg-[var(--accent-bg)] px-6 py-8 text-center text-[var(--accent-text)] shadow-xl">
      <h2 className="text-xl font-semibold">{content.title}</h2>
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
