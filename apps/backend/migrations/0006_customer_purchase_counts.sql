-- Fixes Notion issue "ai-campaign-builder-issue-purchase-streak-points":
-- no sequential purchase-count/streak tracking existed anywhere in the
-- schema, so pos_scan tasks like `first_action` (only the customer's 1st
-- purchase) and `repeat_purchase` (any purchase after the 1st) had no
-- signal to distinguish themselves by -- staff-pos.ts's findPosScanTask
-- fell back to an arbitrary `LIMIT 1` across every pos_scan-verified task
-- on the campaign instead.
--
-- One row per (customer_campaign_code_id), not per customer globally --
-- a customer's purchase count is scoped to a single campaign's join code,
-- matching how points_ledger/task_submissions are already scoped.
--
-- updated_at lets a future milestone_streak feature (e.g. "every 5th
-- purchase") compute recency without an extra join to purchase_logs.
CREATE TABLE customer_purchase_counts (
  customer_campaign_code_id TEXT PRIMARY KEY REFERENCES customer_campaign_codes(id),
  purchase_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
