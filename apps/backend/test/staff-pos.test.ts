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
    // Distinct pos_scan patterns, not just "whichever pos_scan pattern is
    // first" -- this campaign intentionally configures three pos_scan tasks
    // that findEligiblePosScanTasks/findPosScanTasksByNames (staff-pos.ts)
    // must be able to tell apart: first_action (only a customer's 1st ever
    // purchase), repeat_purchase (any purchase after the 1st), and
    // specific_product_push (never auto-detected -- only awarded when staff
    // explicitly pass its pattern name).
    const posPatternFirstAction = await env.DB.prepare("SELECT id FROM task_patterns WHERE name = 'first_action'").first();
    const posPatternRepeat = await env.DB.prepare("SELECT id FROM task_patterns WHERE name = 'repeat_purchase'").first();
    const posPatternSpecificProduct = await env.DB.prepare("SELECT id FROM task_patterns WHERE name = 'specific_product_push'").first();

    await env.DB.prepare("INSERT INTO business_owners (id, phone, phone_verified) VALUES (?, '09126660001', 1)").bind(ownerId).run();
    await env.DB.prepare("INSERT INTO businesses (id, owner_id, name, category_id) VALUES (?, ?, 'POS Test Cafe', ?)").bind(bizId, ownerId, cat?.id).run();
    await env.DB.prepare("INSERT INTO campaigns (id, business_id, goal, status) VALUES (?, ?, 'acquisition', 'active')").bind(campaignId, bizId).run();
    await env.DB.prepare("INSERT INTO campaign_tasks (id, campaign_id, task_pattern_id, points_value, display_order, name) VALUES ('pos_task_sp_first', ?, ?, 25, 1, 'First Purchase')").bind(campaignId, posPatternFirstAction?.id).run();
    await env.DB.prepare("INSERT INTO campaign_tasks (id, campaign_id, task_pattern_id, points_value, display_order, name) VALUES ('pos_task_sp_repeat', ?, ?, 15, 2, 'Repeat Purchase')").bind(campaignId, posPatternRepeat?.id).run();
    await env.DB.prepare("INSERT INTO campaign_tasks (id, campaign_id, task_pattern_id, points_value, display_order, name) VALUES ('pos_task_sp_product', ?, ?, 10, 3, 'Specific Product')").bind(campaignId, posPatternSpecificProduct?.id).run();

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

    it("lists only explicitly-selectable pos_scan task patterns, excluding first_action/repeat_purchase", async () => {
      const res = await makeAppRequest("/api/staff/pos-tasks", {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as Array<{ patternName: string; taskName: string; pointsValue: number }>;
      // first_action and repeat_purchase are auto-detected by purchase count
      // and must never appear here -- only patterns staff must pick manually,
      // like specific_product_push, are selectable.
      expect(body).toEqual([{ patternName: "specific_product_push", taskName: "Specific Product", pointsValue: 10 }]);
    });

    it("logs a customer's first-ever POS purchase and awards only the first_action task", async () => {
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
      const body = await res.json() as { status: string; pointsAwarded: number; tasksAwarded: string[]; purchaseCount: number };
      expect(body.status).toBe("synced");
      // Brand-new customer's 1st purchase -> only first_action (25 pts) is
      // eligible. repeat_purchase must NOT fire here even though it's
      // configured on this same campaign -- this is the exact scenario the
      // old `LIMIT 1` (no ORDER BY) query got wrong non-deterministically.
      expect(body.pointsAwarded).toBe(25);
      expect(body.tasksAwarded).toEqual(["first_action"]);
      expect(body.purchaseCount).toBe(1);

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

    it("awards repeat_purchase (not first_action) on the customer's 2nd purchase", async () => {
      const res = await makeAppRequest("/api/staff/purchases", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${staffToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalCode,
          amountToman: 40000,
          idempotencyKey: "idemp_sp_2",
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { status: string; pointsAwarded: number; tasksAwarded: string[]; purchaseCount: number };
      expect(body.status).toBe("synced");
      expect(body.pointsAwarded).toBe(15);
      expect(body.tasksAwarded).toEqual(["repeat_purchase"]);
      expect(body.purchaseCount).toBe(2);

      const bal = await env.DB.prepare("SELECT SUM(points) AS total FROM points_ledger WHERE customer_campaign_code_id = 'ccc_sp1'").first();
      expect(bal?.total).toBe(40); // 25 (first_action) + 15 (repeat_purchase)
    });

    it("awards both the auto-detected repeat_purchase task AND an explicitly-selected specific_product_push task", async () => {
      const res = await makeAppRequest("/api/staff/purchases", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${staffToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalCode,
          amountToman: 60000,
          idempotencyKey: "idemp_sp_3",
          taskPatternNames: ["specific_product_push"],
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { status: string; pointsAwarded: number; tasksAwarded: string[]; purchaseCount: number };
      expect(body.status).toBe("synced");
      // repeat_purchase (auto, purchaseCount=3 > 1) + specific_product_push
      // (explicit) = 15 + 10 = 25, and each is its own task_submissions +
      // points_ledger row rather than only one of them winning arbitrarily.
      expect(body.pointsAwarded).toBe(25);
      expect(body.tasksAwarded.sort()).toEqual(["repeat_purchase", "specific_product_push"]);
      expect(body.purchaseCount).toBe(3);

      const bal = await env.DB.prepare("SELECT SUM(points) AS total FROM points_ledger WHERE customer_campaign_code_id = 'ccc_sp1'").first();
      expect(bal?.total).toBe(65); // 25 + 15 + 25

      // Still exactly one purchase_logs row for THIS purchase event, even
      // though two task_submissions/points_ledger rows were created for it.
      const submissionIds = await env.DB.prepare(
        "SELECT id FROM task_submissions WHERE idempotency_key = 'idemp_sp_3'"
      ).all();
      const purchaseLogRows = await env.DB.prepare(
        "SELECT id FROM purchase_logs WHERE task_submission_id IN (SELECT id FROM task_submissions WHERE customer_campaign_code_id = 'ccc_sp1')"
      ).all();
      expect(submissionIds.results?.length).toBe(1); // idempotency_key is only stamped on the first submission of the batch
      expect(purchaseLogRows.results?.length).toBe(3); // one per purchase call so far (idemp_sp_1, idemp_sp_2, idemp_sp_3)
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
