import type { CampaignHighlightContent, FeaturedCampaign } from "../lib/mock-data";

export function CampaignHighlight({
  content,
  campaign,
}: {
  content: CampaignHighlightContent;
  campaign: FeaturedCampaign;
}) {
  return (
    <div className="mx-auto -mt-10 max-w-2xl rounded-2xl bg-stone-900 px-6 py-8 text-center text-white shadow-xl">
      <h2 className="text-xl font-semibold">{content.title}</h2>
      <p className="mt-2 text-stone-300">{content.description}</p>
      <a
        href={`/join/${campaign.public_join_slug}`}
        className="mt-5 inline-block rounded-full bg-white px-6 py-2.5 font-medium text-stone-900 transition hover:bg-stone-100"
      >
        {content.cta_label}
      </a>
    </div>
  );
}
