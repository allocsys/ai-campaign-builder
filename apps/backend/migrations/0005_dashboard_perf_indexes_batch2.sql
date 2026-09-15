-- Perf fix (dashboard-perf-batch2 branch): more lookup/sort columns that
-- were queried constantly but had no index.
--
-- notifications_log.business_contact_id: the Sends Log tab's GET
-- /notifications-log filters via `WHERE cp.business_id = ? OR bc.business_id
-- = ?` -- campaign_id was already indexed (idx_notifications_log_campaign_id)
-- but business_contact_id wasn't, so the business_contacts-driven half of
-- that query (rewritten below into a UNION so each half can use its own
-- index) had no indexed path back into notifications_log.
--
-- notifications_log.sent_at: every load of the Sends Log tab does
-- `ORDER BY sent_at DESC LIMIT 200` -- without an index this requires a full
-- sort of every matching row before the LIMIT can be applied, and gets
-- slower as message volume grows.
--
-- insights.campaign_id: GET /insights joins insights to campaigns filtered
-- by campaigns.business_id (indexed), but insights.campaign_id itself
-- wasn't indexed, so matching insights back to those campaigns was a full
-- scan of `insights`.
--
-- staff.phone: POST /staff's uniqueness check (`SELECT id FROM staff WHERE
-- phone = ?`, deliberately global across every business, not just this
-- one) had no index -- full scan of the whole `staff` table on every
-- staff-add. Low frequency (not a page-load query) but cheap to fix.
CREATE INDEX idx_notifications_log_business_contact_id ON notifications_log(business_contact_id);
CREATE INDEX idx_notifications_log_sent_at ON notifications_log(sent_at);
CREATE INDEX idx_insights_campaign_id ON insights(campaign_id);
CREATE INDEX idx_staff_phone ON staff(phone);
