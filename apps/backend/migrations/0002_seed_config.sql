-- Seed rows for global config/lookup tables. Consolidated 2026-09-15 from
-- what used to be three separate seed migrations (0002, 0005, 0010).
-- category_module_defaults and notification_templates and
-- onboarding_checklist_items are deliberately NOT seeded here -- that data
-- hasn't been finalized yet; add a real migration once it is, don't backfill
-- this file as a placeholder.

-- 6 v1 business categories
INSERT INTO business_categories (id, slug, name_fa, active) VALUES
  ('cat_coffee_shop', 'coffee_shop', 'کافی‌شاپ/کافه', 1),
  ('cat_clothing',    'clothing',    'فروشگاه لباس/پوشاک', 1),
  ('cat_restaurant',  'restaurant',  'رستوران/فست‌فود', 1),
  ('cat_online_store','online_store','فروشگاه آنلاین (غیر پوشاک)', 1),
  ('cat_gym',         'gym',         'باشگاه/سالن ورزشی', 1),
  ('cat_beauty_clinic','beauty_clinic','کلینیک زیبایی', 1);

-- 9 task patterns. verification_method: social/UGC-style tasks are
-- screenshot_ai, referral is code_link_auto, purchase-driven tasks are
-- pos_scan (with receipt_claim as the retroactive fallback path).
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

-- 6 reward patterns
INSERT INTO reward_patterns (id, name) VALUES
  ('rp_percentage_discount', 'percentage_discount'),
  ('rp_free_item',           'free_item'),
  ('rp_free_shipping',       'free_shipping'),
  ('rp_vip_tier',            'vip_tier'),
  ('rp_promo_item',          'promo_item'),
  ('rp_early_access',        'early_access');

-- 8 microsite content modules
INSERT INTO website_modules (id, key, name_fa, content_schema) VALUES
  ('mod_hero',              'hero',              'بخش اصلی (هیرو)', NULL),
  ('mod_about',             'about',             'درباره ما', NULL),
  ('mod_gallery',           'gallery',           'گالری تصاویر', NULL),
  ('mod_product_menu',      'product_menu',      'منو / محصولات', NULL),
  ('mod_testimonials',      'testimonials',      'نظرات مشتریان', NULL),
  ('mod_booking_cta',       'booking_cta',       'دکمه رزرو/دعوت', NULL),
  ('mod_contact',           'contact',           'تماس با ما', NULL),
  ('mod_campaign_highlight','campaign_highlight','کمپین فعال', NULL);

-- 4 subscription tiers matching businesses.size_tier's check constraint.
-- Pricing is placeholder -- update once product finalizes real prices.
INSERT INTO subscription_plans (id, tier, monthly_price_toman) VALUES
  ('plan_micro',  'micro',  490000),
  ('plan_small',  'small',  990000),
  ('plan_medium', 'medium', 1990000),
  ('plan_large',  'large',  3990000);

-- One generic microsite template, usable across all v1 business categories,
-- until real per-category templates/designs exist.
INSERT INTO website_templates (id, name, preview_image_url, theme_identifier) VALUES
  ('tpl_default', 'Default', NULL, 'default');

INSERT INTO website_template_categories (website_template_id, business_category_id) VALUES
  ('tpl_default', 'cat_coffee_shop'),
  ('tpl_default', 'cat_clothing'),
  ('tpl_default', 'cat_restaurant'),
  ('tpl_default', 'cat_online_store'),
  ('tpl_default', 'cat_gym'),
  ('tpl_default', 'cat_beauty_clinic');

-- category_pattern_weights (v1 draft, 0-3 scale, per plan.md Phase 1's
-- weighting table). Note on First Action/Conversion (tp_first_action): the
-- value seeded here (2 for every category) is the neutral/default weight.
-- Campaign generation overrides it in-memory to 3 (acquisition goal) or 1
-- (retention goal) -- that override is goal-specific per campaign, not a
-- category-level constant, so it is never written back to this table.
INSERT INTO category_pattern_weights (business_category_id, task_pattern_id, weight) VALUES
  -- Social Proof
  ('cat_coffee_shop',   'tp_social_proof', 3),
  ('cat_clothing',      'tp_social_proof', 2),
  ('cat_restaurant',    'tp_social_proof', 2),
  ('cat_online_store',  'tp_social_proof', 1),
  ('cat_gym',           'tp_social_proof', 1),
  ('cat_beauty_clinic', 'tp_social_proof', 3),

  -- Referral
  ('cat_coffee_shop',   'tp_referral', 2),
  ('cat_clothing',      'tp_referral', 2),
  ('cat_restaurant',    'tp_referral', 2),
  ('cat_online_store',  'tp_referral', 2),
  ('cat_gym',           'tp_referral', 2),
  ('cat_beauty_clinic', 'tp_referral', 2),

  -- Repeat Purchase
  ('cat_coffee_shop',   'tp_repeat_purchase', 2),
  ('cat_clothing',      'tp_repeat_purchase', 2),
  ('cat_restaurant',    'tp_repeat_purchase', 3),
  ('cat_online_store',  'tp_repeat_purchase', 2),
  ('cat_gym',           'tp_repeat_purchase', 0),
  ('cat_beauty_clinic', 'tp_repeat_purchase', 1),

  -- Milestone/Streak
  ('cat_coffee_shop',   'tp_milestone_streak', 1),
  ('cat_clothing',      'tp_milestone_streak', 0),
  ('cat_restaurant',    'tp_milestone_streak', 0),
  ('cat_online_store',  'tp_milestone_streak', 0),
  ('cat_gym',           'tp_milestone_streak', 3),
  ('cat_beauty_clinic', 'tp_milestone_streak', 1),

  -- Specific Product Push
  ('cat_coffee_shop',   'tp_specific_product_push', 3),
  ('cat_clothing',      'tp_specific_product_push', 1),
  ('cat_restaurant',    'tp_specific_product_push', 2),
  ('cat_online_store',  'tp_specific_product_push', 1),
  ('cat_gym',           'tp_specific_product_push', 0),
  ('cat_beauty_clinic', 'tp_specific_product_push', 0),

  -- Review/UGC
  ('cat_coffee_shop',   'tp_review_ugc', 1),
  ('cat_clothing',      'tp_review_ugc', 1),
  ('cat_restaurant',    'tp_review_ugc', 2),
  ('cat_online_store',  'tp_review_ugc', 3),
  ('cat_gym',           'tp_review_ugc', 1),
  ('cat_beauty_clinic', 'tp_review_ugc', 2),

  -- First Action/Conversion (neutral default; goal-overridden at generation time)
  ('cat_coffee_shop',   'tp_first_action', 2),
  ('cat_clothing',      'tp_first_action', 2),
  ('cat_restaurant',    'tp_first_action', 2),
  ('cat_online_store',  'tp_first_action', 3),
  ('cat_gym',           'tp_first_action', 2),
  ('cat_beauty_clinic', 'tp_first_action', 2),

  -- Off-Peak/Time-based
  ('cat_coffee_shop',   'tp_off_peak', 2),
  ('cat_clothing',      'tp_off_peak', 0),
  ('cat_restaurant',    'tp_off_peak', 2),
  ('cat_online_store',  'tp_off_peak', 0),
  ('cat_gym',           'tp_off_peak', 2),
  ('cat_beauty_clinic', 'tp_off_peak', 1),

  -- Anniversary/Birthday
  ('cat_coffee_shop',   'tp_anniversary_birthday', 1),
  ('cat_clothing',      'tp_anniversary_birthday', 2),
  ('cat_restaurant',    'tp_anniversary_birthday', 1),
  ('cat_online_store',  'tp_anniversary_birthday', 1),
  ('cat_gym',           'tp_anniversary_birthday', 2),
  ('cat_beauty_clinic', 'tp_anniversary_birthday', 2);
