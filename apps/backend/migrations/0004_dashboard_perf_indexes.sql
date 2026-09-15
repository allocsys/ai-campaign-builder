-- Perf fix (dashboard-perf branch): two lookup columns that were queried
-- constantly but had no index, causing full table scans that get worse as
-- data grows.
--
-- businesses.owner_id: looked up on EVERY /api/business/* request (the
-- router-wide auth middleware resolves the caller's business by owner_id),
-- so this was the highest-impact of the two -- a full scan of `businesses`
-- on every single authenticated business-owner request.
--
-- reward_redemptions.customer_campaign_code_id: joined in loadBusinessStats
-- (GET /business/stats and GET /business/campaigns/:campaignId/stats), which
-- the dashboard hits on every load.
CREATE INDEX idx_businesses_owner_id ON businesses(owner_id);
CREATE INDEX idx_reward_redemptions_code_id ON reward_redemptions(customer_campaign_code_id);
