import { env } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
import { applyMigrations, generateTestToken, makeAppRequest } from "./helpers";
import { ensureCustomerCampaignCode } from "../src/routes/customer";

describe("Customer Routes (/api/customer)", () => {
  const ownerId = "cust_owner_1";
  const bizId = "cust_biz_1";
  const campaignId = "cust_camp_1";
  const customerId = "cust_user_1";
  const referrerCustomerId = "cust_user_referrer";

  let customerToken: string;
  let referrerToken: string;
  let ownerToken: string;

  beforeAll(async () => {
    await applyMigrations();

    const cat = await env.DB.prepare("SELECT id FROM business_categories LIMIT 1").first();
    await env.DB.prepare("INSERT INTO business_owners (id, phone, phone_verified) VALUES (?, '09120000001', 1)").bind(ownerId).run();
    await env.DB.prepare("INSERT INTO businesses (id, owner_id, name, category_id) VALUES (?, ?, 'Customer Test Cafe', ?)").bind(bizId, ownerId, cat?.id).run();
    await env.DB.prepare("INSERT INTO campaigns (id, business_id, goal, status, max_referrals_per_customer) VALUES (?, ?, 'acquisition', 'active', 2)").bind(campaignId, bizId).run();

    // Create customer rows
    await env.DB.prepare("INSERT INTO customers (id, phone_number, phone_verified) VALUES (?, '09121110001', 1)").bind(customerId).run();
    await env.DB.prepare("INSERT INTO customers (id, phone_number, phone_verified) VALUES (?, '09121110002', 1)").bind(referrerCustomerId).run();

    // Setup campaign code for referrer
    await env.DB.prepare("INSERT INTO customer_campaign_codes (id, customer_id, campaign_id, personal_code, qr_payload) VALUES ('ccc_ref', ?, ?, 'REF123', 'CAMP-REF123')").bind(referrerCustomerId, campaignId).run();

    // Setup campaign code for customer
    await env.DB.prepare("INSERT INTO customer_campaign_codes (id, customer_id, campaign_id, personal_code, qr_payload) VALUES ('ccc_cust1', ?, ?, 'CUST10', 'CAMP-CUST10')").bind(customerId, campaignId).run();

    // Tokens
    customerToken = await generateTestToken({ sub: customerId, role: "customer", campaignId });
    referrerToken = await generateTestToken({ sub: referrerCustomerId, role: "customer", campaignId });
    ownerToken = await generateTestToken({ sub: ownerId, role: "business_owner" });
  });

  describe("Authentication & Authorization Middleware", () => {
    it("returns 401 when Authorization header is missing", async () => {
      const res = await makeAppRequest("/api/customer/profile");
      expect(res.status).toBe(401);
    });

    it("returns 403 when role is not customer", async () => {
      const res = await makeAppRequest("/api/customer/profile", {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/customer/profile & PUT /api/customer/telegram-opt-in", () => {
    it("returns customer profile details", async () => {
      const res = await makeAppRequest("/api/customer/profile", {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { businessName: string; personalCode: string; pointsBalance: number };
      expect(body.businessName).toBe("Customer Test Cafe");
      expect(body.personalCode).toBe("CUST10");
      expect(body.pointsBalance).toBe(0);
    });

    it("updates telegram opt-in state", async () => {
      const res = await makeAppRequest("/api/customer/telegram-opt-in", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${customerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ optedIn: true }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { telegramOptedIn: boolean };
      expect(body.telegramOptedIn).toBe(true);

      const row = await env.DB.prepare("SELECT telegram_opted_in FROM customers WHERE id = ?").bind(customerId).first();
      expect(row?.telegram_opted_in).toBe(1);
    });
  });

  describe("Referral Capping in ensureCustomerCampaignCode", () => {
    it("links referral code if under max cap and flags capped if exceeded", async () => {
      // Referred customer 1
      const c1Id = "cust_ref_child_1";
      await env.DB.prepare("INSERT INTO customers (id, phone_number, phone_verified) VALUES (?, '09121119001', 1)").bind(c1Id).run();
      const res1 = await ensureCustomerCampaignCode(env.DB, c1Id, campaignId, "REF123");
      expect(res1?.capped).toBe(false);

      // Referred customer 2
      const c2Id = "cust_ref_child_2";
      await env.DB.prepare("INSERT INTO customers (id, phone_number, phone_verified) VALUES (?, '09121119002', 1)").bind(c2Id).run();
      const res2 = await ensureCustomerCampaignCode(env.DB, c2Id, campaignId, "REF123");
      expect(res2?.capped).toBe(false);

      // Referred customer 3 (max_referrals_per_customer is 2, so this 3rd referral exceeds cap)
      const c3Id = "cust_ref_child_3";
      await env.DB.prepare("INSERT INTO customers (id, phone_number, phone_verified) VALUES (?, '09121119003', 1)").bind(c3Id).run();
      const res3 = await ensureCustomerCampaignCode(env.DB, c3Id, campaignId, "REF123");
      expect(res3?.capped).toBe(true);
    });
  });

  describe("Task Submission & Rewards Redemption", () => {
    let taskId: string;
    let rewardId: string;

    beforeAll(async () => {
      // Seed task pattern and task
      const pattern = await env.DB.prepare("SELECT id FROM task_patterns WHERE verification_method = 'screenshot_ai' LIMIT 1").first();
      taskId = "task_test_1";
      await env.DB.prepare("INSERT INTO campaign_tasks (id, campaign_id, task_pattern_id, points_value, display_order, name) VALUES (?, ?, ?, 50, 1, 'Story Share')").bind(taskId, campaignId, pattern?.id).run();

      // Seed reward pattern and reward
      const rPattern = await env.DB.prepare("SELECT id FROM reward_patterns LIMIT 1").first();
      rewardId = "reward_test_1";
      await env.DB.prepare("INSERT INTO campaign_rewards (id, campaign_id, reward_pattern_id, threshold_points, name) VALUES (?, ?, ?, 100, 'Free Coffee')").bind(rewardId, campaignId, rPattern?.id).run();
    });

    it("submits a task and creates pending submission", async () => {
      const res = await makeAppRequest(`/api/customer/tasks/${taskId}/submit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${customerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ evidenceUrl: "key_evidence_1" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { submissionId: string; status: string };
      expect(body.status).toBe("pending");
      expect(body.submissionId).toBeDefined();
    });

    it("fails reward redemption when balance is insufficient", async () => {
      const res = await makeAppRequest(`/api/customer/rewards/${rewardId}/redeem`, {
        method: "POST",
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      expect(res.status).toBe(400);
      const body = await res.json() as { error: string };
      expect(body.error).toBe("Insufficient points balance");
    });

    it("succeeds reward redemption when balance is sufficient", async () => {
      // Grant 150 points to customer
      await env.DB.prepare("INSERT INTO points_ledger (id, customer_campaign_code_id, entry_type, points) VALUES ('pl_test_1', 'ccc_cust1', 'earned', 150)").run();

      const res = await makeAppRequest(`/api/customer/rewards/${rewardId}/redeem`, {
        method: "POST",
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { redemptionId: string; redemptionCode: string };
      expect(body.redemptionCode).toBeDefined();

      // Check points balance deducted by 100
      const balRow = await env.DB.prepare("SELECT SUM(points) AS total FROM points_ledger WHERE customer_campaign_code_id = 'ccc_cust1'").first();
      expect(balRow?.total).toBe(50);
    });
  });

  describe("POST /api/customer/retro-claims Guards", () => {
    beforeAll(async () => {
      // Ensure POS task exists for retro-claims
      const posPattern = await env.DB.prepare("SELECT id FROM task_patterns WHERE verification_method = 'pos_scan' LIMIT 1").first();
      await env.DB.prepare("INSERT INTO campaign_tasks (id, campaign_id, task_pattern_id, points_value, display_order, name) VALUES ('pos_task_1', ?, ?, 30, 2, 'Repeat Purchase')").bind(campaignId, posPattern?.id).run();
    });

    it("rejects claims outside time window (> 72 hours)", async () => {
      const res = await makeAppRequest("/api/customer/retro-claims", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${customerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ hoursAgo: 80, receiptHash: "hash_old_1" }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as { success: boolean; reason: string };
      expect(body.success).toBe(false);
      expect(body.reason).toBe("outside_time_window");
    });

    it("creates retro claim successfully", async () => {
      const res = await makeAppRequest("/api/customer/retro-claims", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${customerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ hoursAgo: 10, receiptHash: "hash_unique_1" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; claim: { receiptHash: string } };
      expect(body.success).toBe(true);
      expect(body.claim.receiptHash).toBe("hash_unique_1");
    });

    it("rejects duplicate receipt hash (409 duplicate_receipt)", async () => {
      const res = await makeAppRequest("/api/customer/retro-claims", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${customerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ hoursAgo: 5, receiptHash: "hash_unique_1" }),
      });
      expect(res.status).toBe(409);
      const body = await res.json() as { success: boolean; reason: string };
      expect(body.success).toBe(false);
      expect(body.reason).toBe("duplicate_receipt");
    });

    it("rejects when pending retro claims rate limit is exceeded (429 rate_limited)", async () => {
      // Seed pending receipt claims up to rate limit (RETRO_CLAIM_RATE_LIMIT is 3 in shared-config)
      for (let i = 2; i <= 3; i++) {
        const subId = `ts_pending_${i}`;
        await env.DB.prepare("INSERT INTO task_submissions (id, customer_campaign_code_id, campaign_task_id, submission_type, status) VALUES (?, 'ccc_cust1', 'pos_task_1', 'receipt_claim', 'pending')").bind(subId).run();
        await env.DB.prepare("INSERT INTO purchase_logs (id, task_submission_id, receipt_hash) VALUES (?, ?, ?)").bind(`pl_pending_${i}`, subId, `hash_pending_${i}`).run();
      }

      const res = await makeAppRequest("/api/customer/retro-claims", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${customerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ hoursAgo: 2, receiptHash: "hash_rate_limited_new" }),
      });
      expect(res.status).toBe(429);
      const body = await res.json() as { success: boolean; reason: string };
      expect(body.success).toBe(false);
      expect(body.reason).toBe("rate_limited");
    });
  });
});
