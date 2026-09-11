-- Adds businesses.address (plan.md Open Item 9, flagged 2026-09-11): the
-- onboarding wizard and the rest of the app had no address field at all.
-- Nullable free text, no CHECK constraint needed -- unlike migration 0011's
-- goal-enum change, a plain ADD COLUMN works fine here since there's no
-- constraint to rebuild the table around.

ALTER TABLE businesses ADD COLUMN address TEXT;
