import { env } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
import { applyMigrations, generateTestToken, makeAppRequest } from "./helpers";

describe("Staff POS Routes (/api/staff)", () => {
  const ownerId = "sp_owner_1";
  const bizId = "sp_biz_1";
  const campaignId = "sp_camp_1";
  const staffId = "sp_staff_1";
  const customerId = "sp_cust_1";
  const personalCode = "STAFF10";

  let staffToken: string;
  let ownerToken: string;

  beforeAll(async () => {
    await applyMigrations();

    const cat = await env.DB.prepare("SELECT id FROM business_categories LIMIT 1").first();
    const posPattern = await env.DB.prepare("SELECT id FROM task_patterns WHERE verification_method = 'pos_scan' LIMIT 1").first();

    await env.DB.prepare("INSERT INTO business_owners (id, phone, phone_verified) VALUES (?, '09126660001', 1)").bind(ownerId).run();
    await env.DB.prepare("INSERT INTO businesses (id, owner_id, name, category_id) VALUES (?, ?, 'POS Test Cafe', ?)").bind(bizId, ownerId, cat?.id).run();
    await env.DB.prepare("INSERT INTO campaigns (id, business_id, goal, status) VALUES (?, ?, 'acquisition', 'active')").bind(campaignId, bizId).run();
    await env.DB.prepare("INSERT INTO campaign_tasks (id, campaign_id, task_pattern_id, points_value, display_order, name) VALUES ('pos_task_sp', ?, ?, 25, 1, 'POS Purchase')").bind(campaignId, posPattern?.id).run();

    // Staff
    await env.DB.prepare("INSERT INTO staff (id, business_id, name, phone, active) VALUES (?, ?, 'Barista Bob', '09126661111', 1)").bind(staffId, bizId).run();

    // Customer
    await env.DB.prepare("INSERT INTO customers (id, phone_number, phone_verified) VALUES (?, '09126662222', 1)").bind(customerId).run();
    await env.DB.prepare("INSERT INTO customer_campaign_codes (id, customer_id, campaign_id, personal_code, qr_payload) VALUES ('ccc_sp1', ?, ?, ?, 'CAMP-STAFF10')").bind(customerId, campaignId, personalCode).run();

    staffToken = await generateTestToken({ sub: staffId, role: "staff", businessId: bizId });
    ownerToken = await generateTestToken({ sub: ownerId, role: "business_owner" });
  });

  describe("Authentication & Business Scoping", () => {
    it("returns 403 when role is not staff", async () => {
      const res = await makeAppRequest(`/api/staff/customers/${personalCode}`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      expect(res.status).toBe(403);
    });

    it("returns 403 when staff token misses businessId scope", async () => {
      const noBizToken = await generateTestToken({ sub: staffId, role: "staff" });
      const res = await makeAppRequest(`/api/staff/customers/${personalCode}`, {
        headers: { Authorization: `Bearer ${noBizToken}` },
      });
      expect(res.status).toBe(403);
    });
  });

  describe("Customer Lookup & Purchases Logging", () => {
    it("looks up customer details by personal code", async () => {
      const res = await makeAppRequest(`/api/staff/customers/${personalCode}`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { personalCode: string; name: string; pointsBalance: number };
      expect(body.personalCode).toBe(personalCode);
      expect(body.name).toBe("09126662222");
      expect(body.pointsBalance).toBe(0);
    });

    it("logs POS purchase and awards points", async () => {
      const res = await makeAppRequest("/api/staff/purchases", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${staffToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalCode,
          amountToman: 50000,
          idempotencyKey: "idemp_sp_1",
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { status: string; pointsAwarded: number };
      expect(body.status).toBe("synced");
      expect(body.pointsAwarded).toBe(25);

      // Verify points ledger row
      const bal = await env.DB.prepare("SELECT SUM(points) AS total FROM points_ledger WHERE customer_campaign_code_id = 'ccc_sp1'").first();
      expect(bal?.total).toBe(25);
    });

    it("skips duplicate purchase when idempotency key is replayed", async () => {
      const res = await makeAppRequest("/api/staff/purchases", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${staffToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalCode,
          amountToman: 50000,
          idempotencyKey: "idemp_sp_1",
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { status: string };
      expect(body.status).toBe("duplicate_skipped");
    });
  });

  describe("Reward Redemption Fulfillment & Offline Queue Sync", () => {
    const redemptionCode = "888999";
    const redemptionId = "rr_sp_1";

    beforeAll(async () => {
      const rPattern = await env.DB.prepare("SELECT id FROM reward_patterns LIMIT 1").first();
      await env.DB.prepare("INSERT INTO campaign_rewards (id, campaign_id, reward_pattern_id, threshold_points, name) VALUES ('cr_sp_1', ?, ?, 20, 'Espresso')").bind(campaignId, rPattern?.id).run();
      await env.DB.prepare("INSERT INTO reward_redemptions (id, customer_campaign_code_id, campaign_reward_id, points_spent, status, redemption_code) VALUES (?, 'ccc_sp1', 'cr_sp_1', 20, 'pending', ?)").bind(redemptionId, redemptionCode).run();
    });

    it("looks up pending redemption code", async () => {
      const res = await makeAppRequest(`/api/staff/redemptions/${redemptionCode}`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { code: string; status: string; rewardTitle: string };
      expect(body.code).toBe(redemptionCode);
      expect(body.status).toBe("pending");
      expect(body.rewardTitle).toBe("Espresso");
    });

    it("fulfills pending redemption", async () => {
      const res = await makeAppRequest(`/api/staff/redemptions/${redemptionCode}/fulfill`, {
        method: "POST",
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { status: string };
      expect(body.status).toBe("fulfilled");
    });

    it("replays batch offline queue sync via POST /api/staff/sync", async () => {
      const res = await makeAppRequest("/api/staff/sync", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${staffToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [
            {
              id: "item_offline_1",
              idempotencyKey: "idemp_offline_1",
              personalCode,
              actionType: "purchase",
              amountToman: 30000,
            },
          ],
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { results: Array<{ itemId: string; status: string }> };
      expect(body.results.length).toBe(1);
      expect(body.results[0].status).toBe("synced");
    });
  });

  describe("Staff Review Queue", () => {
    const subId = "ts_staff_rev_1";

    beforeAll(async () => {
      const pattern = await env.DB.prepare("SELECT id FROM task_patterns WHERE name = 'social_proof' LIMIT 1").first();
      await env.DB.prepare("INSERT INTO campaign_tasks (id, campaign_id, task_pattern_id, points_value, display_order, name) VALUES ('task_sp_rev', ?, ?, 40, 2, 'Insta Story')").bind(campaignId, pattern?.id).run();
      await env.DB.prepare("INSERT INTO task_submissions (id, customer_campaign_code_id, campaign_task_id, submission_type, evidence_url, status) VALUES (?, 'ccc_sp1', 'task_sp_rev', 'screenshot', 'ev_url_sp', 'pending')").bind(subId).run();
    });

    it("fetches staff review queue submissions", async () => {
      const res = await makeAppRequest("/api/staff/submissions?status=pending", {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as Array<{ id: string; status: string }>;
      expect(body.some((s) => s.id === subId)).toBe(true);
    });

    it("resolves (approves) submission in staff review queue", async () => {
      const res = await makeAppRequest(`/api/staff/submissions/${subId}/resolve`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${staffToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ decision: "approved" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { id: string; status: string; pointsAwarded: number };
      expect(body.id).toBe(subId);
      expect(body.status).toBe("approved");
      expect(body.pointsAwarded).toBe(40);
    });
  });
});
