-- The frontend's CampaignTask/CampaignReward shapes each carry a free-form
-- `name` (e.g. "Share your visit on Instagram Story"), separate from the
-- underlying task_pattern/reward_pattern they're linked to. 0001_init.sql's
-- campaign_tasks/campaign_rewards tables only stored the pattern link +
-- points/threshold -- no place to persist that custom label. Adding it here.

ALTER TABLE campaign_tasks ADD COLUMN name TEXT NOT NULL DEFAULT '';
ALTER TABLE campaign_rewards ADD COLUMN name TEXT NOT NULL DEFAULT '';
