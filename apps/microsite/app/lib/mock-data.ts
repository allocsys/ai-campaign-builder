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
  // Already filtered to enabled=true and sorted by display_order — a real D1
  // query would apply `WHERE enabled = 1 ORDER BY display_order` directly.
  modules: AnyBusinessMicrositeModule[];
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
  velora: {
    microsite: {
      id: "ms_velora",
      business_id: "b_velora",
      website_template_id: "tmpl_bold_retail",
      subdomain_slug: "velora",
      content: {
        logo_url: null,
        business_name: "بوتیک ولورا",
        tagline: "استایل شخصی، امضای خودت",
      },
      featured_campaign_id: null,
      published: true,
      addon_status: "active",
    },
    template: {
      id: "tmpl_bold_retail",
      name: "بوتیک مدرن (Bold Retail)",
      theme_identifier: "bold_retail",
    },
    featuredCampaign: null,
    modules: [
      {
        id: "bmm_velora_hero",
        business_microsite_id: "ms_velora",
        website_module_id: "wm_hero",
        module_key: "hero",
        enabled: true,
        display_order: 0,
        content: {
          badge_label: "🧵 بوتیک ولورا",
          title: "لباسی که داستان شما را روایت می‌کند",
          subtitle:
            "گزیده‌ای از پوشاک زنانه و مردانه با طراحی محدود — کیفیت پارچه، برش دقیق و سبکی که فقط برای شما انتخاب شده.",
        },
      },
      {
        id: "bmm_velora_about",
        business_microsite_id: "ms_velora",
        website_module_id: "wm_about",
        module_key: "about",
        enabled: true,
        display_order: 1,
        content: {
          heading: "درباره ولورا",
          description:
            "ولورا از دل عشق به طراحی محدود و متفاوت شکل گرفت. هر مجموعه در تیراژ کم تولید می‌شود تا حس خاص‌بودن را برای مشتریانش حفظ کند.",
        },
      },
      {
        id: "bmm_velora_menu",
        business_microsite_id: "ms_velora",
        website_module_id: "wm_product_menu",
        module_key: "product_menu",
        enabled: true,
        display_order: 2,
        content: {
          heading: "محصولات منتخب",
          items: [
            { name: "کت بلند پشمی", price_toman: 2450000 },
            { name: "پیراهن ابریشمی", price_toman: 980000 },
            { name: "شلوار پارچه‌ای برش‌دار", price_toman: 760000 },
            { name: "شال دست‌بافت", price_toman: 420000 },
          ],
        },
      },
      {
        id: "bmm_velora_gallery",
        business_microsite_id: "ms_velora",
        website_module_id: "wm_gallery",
        module_key: "gallery",
        enabled: true,
        display_order: 3,
        content: {
          heading: "از مجموعه جدید",
          images: [
            { alt: "عکس مجموعه پاییزه" },
            { alt: "عکس ویترین بوتیک" },
            { alt: "عکس جزئیات پارچه" },
            { alt: "عکس فضای فروشگاه" },
          ],
        },
      },
      {
        id: "bmm_velora_testimonials",
        business_microsite_id: "ms_velora",
        website_module_id: "wm_testimonials",
        module_key: "testimonials",
        enabled: true,
        display_order: 4,
        content: {
          heading: "نظرات مشتریان",
          items: [
            { quote: "کیفیت دوخت و پارچه واقعاً حرف نداره.", author: "نگین م." },
          ],
        },
      },
      {
        id: "bmm_velora_contact",
        business_microsite_id: "ms_velora",
        website_module_id: "wm_contact",
        module_key: "contact",
        enabled: true,
        display_order: 5,
        content: {
          address: "تهران، زعفرانیه، خیابان ولیعصر، پلاک ۴۵",
          phone: "۰۲۱-۲۲۲۲۲۲۲۲",
          hours: "شنبه تا پنجشنبه، ۱۰:۰۰ تا ۲۰:۰۰",
        },
      },
      {
        id: "bmm_velora_booking",
        business_microsite_id: "ms_velora",
        website_module_id: "wm_booking_cta",
        module_key: "booking_cta",
        enabled: true,
        display_order: 6,
        content: {
          heading: "وقت مشاوره استایل رزرو کنید",
          button_label: "رزرو مشاوره",
        },
      },
    ],
  },
  titan: {
    microsite: {
      id: "ms_titan",
      business_id: "b_titan",
      website_template_id: "tmpl_energetic_gym",
      subdomain_slug: "titan",
      content: {
        logo_url: null,
        business_name: "باشگاه تایتان",
        tagline: "قدرت واقعی از اینجا شروع می‌شود",
      },
      featured_campaign_id: null,
      published: true,
      addon_status: "active",
    },
    template: {
      id: "tmpl_energetic_gym",
      name: "باشگاه پرانرژی (Energetic Gym)",
      theme_identifier: "energetic_gym",
    },
    featuredCampaign: null,
    modules: [
      {
        id: "bmm_titan_hero",
        business_microsite_id: "ms_titan",
        website_module_id: "wm_hero",
        module_key: "hero",
        enabled: true,
        display_order: 0,
        content: {
          badge_label: "🏋️ باشگاه تایتان",
          title: "بدنی قوی‌تر، ذهنی متمرکزتر",
          subtitle:
            "برنامه‌های تمرینی اختصاصی، مربیان حرفه‌ای و فضایی مجهز برای رسیدن به بهترین نسخه خودتان.",
        },
      },
      {
        id: "bmm_titan_about",
        business_microsite_id: "ms_titan",
        website_module_id: "wm_about",
        module_key: "about",
        enabled: true,
        display_order: 1,
        content: {
          heading: "درباره باشگاه تایتان",
          description:
            "باشگاه تایتان با تجهیزات مدرن و مربیان مجرب، مسیر رسیدن به اهداف تناسب اندام شما را کوتاه‌تر می‌کند. چه مبتدی باشید چه حرفه‌ای، برنامه‌ای متناسب شما داریم.",
        },
      },
      {
        id: "bmm_titan_menu",
        business_microsite_id: "ms_titan",
        website_module_id: "wm_product_menu",
        module_key: "product_menu",
        enabled: true,
        display_order: 2,
        content: {
          heading: "بسته‌های عضویت",
          items: [
            { name: "عضویت ماهانه", price_toman: 1200000 },
            { name: "عضویت سه‌ماهه", price_toman: 3200000 },
            { name: "جلسه خصوصی با مربی", price_toman: 450000 },
            { name: "کلاس گروهی (هر جلسه)", price_toman: 180000 },
          ],
        },
      },
      {
        id: "bmm_titan_gallery",
        business_microsite_id: "ms_titan",
        website_module_id: "wm_gallery",
        module_key: "gallery",
        enabled: true,
        display_order: 3,
        content: {
          heading: "فضای باشگاه",
          images: [
            { alt: "عکس سالن بدنسازی" },
            { alt: "عکس سالن کلاس‌های گروهی" },
            { alt: "عکس منطقه کاردیو" },
            { alt: "عکس اتاق ریکاوری" },
          ],
        },
      },
      {
        id: "bmm_titan_testimonials",
        business_microsite_id: "ms_titan",
        website_module_id: "wm_testimonials",
        module_key: "testimonials",
        enabled: true,
        display_order: 4,
        content: {
          heading: "نظرات ورزشکاران",
          items: [
            { quote: "بعد از سه ماه تمرین اینجا واقعاً نتیجه رو دیدم.", author: "آرمان ک." },
          ],
        },
      },
      {
        id: "bmm_titan_contact",
        business_microsite_id: "ms_titan",
        website_module_id: "wm_contact",
        module_key: "contact",
        enabled: true,
        display_order: 5,
        content: {
          address: "تهران، سعادت‌آباد، بلوار دریا، پلاک ۸",
          phone: "۰۲۱-۲۶۶۶۶۶۶۶",
          hours: "همه‌روزه، ۶:۰۰ تا ۲۳:۰۰",
        },
      },
      {
        id: "bmm_titan_booking",
        business_microsite_id: "ms_titan",
        website_module_id: "wm_booking_cta",
        module_key: "booking_cta",
        enabled: true,
        display_order: 6,
        content: {
          heading: "یک جلسه رایگان رزرو کنید",
          button_label: "رزرو جلسه رایگان",
        },
      },
    ],
  },
  ava: {
    microsite: {
      id: "ms_ava",
      business_id: "b_ava",
      website_template_id: "tmpl_serene_beauty",
      subdomain_slug: "ava",
      content: {
        logo_url: null,
        business_name: "کلینیک زیبایی آوا",
        tagline: "پوستی درخشان، اعتمادبه‌نفسی تازه",
      },
      featured_campaign_id: null,
      published: true,
      addon_status: "active",
    },
    template: {
      id: "tmpl_serene_beauty",
      name: "کلینیک آرام (Serene Beauty)",
      theme_identifier: "serene_beauty",
    },
    featuredCampaign: null,
    modules: [
      {
        id: "bmm_ava_hero",
        business_microsite_id: "ms_ava",
        website_module_id: "wm_hero",
        module_key: "hero",
        enabled: true,
        display_order: 0,
        content: {
          badge_label: "✨ کلینیک زیبایی آوا",
          title: "پوستی درخشان، اعتمادبه‌نفسی تازه",
          subtitle:
            "خدمات تخصصی پوست و زیبایی با جدیدترین تجهیزات و متخصصان مجرب، در محیطی آرام و اختصاصی.",
        },
      },
      {
        id: "bmm_ava_about",
        business_microsite_id: "ms_ava",
        website_module_id: "wm_about",
        module_key: "about",
        enabled: true,
        display_order: 1,
        content: {
          heading: "درباره کلینیک آوا",
          description:
            "کلینیک زیبایی آوا با هدف ارائه خدمات باکیفیت و ایمن پوست و زیبایی تأسیس شد. تیم متخصص ما با بهره‌گیری از دستگاه‌های روز دنیا، بهترین نتیجه را برای شما به ارمغان می‌آورد.",
        },
      },
      {
        id: "bmm_ava_menu",
        business_microsite_id: "ms_ava",
        website_module_id: "wm_product_menu",
        module_key: "product_menu",
        enabled: true,
        display_order: 2,
        content: {
          heading: "خدمات محبوب",
          items: [
            { name: "لیزر موهای زائد (هر جلسه)", price_toman: 850000 },
            { name: "میکرونیدلینگ صورت", price_toman: 1450000 },
            { name: "پاکسازی پوست", price_toman: 650000 },
            { name: "مزوتراپی مو", price_toman: 1200000 },
          ],
        },
      },
      {
        id: "bmm_ava_gallery",
        business_microsite_id: "ms_ava",
        website_module_id: "wm_gallery",
        module_key: "gallery",
        enabled: true,
        display_order: 3,
        content: {
          heading: "فضای کلینیک",
          images: [
            { alt: "عکس اتاق درمان" },
            { alt: "عکس لابی کلینیک" },
            { alt: "عکس دستگاه‌های لیزر" },
            { alt: "عکس فضای استراحت" },
          ],
        },
      },
      {
        id: "bmm_ava_testimonials",
        business_microsite_id: "ms_ava",
        website_module_id: "wm_testimonials",
        module_key: "testimonials",
        enabled: true,
        display_order: 4,
        content: {
          heading: "نظرات مراجعین",
          items: [
            { quote: "نتیجه لیزر فوق‌العاده بود و کادر خیلی حرفه‌ای بودن.", author: "مینا ر." },
          ],
        },
      },
      {
        id: "bmm_ava_contact",
        business_microsite_id: "ms_ava",
        website_module_id: "wm_contact",
        module_key: "contact",
        enabled: true,
        display_order: 5,
        content: {
          address: "تهران، الهیه، خیابان فرشته، پلاک ۲۲",
          phone: "۰۲۱-۲۲۹۹۹۹۹۹",
          hours: "شنبه تا پنجشنبه، ۱۰:۰۰ تا ۲۰:۰۰",
        },
      },
      {
        id: "bmm_ava_booking",
        business_microsite_id: "ms_ava",
        website_module_id: "wm_booking_cta",
        module_key: "booking_cta",
        enabled: true,
        display_order: 6,
        content: {
          heading: "وقت مشاوره رایگان رزرو کنید",
          button_label: "رزرو وقت مشاوره",
        },
      },
    ],
  },
  simorgh: {
    microsite: {
      id: "ms_simorgh",
      business_id: "b_simorgh",
      website_template_id: "tmpl_fine_dining",
      subdomain_slug: "simorgh",
      content: {
        logo_url: null,
        business_name: "رستوران سیمرغ",
        tagline: "طعمی ماندگار از سنت ایرانی",
      },
      featured_campaign_id: null,
      published: true,
      addon_status: "active",
    },
    template: {
      id: "tmpl_fine_dining",
      name: "رستوران لوکس (Fine Dining)",
      theme_identifier: "fine_dining",
    },
    featuredCampaign: null,
    modules: [
      {
        id: "bmm_simorgh_hero",
        business_microsite_id: "ms_simorgh",
        website_module_id: "wm_hero",
        module_key: "hero",
        enabled: true,
        display_order: 0,
        content: {
          badge_label: "🍽️ رستوران سیمرغ",
          title: "طعمی ماندگار از سنت ایرانی",
          subtitle:
            "تجربه‌ای اصیل از غذاهای سنتی ایرانی با بهترین مواد اولیه، در فضایی گرم و خاطره‌انگیز.",
        },
      },
      {
        id: "bmm_simorgh_about",
        business_microsite_id: "ms_simorgh",
        website_module_id: "wm_about",
        module_key: "about",
        enabled: true,
        display_order: 1,
        content: {
          heading: "درباره سیمرغ",
          description:
            "رستوران سیمرغ بیش از یک دهه است که طعم اصیل غذای ایرانی را با احترام به سنت و کیفیت بی‌نظیر به مهمانان خود ارائه می‌دهد.",
        },
      },
      {
        id: "bmm_simorgh_menu",
        business_microsite_id: "ms_simorgh",
        website_module_id: "wm_product_menu",
        module_key: "product_menu",
        enabled: true,
        display_order: 2,
        content: {
          heading: "پیشنهاد سرآشپز",
          items: [
            { name: "چلوکباب سلطانی", price_toman: 1850000 },
            { name: "خورش فسنجان", price_toman: 1250000 },
            { name: "زرشک‌پلو با مرغ", price_toman: 980000 },
            { name: "آش رشته", price_toman: 420000 },
          ],
        },
      },
      {
        id: "bmm_simorgh_gallery",
        business_microsite_id: "ms_simorgh",
        website_module_id: "wm_gallery",
        module_key: "gallery",
        enabled: true,
        display_order: 3,
        content: {
          heading: "فضای رستوران",
          images: [
            { alt: "عکس سالن اصلی" },
            { alt: "عکس تراس رستوران" },
            { alt: "عکس میز چیده‌شده" },
            { alt: "عکس آشپزخانه باز" },
          ],
        },
      },
      {
        id: "bmm_simorgh_testimonials",
        business_microsite_id: "ms_simorgh",
        website_module_id: "wm_testimonials",
        module_key: "testimonials",
        enabled: true,
        display_order: 4,
        content: {
          heading: "نظرات مهمانان",
          items: [
            { quote: "طعم غذاها دقیقاً مثل غذای خونگی بود، عالی!", author: "حسین ت." },
          ],
        },
      },
      {
        id: "bmm_simorgh_contact",
        business_microsite_id: "ms_simorgh",
        website_module_id: "wm_contact",
        module_key: "contact",
        enabled: true,
        display_order: 5,
        content: {
          address: "تهران، ونک، خیابان ملاصدرا، پلاک ۶۳",
          phone: "۰۲۱-۸۸۷۷۷۷۷۷",
          hours: "همه‌روزه، ۱۲:۰۰ تا ۲۳:۳۰",
        },
      },
      {
        id: "bmm_simorgh_booking",
        business_microsite_id: "ms_simorgh",
        website_module_id: "wm_booking_cta",
        module_key: "booking_cta",
        enabled: true,
        display_order: 6,
        content: {
          heading: "میز خود را رزرو کنید",
          button_label: "رزرو میز",
        },
      },
    ],
  },
  novin: {
    microsite: {
      id: "ms_novin",
      business_id: "b_novin",
      website_template_id: "tmpl_sleek_shop",
      subdomain_slug: "novin",
      content: {
        logo_url: null,
        business_name: "فروشگاه اینترنتی نوین",
        tagline: "خرید آسان ، ارسال سریع",
      },
      featured_campaign_id: null,
      published: true,
      addon_status: "active",
    },
    template: {
      id: "tmpl_sleek_shop",
      name: "فروشگاه اینترنتی (Sleek Shop)",
      theme_identifier: "sleek_shop",
    },
    featuredCampaign: null,
    modules: [
      {
        id: "bmm_novin_hero",
        business_microsite_id: "ms_novin",
        website_module_id: "wm_hero",
        module_key: "hero",
        enabled: true,
        display_order: 0,
        content: {
          badge_label: "📦 فروشگاه نوین",
          title: "خرید آسان، ارسال سریع، کیفیت تضمینی",
          subtitle:
            "گستره‌ای از لوازم دیجیتال و لوازم جانبی با ارسال سریع در سراسر تهران و ضمانت اصالت کالا.",
        },
      },
      {
        id: "bmm_novin_about",
        business_microsite_id: "ms_novin",
        website_module_id: "wm_about",
        module_key: "about",
        enabled: true,
        display_order: 1,
        content: {
          heading: "درباره نوین",
          description:
            "فروشگاه اینترنتی نوین با هدف ارائه لوازم دیجیتال اصل با قیمت مناسب و ارسال سریع راه‌اندازی شد. تیم پشتیبانی ما همیشه آماده پاسخگویی به سوالات شماست.",
        },
      },
      {
        id: "bmm_novin_menu",
        business_microsite_id: "ms_novin",
        website_module_id: "wm_product_menu",
        module_key: "product_menu",
        enabled: true,
        display_order: 2,
        content: {
          heading: "پرفروش‌ترین‌ها",
          items: [
            { name: "هدفون بی‌سیم", price_toman: 1450000 },
            { name: "ساعت هوشمند", price_toman: 3200000 },
            { name: "پاوربانک ۲۰۰۰واتی", price_toman: 890000 },
            { name: "اسپیکر بلوتوث", price_toman: 1250000 },
          ],
        },
      },
      {
        id: "bmm_novin_gallery",
        business_microsite_id: "ms_novin",
        website_module_id: "wm_gallery",
        module_key: "gallery",
        enabled: true,
        display_order: 3,
        content: {
          heading: "محصولات منتخب",
          images: [
            { alt: "عکس لوازم جانبی" },
            { alt: "عکس بسته‌بندی و ارسال" },
            { alt: "عکس انبار کالا" },
            { alt: "عکس تیم پشتیبانی" },
          ],
        },
      },
      {
        id: "bmm_novin_testimonials",
        business_microsite_id: "ms_novin",
        website_module_id: "wm_testimonials",
        module_key: "testimonials",
        enabled: true,
        display_order: 4,
        content: {
          heading: "نظرات مشتریان",
          items: [
            { quote: "ارسال فوق‌العاده سریع بود و بسته‌بندی دقیقاً مطابق سایت بود.", author: "رضا ح." },
          ],
        },
      },
      {
        id: "bmm_novin_contact",
        business_microsite_id: "ms_novin",
        website_module_id: "wm_contact",
        module_key: "contact",
        enabled: true,
        display_order: 5,
        content: {
          address: "تهران، پونک، خیابان میرداماد، پلاک ۳۷ (انبار و پشتیبانی)",
          phone: "۰۲۱-۴۴۴۴۴۴۴۴",
          hours: "پشتیبانی آنلاین: همه‌روزه، ساعت ۹:۰۰ تا ۲۱:۰۰",
        },
      },
      {
        id: "bmm_novin_booking",
        business_microsite_id: "ms_novin",
        website_module_id: "wm_booking_cta",
        module_key: "booking_cta",
        enabled: true,
        display_order: 6,
        content: {
          heading: "سوالی درباره خرید دارید؟",
          button_label: "چت با پشتیبانی",
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
