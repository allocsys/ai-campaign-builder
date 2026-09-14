-- Adds businesses.owner_first_name and businesses.owner_last_name.
--
-- Context: routes/auth.ts's POST /api/auth/verify-otp business_owner branch
-- auto-creates a businesses row on a brand-new phone with a hardcoded
-- placeholder business name ("کسب‌وکار جدید") and no record of the owner's
-- own name at all -- there was never a column for it. Product decision
-- (this session): a brand-new signup now collects the owner's first + last
-- name at the auth step itself (required, blocks OTP verification if
-- missing -- see verify-otp's updated validation). An EXISTING business
-- signing in again is unaffected and never asked for this.
--
-- Two separate columns (not one combined "owner_name" free-text field) --
-- the product decision was explicitly for a first-name input and a
-- last-name input, not a single name field.
--
-- Both nullable: every pre-existing business row predates this column and
-- has no owner name on file; nothing backfills them retroactively (no
-- reliable source to backfill from), and no code path should treat NULL
-- here as an error for an existing business. Plain ADD COLUMN is safe --
-- same reasoning as migration 0012's address column, no CHECK constraint to
-- rebuild the table around.

ALTER TABLE businesses ADD COLUMN owner_first_name TEXT;
ALTER TABLE businesses ADD COLUMN owner_last_name TEXT;
