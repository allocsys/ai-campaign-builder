import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";

import { getMicrositeData } from "../lib/mock-data";
import { Hero } from "../components/Hero";
import { Landing } from "../components/Landing";
import { CampaignHighlight } from "../components/CampaignHighlight";
import { StickyJoinCta } from "../components/StickyJoinCta";
import { About } from "../components/About";
import { ProductMenu } from "../components/ProductMenu";
import { Gallery } from "../components/Gallery";
import { Contact } from "../components/Contact";
import { Testimonials } from "../components/Testimonials";
import { BookingCta } from "../components/BookingCta";
import { NotFound } from "../components/NotFound";
import { Reveal } from "../components/Reveal";

/**
 * Extracts the business subdomain slug from a Host header, e.g.
 * "narvan.ourdomain.com" -> "narvan". Returns null for hosts with no
 * meaningful subdomain (localhost, a bare apex domain, an IP, etc.) so local
 * dev can fall back to a query param instead (see loader below).
 */
function extractSubdomainSlug(host: string | null): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0];
  const parts = hostname.split(".");
  if (parts.length < 3) return null;
  return parts[0];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  // Local-dev convenience only (mirrors mockup/microsite-preview.html's
  // ?business_id= param) — production resolution is Host-header-only, since
  // real subdomains won't carry a query param.
  const devSlug = url.searchParams.get("slug");
  const slug = devSlug ?? extractSubdomainSlug(request.headers.get("host"));

  // No slug at all (bare host — e.g. the platform's own workers.dev root, or
  // a bare apex domain before any business has claimed a subdomain) is a
  // different case from "slug given but unknown": there's no specific
  // business someone was trying to reach, so this isn't a 404 — it's the
  // platform's own landing page.
  if (!slug) {
    return { kind: "landing" as const };
  }

  const data = await getMicrositeData(slug);
  if (!data) {
    throw new Response("Microsite not found", { status: 404 });
  }
  return { kind: "microsite" as const, ...data };
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data || data.kind === "landing") {
    return [{ title: "ai-campaign-builder — میکروسایت‌ها" }];
  }
  return [
    {
      title: `${data.microsite.content.business_name} — ${data.microsite.content.tagline}`,
    },
  ];
};

export function ErrorBoundary() {
  return <NotFound />;
}

export default function MicrositeIndex() {
  const data = useLoaderData<typeof loader>();

  if (data.kind === "landing") {
    return <Landing />;
  }

  return (
    <main data-theme={data.template.theme_identifier}>
      {data.modules.map((mod) => {
        switch (mod.module_key) {
          case "hero":
            // Not wrapped in Reveal: it's always above the fold at load,
            // and already has its own ambient canvas motion (HeroAmbient).
            return <Hero key={mod.id} content={mod.content} />;
          case "campaign_highlight":
            // Always rendered when the module is enabled — CampaignHighlight
            // itself switches between the real CTA and a "no campaign yet"
            // fallback based on whether featuredCampaign is null.
            return (
              <Reveal key={mod.id}>
                <CampaignHighlight content={mod.content} campaign={data.featuredCampaign} />
              </Reveal>
            );
          case "about":
            return (
              <Reveal key={mod.id}>
                <About content={mod.content} />
              </Reveal>
            );
          case "product_menu":
            return (
              <Reveal key={mod.id}>
                <ProductMenu content={mod.content} />
              </Reveal>
            );
          case "gallery":
            return (
              <Reveal key={mod.id}>
                <Gallery content={mod.content} />
              </Reveal>
            );
          case "contact":
            return (
              <Reveal key={mod.id}>
                <Contact content={mod.content} />
              </Reveal>
            );
          case "testimonials":
            return (
              <Reveal key={mod.id}>
                <Testimonials content={mod.content} />
              </Reveal>
            );
          case "booking_cta":
            return (
              <Reveal key={mod.id}>
                <BookingCta content={mod.content} />
              </Reveal>
            );
          default:
            return null;
        }
      })}
      <footer className="border-t border-[var(--border)] px-6 py-8 text-center text-sm text-[var(--text-subtle)]">
        © {data.microsite.content.business_name}
      </footer>
      {data.featuredCampaign ? (
        <StickyJoinCta
          href={`/join/${data.featuredCampaign.public_join_slug}`}
          label={
            data.modules.find((m) => m.module_key === "campaign_highlight")?.content.cta_label ??
            "عضویت در کمپین"
          }
        />
      ) : null}
    </main>
  );
}
