// Real-data-access layer for the microsite renderer, backed by
// apps/backend's public /api/public/microsites/:slug endpoint (see plan.md
// Phase 0.75 "Backend-wiring scope decision", 2026-09-11).
//
// This file used to be a pure mock (a MOCK_DB fixture keyed by subdomain
// slug) -- getMicrositeData() was always the intended swap-out seam (see the
// git history of this file), and that swap has now happened: it calls the
// backend Worker over a Cloudflare service binding (see
// apps/microsite/wrangler.toml's [[services]] entry and workers/app.ts's Env
// type) instead of returning fixtures. The exported types below are
// unchanged in shape (still mirror architecture.md's website_templates /
// website_modules / business_microsites / business_microsite_modules
// tables) so no calling code (routes/_index.tsx, routes/join.$slug.tsx,
// components/*) needed to change its own type usage, only how it invokes
// getMicrositeData (now needs a Fetcher param -- see those files).

export type WebsiteModuleKey =
  | "hero"
  | "about"
  | "gallery"
  | "product_menu"
  | "testimonials"
  | "booking_cta"
  | "contact"
  | "campaign_highlight";

export interface WebsiteTemplate {
  id: string;
  name: string;
  theme_identifier: string;
}

export interface HeroContent {
  badge_label: string;
  title: string;
  subtitle: string;
}
export interface AboutContent {
  heading: string;
  description: string;
}
export interface GalleryContent {
  heading: string;
  images: { alt: string }[];
}
export interface ProductMenuContent {
  heading: string;
  items: { name: string; price_toman: number }[];
}
export interface TestimonialsContent {
  heading: string;
  items: { quote: string; author: string }[];
}
export interface BookingCtaContent {
  heading: string;
  button_label: string;
}
export interface ContactContent {
  address: string;
  phone: string;
  hours: string;
}
export interface CampaignHighlightContent {
  title: string;
  description: string;
  cta_label: string;
  // Shown instead of title/description/cta_label when featuredCampaign is
  // null (module enabled, but no campaign currently live). Optional so
  // narvan's existing content (which always has a live campaign for now)
  // doesn't need updating.
  no_campaign_title?: string;
  no_campaign_description?: string;
}

export type ModuleContentByKey = {
  hero: HeroContent;
  about: AboutContent;
  gallery: GalleryContent;
  product_menu: ProductMenuContent;
  testimonials: TestimonialsContent;
  booking_cta: BookingCtaContent;
  contact: ContactContent;
  campaign_highlight: CampaignHighlightContent;
};

// business_microsite_modules row, denormalized with its module_key for
// convenience (the backend's public endpoint joins this in -- see
// apps/backend/src/routes/public-microsite.ts).
export interface BusinessMicrositeModule<
  K extends WebsiteModuleKey = WebsiteModuleKey,
> {
  id: string;
  business_microsite_id: string;
  website_module_id: string;
  module_key: K;
  enabled: boolean;
  display_order: number;
  content: ModuleContentByKey[K];
}

export interface FeaturedCampaign {
  id: string;
  public_join_slug: string;
  // Added 2026-09-11 (plan.md Open Item 3) -- lets CampaignHighlight render
  // goal-driven CTA copy (acquisition vs. retention messaging) without that
  // copy needing to be authored per-module in business_microsite_modules.content.
  // acquisition_retention added later the same day for the combined-goal
  // campaign option.
  goal: "acquisition" | "retention" | "acquisition_retention";
}

export interface BusinessMicrositeContent {
  logo_url: string | null;
  business_name: string;
  tagline: string;
}

export interface BusinessMicrosite {
  id: string;
  business_id: string;
  website_template_id: string;
  subdomain_slug: string;
  content: BusinessMicrositeContent;
  featured_campaign_id: string | null;
  published: boolean;
  addon_status: "active" | "cancelled";
}

// Distributes BusinessMicrositeModule<K> over every K in WebsiteModuleKey,
// producing a proper 8-variant discriminated union (module_key: K paired
// with its matching content: ModuleContentByKey[K]) instead of one type with
// two independently-typed unions. This is what lets a `switch (mod.module_key)`
// narrow `mod.content` to the matching content type in each case.
export type AnyBusinessMicrositeModule = {
  [K in WebsiteModuleKey]: BusinessMicrositeModule<K>;
}[WebsiteModuleKey];

export interface MicrositeData {
  microsite: BusinessMicrosite;
  template: WebsiteTemplate;
  // Already filtered to enabled=true and sorted by display_order by the
  // backend's SQL query.
  modules: AnyBusinessMicrositeModule[];
  featuredCampaign: FeaturedCampaign | null;
}

/**
 * Resolves a business's published microsite by subdomain slug via
 * apps/backend's public endpoint, called through the Cloudflare service
 * binding passed in from the Worker's Env (see workers/app.ts and the two
 * loaders in app/routes/). Returns null for an unknown slug or an
 * unpublished microsite (caller renders a 404) -- same contract this
 * function had when it was mock-data-backed.
 */
export async function getMicrositeData(
  subdomainSlug: string,
  backend: Fetcher,
): Promise<MicrositeData | null> {
  // The URL's host is never actually routed anywhere with a service binding
  // (Cloudflare dispatches straight to the bound Worker) -- only the path
  // matters, but a syntactically valid absolute URL is still required.
  const response = await backend.fetch(
    `https://backend.internal/api/public/microsites/${encodeURIComponent(subdomainSlug)}`,
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Response("Failed to load microsite data from backend", { status: 502 });
  }

  return (await response.json()) as MicrositeData;
}
