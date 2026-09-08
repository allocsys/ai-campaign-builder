// Swappable mock data-access layer for the microsite renderer.
//
// Mirrors the pattern used by the other 4 persona apps' src/lib/mock-data.ts:
// no real backend/D1 exists yet (apps/backend hasn't been built), so this
// simulates what a future D1 query / backend fetch will return. The single
// exported entry point, getMicrositeData(), is the intended seam — swap its
// body for a real D1 query (business_microsites JOIN business_microsite_modules
// JOIN website_modules, filtered/ordered exactly as done here) or a backend
// fetch call, without touching any calling code.
//
// Types below mirror architecture.md's website_templates / website_modules /
// business_microsites / business_microsite_modules tables (see that file for
// the authoritative field list).

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
// convenience in this mock layer (a real D1 query would join it in).
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

export interface MicrositeData {
  microsite: BusinessMicrosite;
  template: WebsiteTemplate;
  // Already filtered to enabled=true and sorted by display_order — a real D1
  // query would apply `WHERE enabled = 1 ORDER BY display_order` directly.
  modules: BusinessMicrositeModule[];
  featuredCampaign: FeaturedCampaign | null;
}

const MOCK_DB: Record<string, MicrositeData> = {
  narvan: {
    microsite: {
      id: "ms_narvan",
      business_id: "b_narvan",
      website_template_id: "tmpl_minimal_cafe",
      subdomain_slug: "narvan",
      content: {
        logo_url: null,
        business_name: "کافه نارون",
        tagline: "طعم اصیل، فضای دنج",
      },
      featured_campaign_id: "c_narvan_autumn",
      published: true,
      addon_status: "active",
    },
    template: {
      id: "tmpl_minimal_cafe",
      name: "کافه دنج (Minimal Cafe)",
      theme_identifier: "minimal_cafe",
    },
    featuredCampaign: {
      id: "c_narvan_autumn",
      public_join_slug: "narvan-autumn",
    },
    modules: [
      {
        id: "bmm_narvan_hero",
        business_microsite_id: "ms_narvan",
        website_module_id: "wm_hero",
        module_key: "hero",
        enabled: true,
        display_order: 0,
        content: {
          badge_label: "☕ کافه نارون",
          title: "طعم اصیل، فضای دنج، هر روز کنار شما",
          subtitle:
            "از سال ۱۳۹۸ میزبان لحظات آرام شما در قلب ولیعصر — قهوه‌ی تخصصی، دسرهای خانگی و فضایی برای گفتگو.",
        },
      },
      {
        id: "bmm_narvan_campaign",
        business_microsite_id: "ms_narvan",
        website_module_id: "wm_campaign_highlight",
        module_key: "campaign_highlight",
        enabled: true,
        display_order: 1,
        content: {
          title: "کمپین وفاداری پاییزه فعال است!",
          description:
            "با عضویت رایگان، اولین نوشیدنی گرم شما مهمان ماست — به‌علاوه امکان دریافت جوایز بیشتر با دعوت از دوستان.",
          cta_label: "عضویت در کمپین و دریافت کد شخصی",
        },
      },
      {
        id: "bmm_narvan_about",
        business_microsite_id: "ms_narvan",
        website_module_id: "wm_about",
        module_key: "about",
        enabled: true,
        display_order: 2,
        content: {
          heading: "درباره کافه نارون",
          description:
            "کافه نارون با هدف ساختن یک فضای گرم و صمیمی برای علاقه‌مندان به قهوه‌ی تخصصی راه‌اندازی شد. دانه‌های ما به‌صورت تازه بو داده می‌شوند و هر فنجان با دقت و عشق تهیه می‌شود.",
        },
      },
      {
        id: "bmm_narvan_menu",
        business_microsite_id: "ms_narvan",
        website_module_id: "wm_product_menu",
        module_key: "product_menu",
        enabled: true,
        display_order: 3,
        content: {
          heading: "منوی محبوب‌ترین اقلام",
          items: [
            { name: "آمریکانو", price_toman: 85000 },
            { name: "کاپوچینو", price_toman: 95000 },
            { name: "موکای مخصوص نارون", price_toman: 110000 },
            { name: "چیزکیک خانگی", price_toman: 140000 },
          ],
        },
      },
      {
        id: "bmm_narvan_gallery",
        business_microsite_id: "ms_narvan",
        website_module_id: "wm_gallery",
        module_key: "gallery",
        enabled: true,
        display_order: 4,
        content: {
          heading: "فضای کافه",
          images: [
            { alt: "عکس فضای داخلی" },
            { alt: "عکس بار قهوه" },
            { alt: "عکس میزهای حیاط" },
            { alt: "عکس دسر و نوشیدنی" },
          ],
        },
      },
      {
        id: "bmm_narvan_contact",
        business_microsite_id: "ms_narvan",
        website_module_id: "wm_contact",
        module_key: "contact",
        enabled: true,
        display_order: 5,
        content: {
          address: "تهران، ولیعصر، خیابان توانیر، پلاک ۱۲",
          phone: "۰۲۱-۸۸۸۸۸۸۸۸",
          hours: "همه‌روزه، ۸:۰۰ تا ۲۳:۰۰",
        },
      },
      {
        id: "bmm_narvan_testimonials",
        business_microsite_id: "ms_narvan",
        website_module_id: "wm_testimonials",
        module_key: "testimonials",
        enabled: true,
        display_order: 6,
        content: {
          heading: "نظرات مشتریان وفادار",
          items: [
            { quote: "بهترین قهوه محله‌مون! فضاش خیلی آرومه.", author: "سارا ا." },
          ],
        },
      },
      {
        id: "bmm_narvan_booking",
        business_microsite_id: "ms_narvan",
        website_module_id: "wm_booking_cta",
        module_key: "booking_cta",
        enabled: true,
        display_order: 7,
        content: {
          heading: "رزرو میز یا وقت قبلی",
          button_label: "رزرو میز",
        },
      },
    ],
  },
};

/**
 * Resolves a business's published microsite by subdomain slug. Returns null
 * for an unknown slug or an unpublished microsite (caller renders a 404).
 *
 * Real implementation (once apps/backend/D1 exist) will replace this body
 * with something like:
 *   SELECT ... FROM business_microsites
 *   JOIN business_microsite_modules ON ... WHERE enabled = 1
 *   JOIN website_modules ON ...
 *   WHERE business_microsites.subdomain_slug = ? AND published = 1
 *   ORDER BY business_microsite_modules.display_order
 */
export async function getMicrositeData(
  subdomainSlug: string,
): Promise<MicrositeData | null> {
  const data = MOCK_DB[subdomainSlug];
  if (!data || !data.microsite.published) return null;
  return data;
}
