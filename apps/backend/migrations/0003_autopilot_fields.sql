-- Adds the two autopilot-related fields the business-owner AutopilotTab needs
-- that weren't part of the original schema: businesses.autopilot_enabled
-- (added in 0001_init.sql) only covers the on/off flag. This migration adds:
--
--   manual_apply_count: running count of suggested_changes this business's
--   owner has manually applied (applied_by = 'business_owner'), tracked as a
--   denormalized counter on businesses rather than computed via COUNT(*) on
--   every read -- it's read on every AutopilotTab load, and the increment
--   happens at a single, well-defined write site (the apply-suggestion
--   handler), so keeping it denormalized avoids an extra join+aggregate on
--   a hot read path for a value that only ever increments by 1 at a time.
--
--   autopilot_eligibility_threshold: how many manual applies are required
--   before autopilot can be enabled for this business. Stored per-business
--   (not a single global constant) so it can later vary by size tier, risk
--   profile, etc. without another migration. DEFAULT 3 is a placeholder
--   product decision (not sourced from architecture.md/plan.md, which don't
--   specify a number) -- adjust the default here, or override per-business
--   after backfill, once product settles on the real value.

ALTER TABLE businesses ADD COLUMN manual_apply_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE businesses ADD COLUMN autopilot_eligibility_threshold INTEGER NOT NULL DEFAULT 3;
