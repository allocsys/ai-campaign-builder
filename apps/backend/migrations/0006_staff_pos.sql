-- Adds support for the staff-pos persona: a dedicated `staff` identity table
-- (separate from customers/businesses, per the accountability/least-privilege/
-- revocability decision made for this persona -- see project notes), scoped
-- to a single business. Staff signup is invite-only: a business owner
-- pre-registers a staff phone (via a new business-side endpoint, added
-- separately in auth.ts/business.ts) before that phone can request an OTP
-- with role='staff'. Mirrors the customers table shape where applicable.
--
-- Also adds an idempotency_key column to task_submissions to support the
-- staff-pos offline queue: a POS device may replay the same queued
-- pos_scan/purchase action after a flaky sync, and the sync endpoint needs to
-- detect the replay and return a "duplicate_skipped" result instead of
-- double-awarding points. Nullable + UNIQUE: only offline-queue-synced
-- submissions set it, everything else stays NULL (SQLite treats multiple
-- NULLs in a UNIQUE column as distinct, so this doesn't collide with existing
-- non-offline submission rows).

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

CREATE INDEX idx_staff_business_id ON staff(business_id);

ALTER TABLE task_submissions ADD COLUMN idempotency_key TEXT UNIQUE;
