import { env } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
import { applyMigrations, makeAppRequest } from "./helpers";
import { verifyJWT } from "../src/middleware/auth";
import { TEST_JWT_SECRET } from "./helpers";

describe("Auth Routes (/api/auth)", () => {
  beforeAll(async () => {
    await applyMigrations();
  });

  describe("POST /api/auth/request-otp", () => {
    it("returns 400 when phone or role is missing", async () => {
      const res1 = await makeAppRequest("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "09121111111" }),
      });
      expect(res1.status).toBe(400);

      const res2 = await makeAppRequest("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "customer" }),
      });
      expect(res2.status).toBe(400);
    });

    it("returns 400 for an invalid role", async () => {
      const res = await makeAppRequest("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "09121111111", role: "superadmin" }),
      });
      expect(res.status).toBe(400);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("Invalid role specified");
    });

    it("returns devOtp for valid request (customer role)", async () => {
      const res = await makeAppRequest("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "09122222222", role: "customer" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json() as { ok: boolean; devOtp: string; isNewBusiness?: boolean };
      expect(data.ok).toBe(true);
      expect(data.devOtp).toBe("5432");
      expect(data.isNewBusiness).toBeUndefined();
    });

    it("returns isNewBusiness = true for new business owner phone", async () => {
      const res = await makeAppRequest("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "09129990001", role: "business_owner" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json() as { ok: boolean; devOtp: string; isNewBusiness?: boolean };
      expect(data.ok).toBe(true);
      expect(data.devOtp).toBe("7712");
      expect(data.isNewBusiness).toBe(true);
    });
  });

  describe("POST /api/auth/verify-otp", () => {
    it("fails with wrong OTP", async () => {
      const res = await makeAppRequest("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "09122222222", otp: "0000", role: "customer" }),
      });
      expect(res.status).toBe(401);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("Invalid OTP code");
    });

    describe("business_owner role", () => {
      it("requires first and last name for new signup", async () => {
        const res = await makeAppRequest("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: "09129990002",
            otp: "7712",
            role: "business_owner",
          }),
        });
        expect(res.status).toBe(400);
      });

      it("creates business_owners row and issues JWT on valid signup", async () => {
        const res = await makeAppRequest("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: "09129990002",
            otp: "7712",
            role: "business_owner",
            ownerFirstName: "Ali",
            ownerLastName: "Rezai",
          }),
        });
        expect(res.status).toBe(200);
        const data = await res.json() as { ok: boolean; token: string; user: { id: string; role: string; phone: string } };
        expect(data.ok).toBe(true);
        expect(data.user.role).toBe("business_owner");
        expect(data.user.phone).toBe("09129990002");

        const verified = await verifyJWT(data.token, TEST_JWT_SECRET);
        expect(verified).not.toBeNull();
        expect(verified?.role).toBe("business_owner");
        expect(verified?.sub).toBe(data.user.id);

        // Verify DB row
        const row = await env.DB.prepare("SELECT * FROM business_owners WHERE phone = ?").bind("09129990002").first();
        expect(row).not.toBeNull();
        expect(row?.owner_first_name).toBe("Ali");
      });
    });

    describe("customer role", () => {
      it("rejects first-ever customer signup without join link or existing campaign code", async () => {
        const res = await makeAppRequest("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: "09128880001",
            otp: "5432",
            role: "customer",
          }),
        });
        expect(res.status).toBe(400);
        const data = await res.json() as { error: string };
        expect(data.error).toContain("برای عضویت، لطفاً از لینک مخصوص عضویت");
      });

      it("succeeds when valid joinSlug is supplied", async () => {
        // Seed business, owner, campaign with a valid category
        const ownerId = "owner_test_1";
        const bizId = "biz_test_1";
        const campaignId = "camp_test_1";
        const joinSlug = "slug1234";

        const cat = await env.DB.prepare("SELECT id FROM business_categories LIMIT 1").first();
        expect(cat).not.toBeNull();

        await env.DB.prepare("INSERT INTO business_owners (id, phone, phone_verified) VALUES (?, ?, 1)").bind(ownerId, "09127770001").run();
        await env.DB.prepare("INSERT INTO businesses (id, owner_id, name, category_id) VALUES (?, ?, 'Test Cafe', ?)").bind(bizId, ownerId, cat?.id).run();
        await env.DB.prepare("INSERT INTO campaigns (id, business_id, goal, status, public_join_slug) VALUES (?, ?, 'acquisition', 'active', ?)").bind(campaignId, bizId, joinSlug).run();

        const res = await makeAppRequest("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: "09128880001",
            otp: "5432",
            role: "customer",
            joinSlug,
          }),
        });
        expect(res.status).toBe(200);
        const data = await res.json() as { ok: boolean; token: string; user: { id: string } };
        expect(data.ok).toBe(true);

        const payload = await verifyJWT(data.token, TEST_JWT_SECRET);
        expect(payload?.role).toBe("customer");
        expect(payload?.campaignId).toBe(campaignId);

        // Verify customer_campaign_codes created
        const codeRow = await env.DB.prepare("SELECT * FROM customer_campaign_codes WHERE customer_id = ? AND campaign_id = ?").bind(data.user.id, campaignId).first();
        expect(codeRow).not.toBeNull();
      });
    });

    describe("review_team role", () => {
      it("rejects unregistered phone for review_team", async () => {
        const res = await makeAppRequest("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: "09120000000",
            otp: "9911",
            role: "review_team",
          }),
        });
        expect(res.status).toBe(403);
      });

      it("succeeds for registered active review_team member", async () => {
        const reviewerId = "rev_member_1";
        await env.DB.prepare("INSERT INTO review_team_members (id, name, phone, active) VALUES (?, 'Reviewer 1', '09129991111', 1)").bind(reviewerId).run();

        const res = await makeAppRequest("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: "09129991111",
            otp: "9911",
            role: "review_team",
          }),
        });
        expect(res.status).toBe(200);
        const data = await res.json() as { ok: boolean; token: string; user: { id: string } };
        expect(data.user.id).toBe(reviewerId);
      });
    });

    describe("staff role", () => {
      it("rejects unregistered staff phone", async () => {
        const res = await makeAppRequest("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: "09123330000",
            otp: "3321",
            role: "staff",
          }),
        });
        expect(res.status).toBe(403);
      });

      it("succeeds for registered active staff and embeds businessId in JWT", async () => {
        const staffId = "staff_member_1";
        const ownerId = "owner_test_staff";
        const bizId = "biz_test_staff";

        const cat = await env.DB.prepare("SELECT id FROM business_categories LIMIT 1").first();
        await env.DB.prepare("INSERT INTO business_owners (id, phone, phone_verified) VALUES (?, ?, 1)").bind(ownerId, "09127770002").run();
        await env.DB.prepare("INSERT INTO businesses (id, owner_id, name, category_id) VALUES (?, ?, 'Staff Cafe', ?)").bind(bizId, ownerId, cat?.id).run();

        await env.DB.prepare("INSERT INTO staff (id, business_id, name, phone, active) VALUES (?, ?, 'Barista', '09123331111', 1)").bind(staffId, bizId).run();

        const res = await makeAppRequest("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: "09123331111",
            otp: "3321",
            role: "staff",
          }),
        });
        expect(res.status).toBe(200);
        const data = await res.json() as { ok: boolean; token: string; user: { id: string; businessId?: string } };
        expect(data.user.id).toBe(staffId);
        expect(data.user.businessId).toBe(bizId);

        const payload = await verifyJWT(data.token, TEST_JWT_SECRET);
        expect(payload?.role).toBe("staff");
        expect(payload?.businessId).toBe(bizId);
      });
    });
  });
});
