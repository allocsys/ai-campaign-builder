import { env } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
import { applyMigrations, generateTestToken, makeAppRequest } from "./helpers";

describe("Health & Public Microsite & Review Routes", () => {
  const adminUsername = "admin_root";
  let adminToken: string;

  beforeAll(async () => {
    await applyMigrations();

    // Create review admin
    await env.DB.prepare("INSERT INTO review_admins (id, username, password_hash, created_by) VALUES ('radmin_1', ?, 'hash123', 'root')").bind(adminUsername).run();
    adminToken = await generateTestToken({ sub: adminUsername, role: "review_admin", isRoot: true });
  });

  describe("GET /health", () => {
    it("returns health status", async () => {
      const res = await makeAppRequest("/health");
      expect(res.status).toBe(200);
      const body = await res.json() as { status: string; service: string };
      expect(body.status).toBe("ok");
      expect(body.service).toBe("ai-campaign-builder-backend");
    });
  });

  describe("GET /api/public/microsites/:slug", () => {
    it("returns 404 for non-existent microsite slug", async () => {
      const res = await makeAppRequest("/api/public/microsites/nonexistent-slug-xyz");
      expect(res.status).toBe(404);
    });

    it("returns published microsite content for existing slug", async () => {
      const ownerId = "pub_owner_1";
      const bizId = "pub_biz_1";
      const siteId = "pub_site_1";
      const slug = "my-test-cafe";

      const cat = await env.DB.prepare("SELECT id FROM business_categories LIMIT 1").first();
      await env.DB.prepare("INSERT INTO business_owners (id, phone, phone_verified) VALUES (?, '09127778888', 1)").bind(ownerId).run();
      await env.DB.prepare("INSERT INTO businesses (id, owner_id, name, category_id) VALUES (?, ?, 'Public Cafe', ?)").bind(bizId, ownerId, cat?.id).run();

      const tpl = await env.DB.prepare("SELECT id FROM website_templates LIMIT 1").first();
      await env.DB.prepare("INSERT INTO business_microsites (id, business_id, website_template_id, subdomain_slug, content, published) VALUES (?, ?, ?, ?, '{}', 1)").bind(siteId, bizId, tpl?.id, slug).run();

      const res = await makeAppRequest(`/api/public/microsites/${slug}`);
      expect(res.status).toBe(200);
      const body = await res.json() as { microsite: { subdomain_slug: string } };
      expect(body.microsite.subdomain_slug).toBe(slug);
    });
  });

  describe("Review Admin Routes (/api/review-admin)", () => {
    it("requires review_admin role", async () => {
      const res = await makeAppRequest("/api/review-admin/businesses");
      expect(res.status).toBe(401);
    });

    it("returns review admin businesses list", async () => {
      const res = await makeAppRequest("/api/review-admin/businesses", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as Array<{ id: string; name: string }>;
      expect(Array.isArray(body)).toBe(true);
    });
  });
});
