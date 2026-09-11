-- Adds 'acquisition_retention' as a third campaigns.goal value (combined
-- "جذب و نگه‌داشتن مشتری" option requested alongside the existing
-- acquisition/retention pair -- see campaign-generator.ts's selectTasks()
-- for the goal-driven weight logic this unlocks, which is a genuinely
-- separate branch for this goal, not an interpolation between the other two).
--
-- SQLite CHECK constraints can't be altered in place (no ALTER TABLE ...
-- DROP/ADD CONSTRAINT), so this follows SQLite's standard 12-step table-
-- rebuild recipe: create a replacement table with the new CHECK list, copy
-- every row across, drop the old table, rename the replacement into place,
-- then recreate the indexes that lived on the old table (dropped along with
-- it). Every other column/default/FK is unchanged from migration 0001.

PRAGMA foreign_keys = OFF;

CREATE TABLE campaigns_new (
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
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO campaigns_new
  SELECT id, business_id, goal, audience_description, offer_description, status,
         point_multiplier, start_date, end_date, public_join_slug,
         max_referrals_per_customer, grace_period_days, carryover_percentage, created_at
  FROM campaigns;

DROP TABLE campaigns;
ALTER TABLE campaigns_new RENAME TO campaigns;

CREATE INDEX idx_campaigns_business_id ON campaigns(business_id);

PRAGMA foreign_keys = ON;
