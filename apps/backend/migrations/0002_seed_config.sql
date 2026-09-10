-- Seed rows for global config tables only (plan.md Phase 0/1). Cross-product
-- tables (category_pattern_weights, category_module_defaults) are deliberately
-- NOT seeded here -- follow-up work once the weighting/defaults data is
-- finalized for a real migration, not a scaffold placeholder.

-- 6 v1 business categories (plan.md Phase 0 "v1 business categories")
INSERT INTO business_categories (id, slug, name_fa, active) VALUES
  ('cat_coffee_shop', 'coffee_shop', 'کافی‌شاپ/کافه', 1),
  ('cat_clothing',    'clothing',    'فروشگاه لباس/پوشاک', 1),
  ('cat_restaurant',  'restaurant',  'رستوران/فست‌فود', 1),
  ('cat_online_store','online_store','فروشگاه آنلاین (غیر پوشاک)', 1),
  ('cat_gym',         'gym',         'باشگاه/سالن ورزشی', 1),
  ('cat_beauty_clinic','beauty_clinic','کلینیک زیبایی', 1);

-- 9 task patterns (plan.md Phase 1 "Task patterns"). verification_method per
-- plan.md Phase 0.5's attribution table: social/UGC-style tasks are
-- screenshot_ai, referral is code_link_auto, purchase-driven tasks are
-- pos_scan (with receipt_claim as the retroactive fallback path, not the
-- pattern's default method).
INSERT INTO task_patterns (id, name, verification_method, base_points) VALUES
  ('tp_social_proof',          'social_proof',          'screenshot_ai', 10),
  ('tp_referral',              'referral',              'code_link_auto', 20),
  ('tp_repeat_purchase',       'repeat_purchase',       'pos_scan', 15),
  ('tp_milestone_streak',      'milestone_streak',      'pos_scan', 25),
  ('tp_specific_product_push', 'specific_product_push', 'pos_scan', 15),
  ('tp_review_ugc',            'review_ugc',            'screenshot_ai', 15),
  ('tp_first_action',          'first_action',          'pos_scan', 30),
  ('tp_off_peak',              'off_peak',              'pos_scan', 10),
  ('tp_anniversary_birthday',  'anniversary_birthday',  'pos_scan', 10);

-- 6 reward patterns (plan.md Phase 1 "Reward patterns")
INSERT INTO reward_patterns (id, name) VALUES
  ('rp_percentage_discount', 'percentage_discount'),
  ('rp_free_item',           'free_item'),
  ('rp_free_shipping',       'free_shipping'),
  ('rp_vip_tier',            'vip_tier'),
  ('rp_promo_item',          'promo_item'),
  ('rp_early_access',        'early_access');

-- 8 microsite content modules (plan.md Phase 0.75 "Business microsite")
INSERT INTO website_modules (id, key, name_fa, content_schema) VALUES
  ('mod_hero',              'hero',              'بخش اصلی (هیرو)', NULL),
  ('mod_about',             'about',             'درباره ما', NULL),
  ('mod_gallery',           'gallery',           'گالری تصاویر', NULL),
  ('mod_product_menu',      'product_menu',      'منو / محصولات', NULL),
  ('mod_testimonials',      'testimonials',      'نظرات مشتریان', NULL),
  ('mod_booking_cta',       'booking_cta',       'دکمه رزرو/دعوت', NULL),
  ('mod_contact',           'contact',           'تماس با ما', NULL),
  ('mod_campaign_highlight','campaign_highlight','کمپین فعال', NULL);
