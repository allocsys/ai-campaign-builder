-- Adds support for the review-console persona's referral-anomaly-flags
-- queue. Central-team members run a batch detection pass (GET
-- /api/review/referral-aggregates computes live from customer_campaign_codes
-- + task_submissions, POST /api/review/referral-flags/run-detection turns
-- qualifying aggregates into persisted rows here) and then resolve each flag
-- as 'reviewed' (false positive / benign, no action taken) or 'dismissed'.
-- These flags are informational only -- no automated action is ever taken
-- against the referrer from this queue; actual referral-abuse prevention is
-- enforced elsewhere (max_referrals_per_customer cap in customer.ts).
--
-- Two rule types match the pre-existing frontend mock's thresholds exactly
-- (mock-data.ts's runReferralAnomalyDetection, now re-implemented server-side
-- in routes/review.ts): 'velocity' (>5 referred signups in 24h) and
-- 'dead_referral_ratio' (>=5 referred signups older than 7 days with zero
-- approved task_submissions).

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
  -- 'central_team' is the only reviewer type for this queue today (mirrors
  -- task_submissions.reviewed_by's convention), kept as free text rather than
  -- a CHECK constraint in case a named-reviewer audit trail is added later.
  resolved_by TEXT
);

CREATE INDEX idx_referral_flags_code_id ON referral_flags(customer_campaign_code_id);
CREATE INDEX idx_referral_flags_status ON referral_flags(status);
