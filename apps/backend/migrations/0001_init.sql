-- Schema for ai-campaign-builder backend (Cloudflare D1 / SQLite).
-- Source of truth: /architecture.md at repo root. Follows that doc's own
-- type-mapping note (Stack section): uuid->TEXT, jsonb->TEXT (app-parsed JSON),
-- enum->TEXT with a CHECK constraint listing allowed values, boolean->INTEGER
-- (0/1), timestamp->TEXT (ISO 8601), numeric->REAL.
--
-- This file is the single consolidated schema, replacing what used to be 16
-- incremental migrations (0001-0016). Collapsed 2026-09-15: the product has
-- no real users yet, so there was no data-compatibility reason to keep
-- shipping the schema as a history of ALTER TABLE / table-rebuild steps --
-- this file just IS the current, correct schema. If real users ever exist
-- before the next schema change, go back to additive migrations instead of
-- editing this file in place.

-- ============================================================
-- Lookup / global config tables
-- ============================================================

CREATE TABLE business_categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_fa TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE task_patterns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (name IN (
    'social_proof', 'referral', 'repeat_purchase', 'milestone_streak',
    'specific_product_push', 'review_ugc', 'first_action', 'off_peak',
    'anniversary_birthday'
  )),
  verification_method TEXT NOT NULL CHECK (verification_method IN (
    'screenshot_ai', 'code_link_auto', 'pos_scan', 'receipt_claim'
  )),
  base_points INTEGER NOT NULL
);

CREATE TABLE category_pattern_weights (
  business_category_id TEXT NOT NULL REFERENCES business_categories(id),
  task_pattern_id TEXT NOT NULL REFERENCES task_patterns(id),
  weight INTEGER NOT NULL CHECK (weight BETWEEN 0 AND 3),
  PRIMARY KEY (business_category_id, task_pattern_id)
);

CREATE TABLE reward_patterns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (name IN (
    'percentage_discount', 'free_item', 'free_shipping', 'vip_tier',
    'promo_item', 'early_access'
  ))
);

CREATE TABLE subscription_plans (
  id TEXT PRIMARY KEY,
  tier TEXT NOT NULL CHECK (tier IN ('micro', 'small', 'medium', 'large')),
  monthly_price_toman REAL NOT NULL
);

CREATE TABLE sms_pricing (
  id TEXT PRIMARY KEY,
  price_per_sms_toman REAL NOT NULL,
  effective_from TEXT NOT NULL
);

CREATE TABLE website_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  preview_image_url TEXT,
  theme_identifier TEXT NOT NULL
);

CREATE TABLE website_template_categories (
  website_template_id TEXT NOT NULL REFERENCES website_templates(id),
  business_category_id TEXT NOT NULL REFERENCES business_categories(id),
  PRIMARY KEY (website_template_id, business_category_id)
);

CREATE TABLE website_modules (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE CHECK (key IN (
    'hero', 'about', 'gallery', 'product_menu', 'testimonials',
    'booking_cta', 'contact', 'campaign_highlight'
  )),
  name_fa TEXT NOT NULL,
  content_schema TEXT
);

CREATE TABLE category_module_defaults (
  business_category_id TEXT NOT NULL REFERENCES business_categories(id),
  website_module_id TEXT NOT NULL REFERENCES website_modules(id),
  default_enabled INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (business_category_id, website_module_id)
);

CREATE TABLE notification_templates (
  id TEXT PRIMARY KEY,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'campaign_invite', 'ending_soon', 'reward_unlocked', 'submission_reviewed',
    'mid_campaign_reminder', 'referral_joined', 'autopilot_change_applied'
  )),
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'telegram')),
  body_template TEXT NOT NULL
);

CREATE TABLE onboarding_checklist_items (
  item_key TEXT PRIMARY KEY,
  label_fa TEXT NOT NULL,
  description_fa TEXT,
  detection_type TEXT NOT NULL CHECK (detection_type IN (
    'ai_constraints_saved', 'contacts_imported'
  )),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

-- ============================================================
-- Identity / staff-adjacent tables
-- ============================================================

-- Invite-only, scoped to a single business. A business owner pre-registers a
-- staff phone before that phone can request an OTP with role='staff'.
CREATE TABLE staff (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  phone_verified_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Invite-only, mirrors `staff`'s shape. A review_admin registers the phone
-- before it can complete OTP verification with role='review_team'.
CREATE TABLE review_team_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  phone_verified_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Holds only NON-root admins. The root admin is bootstrapped entirely from
-- env vars (REVIEW_ADMIN_USERNAME / REVIEW_ADMIN_PASSWORD_HASH, see
-- wrangler.toml) and never gets a row here.
CREATE TABLE review_admins (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Free text, not a FK: the creator may be 'root' (env-configured identity,
  -- no row anywhere to reference) or another review_admins row's username.
  created_by TEXT NOT NULL
);

-- ============================================================
-- Core business / campaign tables
-- ============================================================

CREATE TABLE businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  -- Nullable: set at signup with no category yet. First populated when the
  -- owner runs the campaign wizard for the first time (generateCampaignForBusiness
  -- sets it from the wizard's categorySlug), not before.
  category_id TEXT REFERENCES business_categories(id),
  phone TEXT NOT NULL UNIQUE,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  phone_verified_at TEXT,
  sms_wallet_balance_toman REAL NOT NULL DEFAULT 0,
  sms_monthly_cap_toman REAL,
  instagram_handle TEXT,
  autopilot_enabled INTEGER NOT NULL DEFAULT 0,
  size_tier TEXT CHECK (size_tier IN ('micro', 'small', 'medium', 'large')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Running count of suggested_changes this owner has manually applied
  -- (applied_by = 'business_owner'); denormalized to avoid a join+aggregate
  -- on the hot AutopilotTab read path.
  manual_apply_count INTEGER NOT NULL DEFAULT 0,
  -- How many manual applies are required before autopilot can be enabled.
  -- Per-business (not global) so it can vary later without another migration.
  autopilot_eligibility_threshold INTEGER NOT NULL DEFAULT 3,
  address TEXT,
  -- Shared boolean gate for the manual campaign editor; settable by the
  -- owner (self-serve "حالت حرفه‌ای" toggle) or by review_admin on their
  -- behalf. review_admin's own editor access is unconditional regardless.
  manual_editor_enabled INTEGER NOT NULL DEFAULT 0,
  -- Nullable: collected at signup going forward; existing/legacy rows may
  -- have neither, which is not an error condition.
  owner_first_name TEXT,
  owner_last_name TEXT
);

CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  goal TEXT NOT NULL CHECK (goal IN ('acquisition', 'retention', 'acquisition_retention')),
  audience_description TEXT,
  offer_description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'ended')),
  point_multiplier REAL NOT NULL DEFAULT 1,
  start_date TEXT,
  end_date TEXT,
  public_join_slug TEXT UNIQUE,
  max_referrals_per_customer INTEGER NOT NULL DEFAULT 10,
  grace_period_days INTEGER NOT NULL DEFAULT 2,
  carryover_percentage INTEGER NOT NULL DEFAULT 30,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Wizard Step 3 size-tier signals, persisted so a reopened wizard can
  -- pre-fill from the business's most-recently-created campaign. All
  -- nullable: a business's very first campaign has nothing to pre-fill from.
  daily_customer_count_min INTEGER,
  daily_customer_count_max INTEGER,
  monthly_revenue_toman_min REAL,
  monthly_revenue_toman_max REAL,
  follower_count INTEGER
);

CREATE TABLE campaign_tasks (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  task_pattern_id TEXT NOT NULL REFERENCES task_patterns(id),
  points_value INTEGER NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  -- Free-form label shown in the frontend (e.g. "Share your visit on
  -- Instagram Story"), separate from the underlying task_pattern.
  name TEXT NOT NULL DEFAULT ''
);

CREATE TABLE campaign_rewards (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  reward_pattern_id TEXT NOT NULL REFERENCES reward_patterns(id),
  threshold_points INTEGER NOT NULL,
  description TEXT,
  name TEXT NOT NULL DEFAULT ''
);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  phone_verified_at TEXT,
  telegram_chat_id TEXT,
  telegram_opted_in INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE customer_campaign_codes (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  personal_code TEXT NOT NULL UNIQUE,
  qr_payload TEXT NOT NULL,
  referred_by_code_id TEXT REFERENCES customer_campaign_codes(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- task_submissions and purchase_logs reference each other
-- (qualifying_purchase_id / task_submission_id). SQLite does not require the
-- referenced table to exist yet at CREATE TABLE time, so task_submissions is
-- declared first with a forward reference to purchase_logs.
CREATE TABLE task_submissions (
  id TEXT PRIMARY KEY,
  customer_campaign_code_id TEXT NOT NULL REFERENCES customer_campaign_codes(id),
  campaign_task_id TEXT NOT NULL REFERENCES campaign_tasks(id),
  submission_type TEXT NOT NULL CHECK (submission_type IN (
    'screenshot', 'receipt_claim', 'pos_scan', 'referral_auto'
  )),
  evidence_url TEXT,
  ai_confidence_score REAL,
  qualifying_purchase_id TEXT REFERENCES purchase_logs(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT CHECK (reviewed_by IN ('ai', 'central_team', 'business_owner')),
  submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  reviewed_at TEXT,
  points_awarded INTEGER,
  -- Lets the staff-pos offline sync queue detect a replayed action after a
  -- flaky sync and return "duplicate_skipped" instead of double-awarding
  -- points. Nullable + UNIQUE: SQLite treats multiple NULLs in a UNIQUE
  -- column as distinct, so non-offline submissions are unaffected.
  idempotency_key TEXT,
  -- References review_team_members(id) by convention (no FK enforcement --
  -- D1/SQLite FK enforcement is off by default in this project). Existing
  -- rows keep the fixed 'central_team' string in reviewed_by; only new
  -- resolutions populate this column going forward.
  reviewed_by_user_id TEXT
);

CREATE TABLE purchase_logs (
  id TEXT PRIMARY KEY,
  task_submission_id TEXT NOT NULL REFERENCES task_submissions(id),
  amount REAL,
  receipt_hash TEXT,
  synced_from_offline INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE reward_redemptions (
  id TEXT PRIMARY KEY,
  customer_campaign_code_id TEXT NOT NULL REFERENCES customer_campaign_codes(id),
  campaign_reward_id TEXT NOT NULL REFERENCES campaign_rewards(id),
  points_spent INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
  redemption_code TEXT UNIQUE,
  redemption_code_expires_at TEXT,
  fulfilled_at TEXT,
  redeemed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE point_carryovers (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  business_id TEXT NOT NULL REFERENCES businesses(id),
  source_campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  points INTEGER NOT NULL,
  consumed_in_campaign_id TEXT REFERENCES campaigns(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE points_ledger (
  id TEXT PRIMARY KEY,
  customer_campaign_code_id TEXT NOT NULL REFERENCES customer_campaign_codes(id),
  task_submission_id TEXT REFERENCES task_submissions(id),
  reward_redemption_id TEXT REFERENCES reward_redemptions(id),
  point_carryover_id TEXT REFERENCES point_carryovers(id),
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'earned', 'redemption', 'expiration', 'carryover_credit', 'manual_adjustment'
  )),
  points INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE benchmark_stats (
  id TEXT PRIMARY KEY,
  business_category_id TEXT NOT NULL REFERENCES business_categories(id),
  task_pattern_id TEXT NOT NULL REFERENCES task_patterns(id),
  source TEXT NOT NULL CHECK (source IN ('industry_data', 'early_adopter')),
  completion_rate REAL NOT NULL,
  sample_size INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE business_subscriptions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  subscription_plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled')),
  current_period_start TEXT,
  current_period_end TEXT
);

CREATE TABLE business_contacts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  phone_number TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('manual_upload', 'self_joined')),
  imported_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- notifications_log referenced by sms_wallet_transactions; declared here so
-- the forward reference below resolves to a real table (SQLite doesn't
-- enforce ordering, but keeping notifications_log first avoids relying on that).
CREATE TABLE notifications_log (
  id TEXT PRIMARY KEY,
  customer_campaign_code_id TEXT REFERENCES customer_campaign_codes(id),
  business_contact_id TEXT REFERENCES business_contacts(id),
  campaign_id TEXT REFERENCES campaigns(id),
  notification_template_id TEXT NOT NULL REFERENCES notification_templates(id),
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'telegram')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  provider_message_id TEXT,
  cost_toman REAL,
  sent_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE sms_wallet_transactions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  type TEXT NOT NULL CHECK (type IN ('topup', 'deduction')),
  amount_toman REAL NOT NULL,
  notification_log_id TEXT REFERENCES notifications_log(id),
  balance_after_toman REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE business_microsites (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  website_template_id TEXT NOT NULL REFERENCES website_templates(id),
  subdomain_slug TEXT NOT NULL UNIQUE,
  content TEXT,
  featured_campaign_id TEXT REFERENCES campaigns(id),
  published INTEGER NOT NULL DEFAULT 0,
  addon_monthly_price_toman REAL,
  addon_status TEXT CHECK (addon_status IN ('active', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- 0 (default): slug is still whatever ensureMicrosite() auto-generated,
  -- and PUT /microsite is free to accept a new value. 1: the owner has
  -- already made their one-time choice and the backend rejects further
  -- changes, so an already-shared/printed referral link never silently 404s.
  subdomain_slug_set_by_owner INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE business_microsite_modules (
  id TEXT PRIMARY KEY,
  business_microsite_id TEXT NOT NULL REFERENCES business_microsites(id),
  website_module_id TEXT NOT NULL REFERENCES website_modules(id),
  enabled INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  content TEXT
);

CREATE TABLE referral_flags (
  id TEXT PRIMARY KEY,
  -- The referrer's own campaign-code row (customer_campaign_codes.id) --
  -- NOT the referred customers. Lets us join back to the referrer's phone
  -- and personal_code for display without duplicating that data here.
  customer_campaign_code_id TEXT NOT NULL REFERENCES customer_campaign_codes(id),
  rule_triggered TEXT NOT NULL CHECK (rule_triggered IN ('velocity', 'dead_referral_ratio')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
  notes TEXT,
  triggered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  resolved_at TEXT,
  -- 'central_team' is a legacy fixed value on old rows; new resolutions
  -- populate resolved_by_user_id (references review_team_members(id) by
  -- convention) instead.
  resolved_by TEXT,
  resolved_by_user_id TEXT
);

CREATE TABLE insights (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly', 'anomaly')),
  message TEXT NOT NULL,
  suggested_action TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE suggested_changes (
  id TEXT PRIMARY KEY,
  insight_id TEXT REFERENCES insights(id),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  risk_tier TEXT NOT NULL CHECK (risk_tier IN ('low', 'high')),
  change_type TEXT NOT NULL CHECK (change_type IN (
    'task_points', 'reward_threshold', 'add_task', 'remove_task',
    'campaign_duration', 'reward_depth'
  )),
  target_id TEXT,
  current_value TEXT,
  suggested_value TEXT,
  rationale TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'dismissed')),
  applied_by TEXT CHECK (applied_by IN ('business_owner', 'autopilot')),
  dismiss_reason TEXT CHECK (dismiss_reason IN ('too_aggressive', 'not_relevant', 'other')),
  applied_at TEXT,
  dismissed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE business_checklist_progress (
  business_id TEXT NOT NULL REFERENCES businesses(id),
  item_key TEXT NOT NULL REFERENCES onboarding_checklist_items(item_key),
  completed_at TEXT,
  PRIMARY KEY (business_id, item_key)
);

CREATE TABLE business_ai_constraints (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id),
  max_discount_percent REAL,
  budget_ceiling_toman REAL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ============================================================
-- Helpful indexes on common lookup/FK columns
-- ============================================================
CREATE INDEX idx_campaigns_business_id ON campaigns(business_id);
CREATE INDEX idx_campaign_tasks_campaign_id ON campaign_tasks(campaign_id);
CREATE INDEX idx_campaign_rewards_campaign_id ON campaign_rewards(campaign_id);
CREATE INDEX idx_customer_campaign_codes_customer_id ON customer_campaign_codes(customer_id);
CREATE INDEX idx_customer_campaign_codes_campaign_id ON customer_campaign_codes(campaign_id);
CREATE INDEX idx_task_submissions_code_id ON task_submissions(customer_campaign_code_id);
CREATE INDEX idx_task_submissions_status ON task_submissions(status);
CREATE INDEX idx_task_submissions_idempotency_key ON task_submissions(idempotency_key);
CREATE INDEX idx_task_submissions_reviewed_by_user_id ON task_submissions(reviewed_by_user_id);
CREATE INDEX idx_points_ledger_code_id ON points_ledger(customer_campaign_code_id);
CREATE INDEX idx_business_contacts_business_id ON business_contacts(business_id);
CREATE INDEX idx_notifications_log_campaign_id ON notifications_log(campaign_id);
CREATE INDEX idx_referral_flags_code_id ON referral_flags(customer_campaign_code_id);
CREATE INDEX idx_referral_flags_status ON referral_flags(status);
CREATE INDEX idx_referral_flags_resolved_by_user_id ON referral_flags(resolved_by_user_id);
CREATE INDEX idx_suggested_changes_campaign_id ON suggested_changes(campaign_id);
CREATE INDEX idx_staff_business_id ON staff(business_id);
