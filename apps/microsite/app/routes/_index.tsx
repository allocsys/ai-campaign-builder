import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";

import { getMicrositeData } from "../lib/mock-data";
import { Hero } from "../components/Hero";
import { CampaignHighlight } from "../components/CampaignHighlight";
import { About } from "../components/About";
import { ProductMenu } from "../components/ProductMenu";
import { Gallery } from "../components/Gallery";
import { Contact } from "../components/Contact";
import { Testimonials } from "../components/Testimonials";
import { BookingCta } from "../components/BookingCta";
import { NotFound } from "../components/NotFound";

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

  const data = slug ? await getMicrositeData(slug) : null;
  if (!data) {
    throw new Response("Microsite not found", { status: 404 });
  }
  return data;
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "میکروسایت پیدا نشد" }];
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

  return (
    <main>
      {data.modules.map((mod) => {
        switch (mod.module_key) {
          case "hero":
            return <Hero key={mod.id} content={mod.content} />;
          case "campaign_highlight":
            return data.featuredCampaign ? (
              <CampaignHighlight
                key={mod.id}
                content={mod.content}
                campaign={data.featuredCampaign}
              />
            ) : null;
          case "about":
            return <About key={mod.id} content={mod.content} />;
          case "product_menu":
            return <ProductMenu key={mod.id} content={mod.content} />;
          case "gallery":
            return <Gallery key={mod.id} content={mod.content} />;
          case "contact":
            return <Contact key={mod.id} content={mod.content} />;
          case "testimonials":
            return <Testimonials key={mod.id} content={mod.content} />;
          case "booking_cta":
            return <BookingCta key={mod.id} content={mod.content} />;
          default:
            return null;
        }
      })}
      <footer className="border-t border-stone-200 px-6 py-8 text-center text-sm text-stone-500">
        © {data.microsite.content.business_name}
      </footer>
    </main>
  );
}
