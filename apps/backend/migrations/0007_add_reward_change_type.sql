-- Fixes: chat assistant loops forever ("متوجه دقیق درخواستتون نشدم...")
-- when an owner asks to add a new reward. Root cause: 'add_reward' was
-- never one of the 6 legal suggested_changes.change_type values (see
-- 0001_init.sql's CHECK constraint), so campaign-agent.ts's own rule 1
-- ("if no valid change type fits, ask a clarifying question instead of
-- guessing") correctly refused to guess -- but no rephrasing could ever
-- satisfy it, since the type simply didn't exist. See lib/campaign-agent.ts
-- and routes/business.ts (serializeCampaign/applySuggestionMutation) for
-- the rest of this fix.
--
-- SQLite has no ALTER TABLE ... ALTER CHECK -- a CHECK constraint can only
-- be changed by rebuilding the table (standard 12-step SQLite pattern:
-- create the new shape, copy rows, drop the old table, rename the new one
-- into place, then recreate anything that referenced the old table by
-- name -- here just the one index). Same "product has no real users yet,
-- safe to reshape in place" reasoning as 0001_init.sql's own header
-- comment and 0003's note -- no data-migration/backfill concerns here
-- since every existing row's change_type is already one of the 6 values
-- still present in the new constraint.
PRAGMA foreign_keys = OFF;

CREATE TABLE suggested_changes_new (
  id TEXT PRIMARY KEY,
  insight_id TEXT REFERENCES insights(id),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  risk_tier TEXT NOT NULL CHECK (risk_tier IN ('low', 'high')),
  change_type TEXT NOT NULL CHECK (change_type IN (
    'task_points', 'reward_threshold', 'add_task', 'remove_task',
    'campaign_duration', 'reward_depth', 'add_reward'
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

INSERT INTO suggested_changes_new
  (id, insight_id, campaign_id, risk_tier, change_type, target_id, current_value,
   suggested_value, rationale, status, applied_by, dismiss_reason, applied_at, dismissed_at, created_at)
SELECT
  id, insight_id, campaign_id, risk_tier, change_type, target_id, current_value,
  suggested_value, rationale, status, applied_by, dismiss_reason, applied_at, dismissed_at, created_at
FROM suggested_changes;

DROP TABLE suggested_changes;
ALTER TABLE suggested_changes_new RENAME TO suggested_changes;

-- Recreate the one index 0001_init.sql defined on this table (dropped
-- along with the old table above -- SQLite indexes aren't renamed with
-- their table).
CREATE INDEX idx_suggested_changes_campaign_id ON suggested_changes(campaign_id);

PRAGMA foreign_keys = ON;
