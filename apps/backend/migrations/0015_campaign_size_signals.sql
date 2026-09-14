-- plan.md Item 21 Step C: the wizard's Step 3 size-tier signals
-- (daily-customer-count range, monthly-revenue range, optional follower
-- count) were only ever used transiently by generateCampaignProposal's
-- resolveSizeTier math and then discarded -- never persisted onto the
-- campaigns row they produced. That made Item 21's "pre-fill Step 3 from
-- the business's most-recently-created campaign" decision impossible to
-- build, since there was nothing to read back.
--
-- Storing the actual min/max RANGE the owner selected (not just the
-- average fed to resolveSizeTier) rather than a single averaged number,
-- so a reopened wizard can faithfully restore the same range-slider
-- position instead of collapsing a "10 to 50" selection into a single
-- misleading midpoint value. follower_count mirrors the existing
-- optional-signal semantics (NULL = no Instagram page checked, same as
-- campaign-generator.ts's `followerCount: number | null`).
--
-- All 5 columns nullable: every pre-existing campaign row (created before
-- this migration) simply has no recorded signals, same as a business's
-- very first-ever campaign has nothing to pre-fill from -- the wizard
-- falls back to its existing hardcoded defaults in either case, not an
-- error.
ALTER TABLE campaigns ADD COLUMN daily_customer_count_min INTEGER;
ALTER TABLE campaigns ADD COLUMN daily_customer_count_max INTEGER;
ALTER TABLE campaigns ADD COLUMN monthly_revenue_toman_min REAL;
ALTER TABLE campaigns ADD COLUMN monthly_revenue_toman_max REAL;
ALTER TABLE campaigns ADD COLUMN follower_count INTEGER;
