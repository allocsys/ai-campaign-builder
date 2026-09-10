-- subscription_plans and website_templates were DEFINED in 0001_init.sql but
-- never actually seeded in 0002_seed_config.sql -- an oversight, not a
-- deliberate decision (0002's own comment only calls out
-- category_pattern_weights/category_module_defaults as intentionally
-- deferred). The business.ts routes need at least one real row in each to
-- FK against when auto-provisioning a business's subscription/microsite, so
-- backfilling both here.

-- 4 subscription tiers matching businesses.size_tier's check constraint.
-- Pricing is placeholder (not sourced from plan.md/architecture.md, which
-- don't specify Toman amounts) -- update once product finalizes real prices.
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
