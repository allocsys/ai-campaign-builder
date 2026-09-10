import { Hono } from "hono";
import type { Env } from "../types";
import { queryFirst, queryAll } from "../lib/db";

// ============================================================================
// The ONLY unauthenticated router in this backend (everything else requires
// requireAuth -- see middleware/auth.ts). This exists specifically for
// apps/microsite, a public/multi-tenant SSR app with no owner/customer login
// of its own (see plan.md Phase 0.75 "Business microsite"). It is reached via
// a Cloudflare service binding from that Worker, not a public URL a browser
// would ever call directly (see apps/microsite/wrangler.toml's [[services]]
// entry) -- kept unauthenticated by design either way, since a microsite's
// whole purpose is to be publicly viewable without any login.
//
// Response shape mirrors apps/microsite/app/lib/mock-data.ts's MicrositeData
// type exactly (microsite/template/modules/featuredCampaign) so that file's
// getMicrositeData() can deserialize this response directly without any
// reshaping -- keeps the "mock swapped for a real fetch" seam clean.
// ============================================================================

const publicMicrositeRouter = new Hono<{ Bindings: Env }>();

publicMicrositeRouter.get("/microsites/:slug", async (c) => {
  const db = c.env.DB;
  const slug = c.req.param("slug");

  const microsite = await queryFirst<{
    id: string;
    business_id: string;
    website_template_id: string;
    subdomain_slug: string;
    content: string | null;
    featured_campaign_id: string | null;
    published: number;
    addon_status: string | null;
  }>(
    db,
    `SELECT id, business_id, website_template_id, subdomain_slug, content, featured_campaign_id, published, addon_status
     FROM business_microsites WHERE subdomain_slug = ?`,
    [slug]
  );
  // Unknown slug or an unpublished microsite -- caller (mock-data.ts's
  // getMicrositeData) treats both as "not found" and 404s, same as the old
  // mock implementation did.
  if (!microsite || !microsite.published) {
    return c.json({ error: "Microsite not found" }, 404);
  }

  const template = await queryFirst<{ id: string; name: string; theme_identifier: string }>(
    db,
    "SELECT id, name, theme_identifier FROM website_templates WHERE id = ?",
    [microsite.website_template_id]
  );
  if (!template) return c.json({ error: "Microsite template vanished mid-request" }, 500);

  const moduleRows = await queryAll<{
    id: string;
    website_module_id: string;
    module_key: string;
    enabled: number;
    display_order: number;
    content: string | null;
  }>(
    db,
    `SELECT bmm.id, bmm.website_module_id, wm.key AS module_key, bmm.enabled, bmm.display_order, bmm.content
     FROM business_microsite_modules bmm
     JOIN website_modules wm ON wm.id = bmm.website_module_id
     WHERE bmm.business_microsite_id = ? AND bmm.enabled = 1
     ORDER BY bmm.display_order ASC`,
    [microsite.id]
  );

  let featuredCampaign: { id: string; public_join_slug: string; goal: "acquisition" | "retention" } | null = null;
  if (microsite.featured_campaign_id) {
    const campaign = await queryFirst<{ id: string; public_join_slug: string | null; goal: string; status: string }>(
      db,
      "SELECT id, public_join_slug, goal, status FROM campaigns WHERE id = ?",
      [microsite.featured_campaign_id]
    );
    // Only surface it as "featured" if it's still active and actually has a
    // join slug -- a campaign that's ended or was never given a join slug
    // isn't something the microsite CTA should link to.
    if (campaign && campaign.status === "active" && campaign.public_join_slug) {
      featuredCampaign = {
        id: campaign.id,
        public_join_slug: campaign.public_join_slug,
        goal: campaign.goal as "acquisition" | "retention",
      };
    }
  }

  return c.json({
    microsite: {
      id: microsite.id,
      business_id: microsite.business_id,
      website_template_id: microsite.website_template_id,
      subdomain_slug: microsite.subdomain_slug,
      content: microsite.content ? JSON.parse(microsite.content) : { logo_url: null, business_name: "", tagline: "" },
      featured_campaign_id: microsite.featured_campaign_id,
      published: !!microsite.published,
      addon_status: microsite.addon_status,
    },
    template: {
      id: template.id,
      name: template.name,
      theme_identifier: template.theme_identifier,
    },
    modules: moduleRows.map((m) => ({
      id: m.id,
      business_microsite_id: microsite.id,
      website_module_id: m.website_module_id,
      module_key: m.module_key,
      enabled: !!m.enabled,
      display_order: m.display_order,
      content: m.content ? JSON.parse(m.content) : {},
    })),
    featuredCampaign,
  });
});

export { publicMicrositeRouter };
