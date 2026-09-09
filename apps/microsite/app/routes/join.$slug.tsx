import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";

import { getMicrositeData, type AnyBusinessMicrositeModule } from "../lib/mock-data";
import { NotFound } from "../components/NotFound";

// Real customer app deployment (see apps/deploy-index/public/index.html) —
// hardcoded for now since no real business-facing domain exists yet
// (architecture.md's subdomain scheme isn't live in production). Update this
// once a real domain is chosen.
const CUSTOMER_APP_URL = "https://ai-campaign-builder-customer.pachoolai24.workers.dev";

/**
 * Mirrors routes/_index.tsx's Host-header business resolution (see that
 * file's extractSubdomainSlug for the full explanation of why: production
 * has no real subdomains configured yet, so local/demo testing needs a query
 * param fallback). Duplicated rather than shared for now, matching this
 * codebase's existing convention of small per-file duplication over a
 * shared-lib extraction until there's a second real consumer that needs it
 * to stay perfectly in sync.
 */
function extractSubdomainSlug(host: string | null): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0];
  const parts = hostname.split(".");
  if (parts.length < 3) return null;
  return parts[0];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  // ?business= is this route's equivalent of _index.tsx's ?slug= dev
  // convenience — named differently so it doesn't collide if someone tests
  // by pasting a slug-qualified index URL's query string here by habit.
  const devBusinessSlug = url.searchParams.get("business");
  const businessSlug = devBusinessSlug ?? extractSubdomainSlug(request.headers.get("host"));

  if (!businessSlug) {
    throw new Response("Business not found", { status: 404 });
  }

  const data = await getMicrositeData(businessSlug);
  if (!data) {
    throw new Response("Business not found", { status: 404 });
  }

  const { featuredCampaign } = data;
  // Covers both "no campaign live right now" and "this slug is for a
  // campaign that has since ended/rotated out" — either way there's nothing
  // live at this exact join link, so a 404 is more honest than a stale or
  // empty page.
  if (!featuredCampaign || featuredCampaign.public_join_slug !== params.slug) {
    throw new Response("Campaign not found", { status: 404 });
  }

  const campaignModule = data.modules.find(
    (m) => m.module_key === "campaign_highlight",
  ) as Extract<AnyBusinessMicrositeModule, { module_key: "campaign_highlight" }> | undefined;

  return {
    businessName: data.microsite.content.business_name,
    theme: data.template.theme_identifier,
    title: campaignModule?.content.title || "کمپین فعال",
    description: campaignModule?.content.description ?? "",
    ctaLabel: campaignModule?.content.cta_label || "ادامه و عضویت",
  };
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "کمپین پیدا نشد" }];
  return [{ title: `${data.title} — ${data.businessName}` }];
};

export function ErrorBoundary() {
  return <NotFound />;
}

export default function JoinCampaign() {
  const data = useLoaderData<typeof loader>();

  return (
    <main
      data-theme={data.theme}
      className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center"
    >
      <div className="max-w-md rounded-2xl bg-[var(--accent-bg)] px-8 py-10 text-[var(--accent-text)] shadow-xl">
        <p className="text-sm opacity-80">{data.businessName}</p>
        <h1 className="mt-2 text-2xl font-bold">{data.title}</h1>
        {data.description ? (
          <p className="mt-3 text-[var(--accent-text)]/80">{data.description}</p>
        ) : null}
        <a
          href={CUSTOMER_APP_URL}
          className="mt-6 inline-block rounded-full bg-[var(--surface-card)] px-8 py-3 font-medium text-[var(--text)] transition hover:bg-[var(--accent-hover)]"
        >
          {data.ctaLabel}
        </a>
        <p className="mt-4 text-xs text-[var(--accent-text)]/60">
          برای عضویت به اپلیکیشن مشتریان منتقل می‌شوید.
        </p>
      </div>
    </main>
  );
}
