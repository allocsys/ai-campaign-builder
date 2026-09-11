-- Seeds category_pattern_weights, deliberately left empty by 0002_seed_config.sql
-- pending "the weighting/defaults data is finalized for a real migration" --
-- this is that follow-up. Values transcribed verbatim from plan.md Phase 1's
-- "Weighting table (v1 draft, 0-3 scale)".
--
-- Note on First Action/Conversion (tp_first_action): the value seeded here
-- (2 for every category) is the neutral/default weight. Campaign generation
-- overrides it in-memory to 3 (acquisition goal) or 1 (retention goal) per
-- plan.md's "Goal-driven weight override" decision -- that override is
-- goal-specific per campaign, not a category-level constant, so it is never
-- written back to this table.

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

  -- First Action/Conversion (neutral default; goal-overridden at generation time, see note above)
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
