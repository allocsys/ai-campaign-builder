-- Seeds real per-template microsite content + demo businesses/campaigns for
-- the 6 v1 categories (plan.md Phase 0.75 "Backend-wiring scope decision",
-- decided 2026-09-11). Ports apps/microsite/app/lib/mock-data.ts's existing
-- Persian fixture copy into real rows so business_microsite_modules.content
-- (previously always NULL -- see ensureMicrosite()/serializeMicrosite() in
-- routes/business.ts, now fixed to write defaults for NEW microsites going
-- forward) has real data for these 6 demo businesses too. narvan and titan
-- each get a real active campaign (acquisition and retention respectively) so
-- the new public microsite endpoint's featuredCampaign.goal has both values to
-- exercise the goal-driven CTA copy in CampaignHighlight.tsx; the other 4 stay
-- campaign-less (no_campaign_* fallback copy), matching the original mock data.

-- Real per-category templates (0005 only seeded one generic 'tpl_default').
INSERT INTO website_templates (id, name, preview_image_url, theme_identifier) VALUES
  ('tmpl_minimal_cafe', 'کافه دنج (Minimal Cafe)', NULL, 'minimal_cafe'),
  ('tmpl_bold_retail', 'بوتیک مدرن (Bold Retail)', NULL, 'bold_retail'),
  ('tmpl_energetic_gym', 'باشگاه پرانرژی (Energetic Gym)', NULL, 'energetic_gym'),
  ('tmpl_serene_beauty', 'کلینیک آرام (Serene Beauty)', NULL, 'serene_beauty'),
  ('tmpl_fine_dining', 'رستوران لوکس (Fine Dining)', NULL, 'fine_dining'),
  ('tmpl_sleek_shop', 'فروشگاه اینترنتی (Sleek Shop)', NULL, 'sleek_shop');

INSERT INTO website_template_categories (website_template_id, business_category_id) VALUES
  ('tmpl_minimal_cafe', 'cat_coffee_shop'),
  ('tmpl_bold_retail', 'cat_clothing'),
  ('tmpl_energetic_gym', 'cat_gym'),
  ('tmpl_serene_beauty', 'cat_beauty_clinic'),
  ('tmpl_fine_dining', 'cat_restaurant'),
  ('tmpl_sleek_shop', 'cat_online_store');

-- 6 demo businesses, one per v1 category, phone-verified so they'd pass real OTP checks.
INSERT INTO businesses (id, name, category_id, phone, phone_verified, phone_verified_at, size_tier, autopilot_enabled) VALUES
  ('b_narvan', 'کافه نارون', 'cat_coffee_shop', '+989120000001', 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'small', 0),
  ('b_velora', 'بوتیک ولورا', 'cat_clothing', '+989120000002', 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'small', 0),
  ('b_titan', 'باشگاه تایتان', 'cat_gym', '+989120000003', 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'small', 0),
  ('b_ava', 'کلینیک زیبایی آوا', 'cat_beauty_clinic', '+989120000004', 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'small', 0),
  ('b_simorgh', 'رستوران سیمرغ', 'cat_restaurant', '+989120000005', 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'small', 0),
  ('b_novin', 'فروشگاه اینترنتی نوین', 'cat_online_store', '+989120000006', 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'small', 0);

-- Real active campaigns for narvan (acquisition) and titan (retention) --
-- the other 4 demo businesses intentionally have none yet (no_campaign_* fallback).
INSERT INTO campaigns (id, business_id, goal, status, point_multiplier, public_join_slug) VALUES
  ('c_narvan_autumn', 'b_narvan', 'acquisition', 'active', 1, 'narvan-autumn'),
  ('c_titan_loyalty', 'b_titan', 'retention', 'active', 1, 'titan-loyalty');

INSERT INTO business_microsites (id, business_id, website_template_id, subdomain_slug, content, featured_campaign_id, published, addon_status) VALUES
  ('ms_narvan', 'b_narvan', 'tmpl_minimal_cafe', 'narvan', '{"logo_url":null,"business_name":"کافه نارون","tagline":"طعم اصیل، فضای دنج"}', 'c_narvan_autumn', 1, 'active'),
  ('ms_velora', 'b_velora', 'tmpl_bold_retail', 'velora', '{"logo_url":null,"business_name":"بوتیک ولورا","tagline":"استایل شخصی، امضای خودت"}', NULL, 1, 'active'),
  ('ms_titan', 'b_titan', 'tmpl_energetic_gym', 'titan', '{"logo_url":null,"business_name":"باشگاه تایتان","tagline":"قدرت واقعی از اینجا شروع می‌شود"}', 'c_titan_loyalty', 1, 'active'),
  ('ms_ava', 'b_ava', 'tmpl_serene_beauty', 'ava', '{"logo_url":null,"business_name":"کلینیک زیبایی آوا","tagline":"پوستی درخشان، اعتمادبه‌نفسی تازه"}', NULL, 1, 'active'),
  ('ms_simorgh', 'b_simorgh', 'tmpl_fine_dining', 'simorgh', '{"logo_url":null,"business_name":"رستوران سیمرغ","tagline":"طعمی ماندگار از سنت ایرانی"}', NULL, 1, 'active'),
  ('ms_novin', 'b_novin', 'tmpl_sleek_shop', 'novin', '{"logo_url":null,"business_name":"فروشگاه اینترنتی نوین","tagline":"خرید آسان ، ارسال سریع"}', NULL, 1, 'active');

INSERT INTO business_microsite_modules (id, business_microsite_id, website_module_id, enabled, display_order, content) VALUES
  ('bmm_narvan_hero', 'ms_narvan', 'mod_hero', 1, 0, '{"badge_label":"☕ کافه نارون","title":"طعم اصیل، فضای دنج، هر روز کنار شما","subtitle":"از سال ۱۳۹۸ میزبان لحظات آرام شما در قلب ولیعصر — قهوه‌ی تخصصی، دسرهای خانگی و فضایی برای گفتگو."}'),
  ('bmm_narvan_campaign_highlight', 'ms_narvan', 'mod_campaign_highlight', 1, 1, '{"title":"کمپین وفاداری پاییزه فعال است!","description":"با عضویت رایگان، اولین نوشیدنی گرم شما مهمان ماست — به‌علاوه امکان دریافت جوایز بیشتر با دعوت از دوستان.","cta_label":"عضویت در کمپین و دریافت کد شخصی"}'),
  ('bmm_narvan_about', 'ms_narvan', 'mod_about', 1, 2, '{"heading":"درباره کافه نارون","description":"کافه نارون با هدف ساختن یک فضای گرم و صمیمی برای علاقه‌مندان به قهوه‌ی تخصصی راه‌اندازی شد. دانه‌های ما به‌صورت تازه بو داده می‌شوند و هر فنجان با دقت و عشق تهیه می‌شود."}'),
  ('bmm_narvan_product_menu', 'ms_narvan', 'mod_product_menu', 1, 3, '{"heading":"منوی محبوب‌ترین اقلام","items":[{"name":"آمریکانو","price_toman":85000},{"name":"کاپوچینو","price_toman":95000},{"name":"موکای مخصوص نارون","price_toman":110000},{"name":"چیزکیک خانگی","price_toman":140000}]}'),
  ('bmm_narvan_gallery', 'ms_narvan', 'mod_gallery', 1, 4, '{"heading":"فضای کافه","images":[{"alt":"عکس فضای داخلی"},{"alt":"عکس بار قهوه"},{"alt":"عکس میزهای حیاط"},{"alt":"عکس دسر و نوشیدنی"}]}'),
  ('bmm_narvan_contact', 'ms_narvan', 'mod_contact', 1, 5, '{"address":"تهران، ولیعصر، خیابان توانیر، پلاک ۱۲","phone":"۰۲۱-۸۸۸۸۸۸۸۸","hours":"همه‌روزه، ۸:۰۰ تا ۲۳:۰۰"}'),
  ('bmm_narvan_testimonials', 'ms_narvan', 'mod_testimonials', 1, 6, '{"heading":"نظرات مشتریان وفادار","items":[{"quote":"بهترین قهوه محله‌مون! فضاش خیلی آرومه.","author":"سارا ا."}]}'),
  ('bmm_narvan_booking_cta', 'ms_narvan', 'mod_booking_cta', 1, 7, '{"heading":"رزرو میز یا وقت قبلی","button_label":"رزرو میز"}'),
  ('bmm_velora_hero', 'ms_velora', 'mod_hero', 1, 0, '{"badge_label":"🧵 بوتیک ولورا","title":"لباسی که داستان شما را روایت می‌کند","subtitle":"گزیده‌ای از پوشاک زنانه و مردانه با طراحی محدود — کیفیت پارچه، برش دقیق و سبکی که فقط برای شما انتخاب شده."}'),
  ('bmm_velora_campaign_highlight', 'ms_velora', 'mod_campaign_highlight', 1, 1, '{"title":"","description":"","cta_label":"","no_campaign_title":"کمپین بعدی به‌زودی می‌آید","no_campaign_description":"در حال حاضر کمپین فعالی نداریم — به‌زودی جزئیات کمپین جدید و لینک عضویت اینجا نمایش داده می‌شود."}'),
  ('bmm_velora_about', 'ms_velora', 'mod_about', 1, 2, '{"heading":"درباره ولورا","description":"ولورا از دل عشق به طراحی محدود و متفاوت شکل گرفت. هر مجموعه در تیراژ کم تولید می‌شود تا حس خاص‌بودن را برای مشتریانش حفظ کند."}'),
  ('bmm_velora_product_menu', 'ms_velora', 'mod_product_menu', 1, 3, '{"heading":"محصولات منتخب","items":[{"name":"کت بلند پشمی","price_toman":2450000},{"name":"پیراهن ابریشمی","price_toman":980000},{"name":"شلوار پارچه‌ای برش‌دار","price_toman":760000},{"name":"شال دست‌بافت","price_toman":420000}]}'),
  ('bmm_velora_gallery', 'ms_velora', 'mod_gallery', 1, 4, '{"heading":"از مجموعه جدید","images":[{"alt":"عکس مجموعه پاییزه"},{"alt":"عکس ویترین بوتیک"},{"alt":"عکس جزئیات پارچه"},{"alt":"عکس فضای فروشگاه"}]}'),
  ('bmm_velora_contact', 'ms_velora', 'mod_contact', 1, 5, '{"address":"تهران، زعفرانیه، خیابان ولیعصر، پلاک ۴۵","phone":"۰۲۱-۲۲۲۲۲۲۲۲","hours":"شنبه تا پنجشنبه، ۱۰:۰۰ تا ۲۰:۰۰"}'),
  ('bmm_velora_testimonials', 'ms_velora', 'mod_testimonials', 1, 6, '{"heading":"نظرات مشتریان","items":[{"quote":"کیفیت دوخت و پارچه واقعاً حرف نداره.","author":"نگین م."}]}'),
  ('bmm_velora_booking_cta', 'ms_velora', 'mod_booking_cta', 1, 7, '{"heading":"وقت مشاوره استایل رزرو کنید","button_label":"رزرو مشاوره"}'),
  ('bmm_titan_hero', 'ms_titan', 'mod_hero', 1, 0, '{"badge_label":"🏋️ باشگاه تایتان","title":"بدنی قوی‌تر، ذهنی متمرکزتر","subtitle":"برنامه‌های تمرینی اختصاصی، مربیان حرفه‌ای و فضایی مجهز برای رسیدن به بهترین نسخه خودتان."}'),
  ('bmm_titan_campaign_highlight', 'ms_titan', 'mod_campaign_highlight', 1, 1, '{"title":"باشگاه مشتریان تایتان فعال شد!","description":"با هر حضور امتیاز جمع کن و جوایز اختصاصی بگیر — هرچی بمونی، بیشتر می‌گیری.","cta_label":"عضویت در باشگاه مشتریان و دریافت کد شخصی"}'),
  ('bmm_titan_about', 'ms_titan', 'mod_about', 1, 2, '{"heading":"درباره باشگاه تایتان","description":"باشگاه تایتان با تجهیزات مدرن و مربیان مجرب، مسیر رسیدن به اهداف تناسب اندام شما را کوتاه‌تر می‌کند. چه مبتدی باشید چه حرفه‌ای، برنامه‌ای متناسب شما داریم."}'),
  ('bmm_titan_product_menu', 'ms_titan', 'mod_product_menu', 1, 3, '{"heading":"بسته‌های عضویت","items":[{"name":"عضویت ماهانه","price_toman":1200000},{"name":"عضویت سه‌ماهه","price_toman":3200000},{"name":"جلسه خصوصی با مربی","price_toman":450000},{"name":"کلاس گروهی (هر جلسه)","price_toman":180000}]}'),
  ('bmm_titan_gallery', 'ms_titan', 'mod_gallery', 1, 4, '{"heading":"فضای باشگاه","images":[{"alt":"عکس سالن بدنسازی"},{"alt":"عکس سالن کلاس‌های گروهی"},{"alt":"عکس منطقه کاردیو"},{"alt":"عکس اتاق ریکاوری"}]}'),
  ('bmm_titan_contact', 'ms_titan', 'mod_contact', 1, 5, '{"address":"تهران، سعادت‌آباد، بلوار دریا، پلاک ۸","phone":"۰۲۱-۲۶۶۶۶۶۶۶","hours":"همه‌روزه، ۶:۰۰ تا ۲۳:۰۰"}'),
  ('bmm_titan_testimonials', 'ms_titan', 'mod_testimonials', 1, 6, '{"heading":"نظرات ورزشکاران","items":[{"quote":"بعد از سه ماه تمرین اینجا واقعاً نتیجه رو دیدم.","author":"آرمان ک."}]}'),
  ('bmm_titan_booking_cta', 'ms_titan', 'mod_booking_cta', 1, 7, '{"heading":"یک جلسه رایگان رزرو کنید","button_label":"رزرو جلسه رایگان"}'),
  ('bmm_ava_hero', 'ms_ava', 'mod_hero', 1, 0, '{"badge_label":"✨ کلینیک زیبایی آوا","title":"پوستی درخشان، اعتمادبه‌نفسی تازه","subtitle":"خدمات تخصصی پوست و زیبایی با جدیدترین تجهیزات و متخصصان مجرب، در محیطی آرام و اختصاصی."}'),
  ('bmm_ava_campaign_highlight', 'ms_ava', 'mod_campaign_highlight', 1, 1, '{"title":"","description":"","cta_label":"","no_campaign_title":"کمپین بعدی به‌زودی می‌آید","no_campaign_description":"در حال حاضر کمپین فعالی نداریم — به‌زودی جزئیات کمپین جدید و لینک عضویت اینجا نمایش داده می‌شود."}'),
  ('bmm_ava_about', 'ms_ava', 'mod_about', 1, 2, '{"heading":"درباره کلینیک آوا","description":"کلینیک زیبایی آوا با هدف ارائه خدمات باکیفیت و ایمن پوست و زیبایی تأسیس شد. تیم متخصص ما با بهره‌گیری از دستگاه‌های روز دنیا، بهترین نتیجه را برای شما به ارمغان می‌آورد."}'),
  ('bmm_ava_product_menu', 'ms_ava', 'mod_product_menu', 1, 3, '{"heading":"خدمات محبوب","items":[{"name":"لیزر موهای زائد (هر جلسه)","price_toman":850000},{"name":"میکرونیدلینگ صورت","price_toman":1450000},{"name":"پاکسازی پوست","price_toman":650000},{"name":"مزوتراپی مو","price_toman":1200000}]}'),
  ('bmm_ava_gallery', 'ms_ava', 'mod_gallery', 1, 4, '{"heading":"فضای کلینیک","images":[{"alt":"عکس اتاق درمان"},{"alt":"عکس لابی کلینیک"},{"alt":"عکس دستگاه‌های لیزر"},{"alt":"عکس فضای استراحت"}]}'),
  ('bmm_ava_contact', 'ms_ava', 'mod_contact', 1, 5, '{"address":"تهران، الهیه، خیابان فرشته، پلاک ۲۲","phone":"۰۲۱-۲۲۹۹۹۹۹۹","hours":"شنبه تا پنجشنبه، ۱۰:۰۰ تا ۲۰:۰۰"}'),
  ('bmm_ava_testimonials', 'ms_ava', 'mod_testimonials', 1, 6, '{"heading":"نظرات مراجعین","items":[{"quote":"نتیجه لیزر فوق‌العاده بود و کادر خیلی حرفه‌ای بودن.","author":"مینا ر."}]}'),
  ('bmm_ava_booking_cta', 'ms_ava', 'mod_booking_cta', 1, 7, '{"heading":"وقت مشاوره رایگان رزرو کنید","button_label":"رزرو وقت مشاوره"}'),
  ('bmm_simorgh_hero', 'ms_simorgh', 'mod_hero', 1, 0, '{"badge_label":"🍽️ رستوران سیمرغ","title":"طعمی ماندگار از سنت ایرانی","subtitle":"تجربه‌ای اصیل از غذاهای سنتی ایرانی با بهترین مواد اولیه، در فضایی گرم و خاطره‌انگیز."}'),
  ('bmm_simorgh_campaign_highlight', 'ms_simorgh', 'mod_campaign_highlight', 1, 1, '{"title":"","description":"","cta_label":"","no_campaign_title":"کمپین بعدی به‌زودی می‌آید","no_campaign_description":"در حال حاضر کمپین فعالی نداریم — به‌زودی جزئیات کمپین جدید و لینک عضویت اینجا نمایش داده می‌شود."}'),
  ('bmm_simorgh_about', 'ms_simorgh', 'mod_about', 1, 2, '{"heading":"درباره سیمرغ","description":"رستوران سیمرغ بیش از یک دهه است که طعم اصیل غذای ایرانی را با احترام به سنت و کیفیت بی‌نظیر به مهمانان خود ارائه می‌دهد."}'),
  ('bmm_simorgh_product_menu', 'ms_simorgh', 'mod_product_menu', 1, 3, '{"heading":"پیشنهاد سرآشپز","items":[{"name":"چلوکباب سلطانی","price_toman":1850000},{"name":"خورش فسنجان","price_toman":1250000},{"name":"زرشک‌پلو با مرغ","price_toman":980000},{"name":"آش رشته","price_toman":420000}]}'),
  ('bmm_simorgh_gallery', 'ms_simorgh', 'mod_gallery', 1, 4, '{"heading":"فضای رستوران","images":[{"alt":"عکس سالن اصلی"},{"alt":"عکس تراس رستوران"},{"alt":"عکس میز چیده‌شده"},{"alt":"عکس آشپزخانه باز"}]}'),
  ('bmm_simorgh_contact', 'ms_simorgh', 'mod_contact', 1, 5, '{"address":"تهران، ونک، خیابان ملاصدرا، پلاک ۶۳","phone":"۰۲۱-۸۸۷۷۷۷۷۷","hours":"همه‌روزه، ۱۲:۰۰ تا ۲۳:۳۰"}'),
  ('bmm_simorgh_testimonials', 'ms_simorgh', 'mod_testimonials', 1, 6, '{"heading":"نظرات مهمانان","items":[{"quote":"طعم غذاها دقیقاً مثل غذای خونگی بود، عالی!","author":"حسین ت."}]}'),
  ('bmm_simorgh_booking_cta', 'ms_simorgh', 'mod_booking_cta', 1, 7, '{"heading":"میز خود را رزرو کنید","button_label":"رزرو میز"}'),
  ('bmm_novin_hero', 'ms_novin', 'mod_hero', 1, 0, '{"badge_label":"📦 فروشگاه نوین","title":"خرید آسان، ارسال سریع، کیفیت تضمینی","subtitle":"گستره‌ای از لوازم دیجیتال و لوازم جانبی با ارسال سریع در سراسر تهران و ضمانت اصالت کالا."}'),
  ('bmm_novin_campaign_highlight', 'ms_novin', 'mod_campaign_highlight', 1, 1, '{"title":"","description":"","cta_label":"","no_campaign_title":"کمپین بعدی به‌زودی می‌آید","no_campaign_description":"در حال حاضر کمپین فعالی نداریم — به‌زودی جزئیات کمپین جدید و لینک عضویت اینجا نمایش داده می‌شود."}'),
  ('bmm_novin_about', 'ms_novin', 'mod_about', 1, 2, '{"heading":"درباره نوین","description":"فروشگاه اینترنتی نوین با هدف ارائه لوازم دیجیتال اصل با قیمت مناسب و ارسال سریع راه‌اندازی شد. تیم پشتیبانی ما همیشه آماده پاسخگویی به سوالات شماست."}'),
  ('bmm_novin_product_menu', 'ms_novin', 'mod_product_menu', 1, 3, '{"heading":"پرفروش‌ترین‌ها","items":[{"name":"هدفون بی‌سیم","price_toman":1450000},{"name":"ساعت هوشمند","price_toman":3200000},{"name":"پاوربانک ۲۰۰۰واتی","price_toman":890000},{"name":"اسپیکر بلوتوث","price_toman":1250000}]}'),
  ('bmm_novin_gallery', 'ms_novin', 'mod_gallery', 1, 4, '{"heading":"محصولات منتخب","images":[{"alt":"عکس لوازم جانبی"},{"alt":"عکس بسته‌بندی و ارسال"},{"alt":"عکس انبار کالا"},{"alt":"عکس تیم پشتیبانی"}]}'),
  ('bmm_novin_contact', 'ms_novin', 'mod_contact', 1, 5, '{"address":"تهران، پونک، خیابان میرداماد، پلاک ۳۷ (انبار و پشتیبانی)","phone":"۰۲۱-۴۴۴۴۴۴۴۴","hours":"پشتیبانی آنلاین: همه‌روزه، ساعت ۹:۰۰ تا ۲۱:۰۰"}'),
  ('bmm_novin_testimonials', 'ms_novin', 'mod_testimonials', 1, 6, '{"heading":"نظرات مشتریان","items":[{"quote":"ارسال فوق‌العاده سریع بود و بسته‌بندی دقیقاً مطابق سایت بود.","author":"رضا ح."}]}'),
  ('bmm_novin_booking_cta', 'ms_novin', 'mod_booking_cta', 1, 7, '{"heading":"سوالی درباره خرید دارید؟","button_label":"چت با پشتیبانی"}');
