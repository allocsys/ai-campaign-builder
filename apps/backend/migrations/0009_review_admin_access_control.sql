-- Implements the fully-decided design in plan.md's "Review Console
-- authentication" section (Open Items 2 + 6): closes the access-control gap
-- where review_team's verify-otp had no roster check at all (unlike staff),
-- and replaces the fixed 'central_team' reviewed_by/resolved_by strings with
-- a real per-person FK. Bundled into one migration since Item 6's fix
-- (inviting review_team_members into existence) is also the FK target Item 2
-- needs.
--
-- review_team_members mirrors `staff`'s shape and invite-only pattern
-- exactly: a review_admin must register the phone first (new endpoints in
-- routes/review-admin.ts) before it can complete OTP verification with
-- role='review_team' (see routes/auth.ts).
CREATE TABLE review_team_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  phone_verified_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- review_admins holds only NON-root admins. The root admin is bootstrapped
-- entirely from env vars (REVIEW_ADMIN_USERNAME / REVIEW_ADMIN_PASSWORD_HASH,
-- see wrangler.toml) and never gets a row here -- this is what lets the very
-- first admin exist without anyone to invite them. Every row here was
-- created by some admin (root or otherwise) via the admin UI and has its own
-- individually issued username+password (changeable via self-service
-- optional password-change; root is excluded from that, see plan.md).
CREATE TABLE review_admins (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Free text, not a FK: the creator may be 'root' (the env-configured
  -- identity, which has no row anywhere to reference) or another
  -- review_admins row's username at creation time.
  created_by TEXT NOT NULL
);

-- Per-reviewer/resolver identity (Open Item 2). Nullable + no FK enforcement
-- via CHECK (D1/SQLite FK enforcement is off by default in this project, per
-- existing tables' lack of FK pragmas) -- both columns reference
-- review_team_members(id) by convention. Existing rows keep their old fixed
-- 'central_team' string in reviewed_by/resolved_by; only new resolutions
-- populate the *_user_id columns going forward (see routes/review.ts).
ALTER TABLE task_submissions ADD COLUMN reviewed_by_user_id TEXT;
ALTER TABLE referral_flags ADD COLUMN resolved_by_user_id TEXT;

CREATE INDEX idx_task_submissions_reviewed_by_user_id ON task_submissions(reviewed_by_user_id);
CREATE INDEX idx_referral_flags_resolved_by_user_id ON referral_flags(resolved_by_user_id);
