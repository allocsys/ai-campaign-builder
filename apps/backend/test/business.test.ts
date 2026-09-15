import { env } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
import { applyMigrations, generateTestToken, makeAppRequest } from "./helpers";

describe("Business Routes (/api/business)", () => {
  const ownerId = "biz_test_owner_1";
  const bizId = "biz_test_id_1";
  let ownerToken: string;

  beforeAll(async () => {
    await applyMigrations();

    const cat = await env.DB.prepare("SELECT id FROM business_categories LIMIT 1").first();
    await env.DB.prepare("INSERT INTO business_owners (id, phone, phone_verified) VALUES (?, '09125550001', 1)").bind(ownerId).run();
    await env.DB.prepare("INSERT INTO businesses (id, owner_id, name, category_id, size_tier) VALUES (?, ?, 'Acme Bakery', ?, 'small')").bind(bizId, ownerId, cat?.id).run();

    ownerToken = await generateTestToken({ sub: ownerId, role: "business_owner" });
  });

  describe("Authentication & Role Check", () => {
    it("returns 403 for non-business_owner role", async () => {
      const token = await generateTestToken({ sub: "cust1", role: "customer" });
      const res = await makeAppRequest("/api/business/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(403);
    });
  });

  describe("Profile Management", () => {
    it("fetches business profile", async () => {
      const res = await makeAppRequest("/api/business/profile", {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { name: string; sizeTier: string };
      expect(body.name).toBe("Acme Bakery");
      expect(body.sizeTier).toBe("small");
    });

    it("updates business profile", async () => {
      const res = await makeAppRequest("/api/business/profile", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address: "123 Main St", sizeTier: "medium" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { address: string; sizeTier: string };
      expect(body.address).toBe("123 Main St");
      expect(body.sizeTier).toBe("medium");
    });
  });

  describe("Campaign & Staff Management", () => {
    let campaignId: string;

    it("creates a new campaign via POST /api/business/campaigns", async () => {
      const rewardPattern = await env.DB.prepare("SELECT name FROM reward_patterns LIMIT 1").first();
      const catRow = await env.DB.prepare("SELECT slug FROM business_categories LIMIT 1").first();

      const res = await makeAppRequest("/api/business/campaigns", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessName: "Acme Bakery",
          categorySlug: catRow?.slug ?? "cafe",
          goal: "acquisition",
          rewardPatternNames: [rewardPattern?.name ?? "discount"],
          dailyCustomerCount: 50,
          monthlyRevenueToman: 100000000,
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as { campaignId: string; status: string };
      expect(body.campaignId).toBeDefined();
      expect(body.status).toBe("draft");
      campaignId = body.campaignId;
    });

    it("lists campaigns via GET /api/business/campaigns", async () => {
      const res = await makeAppRequest("/api/business/campaigns", {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as Array<{ id: string; status: string }>;
      expect(body.length).toBeGreaterThan(0);
      expect(body.some((c) => c.id === campaignId)).toBe(true);
    });

    it("updates campaign status to active via PUT /api/business/campaigns/:id", async () => {
      const res = await makeAppRequest(`/api/business/campaigns/${campaignId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "active" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { status: string };
      expect(body.status).toBe("active");
    });

    it("registers staff member via POST /api/business/staff", async () => {
      const res = await makeAppRequest("/api/business/staff", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Sara Staff", phone: "09125559999" }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as { id: string; name: string; phone: string; active: boolean };
      expect(body.id).toBeDefined();
      expect(body.name).toBe("Sara Staff");
      expect(body.active).toBe(true);
    });
  });

  describe("Suggestions Management", () => {
    let suggestionId: string;

    beforeAll(async () => {
      const camp = await env.DB.prepare("SELECT id FROM campaigns WHERE business_id = ? LIMIT 1").bind(bizId).first();
      suggestionId = "sug_test_1";
      await env.DB.prepare(`
        INSERT INTO suggested_changes (id, campaign_id, risk_tier, change_type, target_id, current_value, suggested_value, rationale, status)
        VALUES (?, ?, 'low', 'task_points', null, '{}', '{"points": 20}', 'Boost points', 'pending')
      `).bind(suggestionId, camp?.id).run();
    });

    it("fetches suggestions via GET /api/business/suggestions", async () => {
      const res = await makeAppRequest("/api/business/suggestions", {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as Array<{ id: string; status: string }>;
      expect(body.some((s) => s.id === suggestionId)).toBe(true);
    });

    it("dismisses a pending suggestion", async () => {
      const res = await makeAppRequest(`/api/business/suggestions/${suggestionId}/dismiss`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "not_relevant" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { status: string };
      expect(body.status).toBe("dismissed");
    });
  });
});
