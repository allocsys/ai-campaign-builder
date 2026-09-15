import { Hono } from "hono";
import type { D1Database } from "@cloudflare/workers-types";
import type { Env } from "../types";
import type { JWTPayload } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { generateId, queryAll, queryFirst, execute } from "../lib/db";
import { generateCampaignProposal } from "../lib/campaign-generator";
import { validateMicrositeSlug, MICROSITE_ADDON_MONTHLY_PRICE_TOMAN } from "@ai-campaign-builder/shared-config";
import { parseNaturalLanguageCampaignRequest } from "../lib/campaign-agent";
import { loadChatHistory, appendChatTurns } from "../lib/chat-history";

const businessRouter = new Hono<{ Bindings: Env; Variables: { auth: JWTPayload } }>();

function nowIso(): string {
  return new Date().toISOString();
}

// All routes below act on "my own business" -- the business id is always
// taken from the authenticated JWT subject (auth.sub), never from a request
// param, so a business owner can only ever read/write their own record.
businessRouter.use("/*", requireAuth);
businessRouter.use("/*", async (c, next) => {
  if (c.get("auth").role !== "business_owner") {
    return c.json({ error: "Forbidden: business_owner role required" }, 403);
  }
  await next();
});

// plan.md Item 23 (2026-09-15, "business_owners / businesses split"): the
// JWT's `sub` for a business_owner is now the OWNER's id (business_owners.id),
// not necessarily a businesses.id -- a brand-new owner who hasn't completed
// the wizard's first campaign yet has no businesses row at all. Rather than
// touch every one of this file's ~40 routes (all written against
// `c.get("auth").sub` as "my business id", the pre-split convention), this
// single middleware resolves the owner's current business (if any) and
// REMAPS `sub` to that businessId for the rest of the request -- every
// existing route below keeps working completely unchanged. The real
// ownerId is preserved under a new `ownerId` field for the few call sites
// that need it (currently just POST /campaigns' ensureBusinessForOwner,
// and loadProfile's owner-identity fields via a join). When no businesses
// row exists yet, `sub` simply stays the ownerId -- every other route's
// businessId-keyed queries then match nothing and fall through to their
// existing "not found"/zeroed-state responses (see loadProfile, GET
// /campaign, GET /stats, etc.), which is the correct, expected behavior for
// a brand-new owner who hasn't created a business yet -- not an error.
//
// This also replaces the old "business account deleted" existence check
// (bug found 2026-09-14: a review_admin-deleted business's JWT kept
// verifying fine, causing lazy-create handlers like ensureMicrosite to trip
// an opaque FK-violation 500). That check now looks at business_owners
// (deleting a business no longer implies deleting the owner account, now
// that they're separate entities -- see plan.md Item 23's follow-up note on
// review-admin.ts's deleteBusinessCompletely). A business_owners row is not
// currently deletable from anywhere in the app, so this 403 branch is
// defensive/future-proofing rather than reachable today.
businessRouter.use("/*", async (c, next) => {
  const auth = c.get("auth");
  // Perf fix (dashboard-perf branch): this used to be two sequential
  // round-trips (SELECT business_owners, then SELECT businesses) on EVERY
  // single /api/business/* request. A LEFT JOIN gets both answers -- does
  // the owner still exist, and if so what's their business id (if any) --
  // in one query. `business_id` is NULL both when the owner row itself
  // doesn't exist (row is null entirely) and when the owner exists but has
  // no business yet, so the ownerExists/business?.id distinction from the
  // old code is preserved via `row` (null => 403) vs `row.business_id`
  // (null => brand-new owner, same fallback as before).
  const row = await queryFirst<{ business_id: string | null }>(
    c.env.DB,
    `SELECT b.id AS business_id
     FROM business_owners bo
     LEFT JOIN businesses b ON b.owner_id = bo.id
     WHERE bo.id = ?`,
    [auth.sub]
  );
  if (!row) {
    return c.json({ error: "This account no longer exists.", code: "business_account_deleted" }, 403);
  }
  c.set("auth", { ...auth, ownerId: auth.sub, sub: row.business_id ?? auth.sub });
  await next();
});

// ============================================================================
// Profile
// ============================================================================

// plan.md decision (2026-09-15, "defer business provisioning"): LEFT JOIN,
// not JOIN -- `businesses.category_id` is now nullable (a brand-new business
// has no category until the wizard's first campaign creation sets one), so
// an inner JOIN here would silently 404 ("Business not found") a real,
// freshly-signed-up business just because it hasn't picked a category yet.
// plan.md Item 23: phone/sms-wallet fields now live on business_owners, not
// businesses -- INNER JOIN (not LEFT) is safe here since businesses.owner_id
// is NOT NULL, every businesses row has exactly one owner.
async function loadProfile(db: D1Database, businessId: string) {
  return queryFirst<{
    name: string;
    phone: string;
    size_tier: string | null;
    sms_wallet_balance_toman: number;
    sms_monthly_cap_toman: number | null;
    name_fa: string | null;
    address: string | null;
    manual_editor_enabled: number;
  }>(
    db,
    `SELECT b.name, bo.phone, b.size_tier, bo.sms_wallet_balance_toman, bo.sms_monthly_cap_toman, bc.name_fa, b.address, b.manual_editor_enabled
     FROM businesses b
     JOIN business_owners bo ON bo.id = b.owner_id
     LEFT JOIN business_categories bc ON bc.id = b.category_id
     WHERE b.id = ?`,
    [businessId]
  );
}

function serializeProfile(row: NonNullable<Awaited<ReturnType<typeof loadProfile>>>) {
  return {
    name: row.name,
    // null when the business hasn't picked a category yet (see loadProfile's
    // LEFT JOIN comment above) -- frontend must handle an empty/unset label.
    categoryLabel: row.name_fa ?? "",
    phone: row.phone,
    sizeTier: (row.size_tier ?? "small") as "micro" | "small" | "medium" | "large",
    smsWalletBalanceToman: row.sms_wallet_balance_toman,
    smsMonthlyCapToman: row.sms_monthly_cap_toman,
    address: row.address ?? "",
    // plan.md Item 16 Step E -- "حالت حرفه‌ای" (Professional Mode). Owner-settable
    // via PUT /profile below; also settable by review_admin on the owner's behalf
    // (see reviewAdminRouter's PATCH /businesses/:businessId/manual-editor).
    manualEditorEnabled: !!row.manual_editor_enabled,
  };
}

businessRouter.get("/profile", async (c) => {
  const db = c.env.DB;
  const row = await loadProfile(db, c.get("auth").sub);
  if (!row) return c.json({ error: "Business not found" }, 404);
  return c.json(serializeProfile(row));
});

businessRouter.put("/profile", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").sub;
  const body = await c.req.json<
    Partial<{
      name: string;
      categoryLabel: string;
      sizeTier: string;
      smsMonthlyCapToman: number | null;
      address: string;
      manualEditorEnabled: boolean;
    }>
  >();

  if (body.manualEditorEnabled !== undefined) {
    // Self-serve owner toggle for plan.md Item 16 Step E's "حالت حرفه‌ای"
    // (Professional Mode). No eligibility check here by design -- unlike
    // autopilot's manual-apply-count gate, this is a plain opt-in, not an
    // earned unlock; review_admin can also flip this on the owner's behalf
    // (see reviewAdminRouter's PATCH /businesses/:businessId/manual-editor).
    await execute(db, "UPDATE businesses SET manual_editor_enabled = ? WHERE id = ?", [
      body.manualEditorEnabled ? 1 : 0,
      businessId,
    ]);
  }
  if (body.name !== undefined) {
    const previous = await queryFirst<{ name: string }>(db, "SELECT name FROM businesses WHERE id = ?", [
      businessId,
    ]);
    await execute(db, "UPDATE businesses SET name = ? WHERE id = ?", [body.name, businessId]);
    if (previous) await syncMicrositeNameChange(db, businessId, previous.name, body.name);
  }
  if (body.address !== undefined) {
    await execute(db, "UPDATE businesses SET address = ? WHERE id = ?", [body.address, businessId]);
  }
  if (body.sizeTier !== undefined) {
    if (!["micro", "small", "medium", "large"].includes(body.sizeTier)) {
      return c.json({ error: "Invalid sizeTier" }, 400);
    }
    await execute(db, "UPDATE businesses SET size_tier = ? WHERE id = ?", [body.sizeTier, businessId]);
  }
  if (body.smsMonthlyCapToman !== undefined) {
    // plan.md Item 23: sms_monthly_cap_toman now lives on business_owners --
    // updated via businesses.owner_id rather than businesses.id directly.
    await execute(
      db,
      "UPDATE business_owners SET sms_monthly_cap_toman = ? WHERE id = (SELECT owner_id FROM businesses WHERE id = ?)",
      [body.smsMonthlyCapToman, businessId]
    );
  }
  if (body.categoryLabel !== undefined) {
    const cat = await queryFirst<{ id: string }>(db, "SELECT id FROM business_categories WHERE name_fa = ?", [
      body.categoryLabel,
    ]);
    if (!cat) return c.json({ error: "Unknown categoryLabel" }, 400);
    await execute(db, "UPDATE businesses SET category_id = ? WHERE id = ?", [cat.id, businessId]);
  }

  const row = await loadProfile(db, businessId);
  if (!row) return c.json({ error: "Business not found" }, 404);
  return c.json(serializeProfile(row));
});

// ============================================================================
// Onboarding checklist
// ============================================================================

businessRouter.get("/checklist", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").sub;
  const rows = await queryAll<{ item_key: string; label_fa: string; completed_at: string | null }>(
    db,
    `SELECT oci.item_key, oci.label_fa, bcp.completed_at
     FROM onboarding_checklist_items oci
     LEFT JOIN business_checklist_progress bcp
       ON bcp.item_key = oci.item_key AND bcp.business_id = ?
     WHERE oci.active = 1
     ORDER BY oci.sort_order ASC`,
    [businessId]
  );
  return c.json(
    rows.map((r) => ({
      key: r.item_key,
      label: r.label_fa,
      completed: r.completed_at !== null,
    }))
  );
});

// ============================================================================
// Campaign (plan.md Item 21 -- a business can now hold multiple campaigns;
// only one may be `status = 'active'` at a time, enforced in
// applyCampaignUpdate below). findCurrentCampaignId() is the LEGACY resolver
// for routes not yet converted to an explicit :campaignId (GET/PUT /campaign,
// POST /campaign/generate, GET /stats -- POST /campaign/chat was converted
// to an explicit campaignId, see that route's own comment below). It prefers
// the business's active campaign if one exists, else its most recently
// created campaign, instead of always the oldest -- a reasonable single
// "current" campaign to fall back to now that more than one may exist.
// Decided 2026-09-15: these legacy routes never auto-create a campaign --
// ensureCampaign() (the old create-on-write resolver) has been removed
// entirely. A business with no campaign gets a 404 from these routes; the
// only way to get a campaign row is the explicit createNewCampaign() below
// (POST /campaigns), never an implicit side effect of a write to /campaign.
// New :campaignId-scoped routes (GET/POST /campaigns, GET/PUT
// /campaigns/:campaignId, GET /campaigns/:campaignId/stats) are the real,
// non-legacy way to address a specific campaign and are what the frontend
// list/detail pages should move to.
// ============================================================================

// Short, URL-safe, unique slug for a campaign's public join link/QR
// (/join/:slug on apps/microsite). Collision-checked against the live table
// rather than assumed-unique, since it's a truncated random string, not a
// full UUID; 5 attempts before falling back to a full UUID is generous for
// an 8-char base16 space at this table's realistic size.
async function generateUniqueJoinSlug(db: D1Database): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    const clash = await queryFirst<{ id: string }>(db, "SELECT id FROM campaigns WHERE public_join_slug = ?", [slug]);
    if (!clash) return slug;
  }
  return crypto.randomUUID();
}

// Exported (plan.md Item 16 Step A) so reviewAdminRouter's businessId-route-param
// endpoints can resolve/reuse the same legacy "current campaign" fallback
// instead of duplicating it. See the section comment above for the
// active-first / newest-else resolution order (changed from oldest-first
// as part of plan.md Item 21).
async function resolveCurrentCampaignRow(db: D1Database, businessId: string): Promise<{ id: string } | null> {
  return queryFirst<{ id: string }>(
    db,
    "SELECT id FROM campaigns WHERE business_id = ? ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, created_at DESC, id DESC LIMIT 1",
    [businessId]
  );
}

// Resolves the business's current campaign (active-first/newest-else
// order) WITHOUT ever creating one -- this is now the ONLY resolver for
// the legacy single-campaign routes (ensureCampaign, the old create-on-write
// resolver, was removed 2026-09-15; see the section comment above). Root-
// cause fix for the 2026-09-14 phantom-campaign bug:
// GET-only endpoints (GET /campaign, GET /stats, and review-admin's
// businessId-scoped GET /campaign) do no writing, so simply loading a page
// must never have the side effect of inserting a real campaign row for a
// business that hasn't gone through the wizard yet. Returns null (never a
// fabricated row) when the business has no campaign -- each caller decides
// what "no campaign yet" means for its own response shape. Exported so
// review-admin.ts's GET /businesses/:businessId/campaign can reuse the same
// non-creating resolution.
export async function findCurrentCampaignId(db: D1Database, businessId: string): Promise<string | null> {
  const existing = await resolveCurrentCampaignRow(db, businessId);
  return existing?.id ?? null;
}

// plan.md Item 21 -- unconditionally creates a brand-new campaign row for a
// business (always `draft`, never reuses/overwrites an existing row), for
// the new "ایجاد کمپین" (create campaign) entry point on the campaign list
// page. Unlike the legacy resolver above, this never checks for an existing row first.
export async function createNewCampaign(db: D1Database, businessId: string): Promise<string> {
  const id = generateId();
  await execute(
    db,
    `INSERT INTO campaigns (id, business_id, goal, status, point_multiplier, created_at)
     VALUES (?, ?, 'acquisition', 'draft', 1, ?)`,
    [id, businessId, nowIso()]
  );
  return id;
}

// plan.md Item 21 -- verifies a campaignId actually belongs to this business
// before any :campaignId-scoped route touches it, same ownership-scoping
// principle as every other route in this file (see the top-of-file comment:
// business id always comes from the JWT, never trusted from the request).
// Returns null (caller returns 404) rather than throwing, since "not found"
// is an expected, routine case here (bad id, wrong business, typo'd url).
async function getCampaignOwnedByBusiness(
  db: D1Database,
  businessId: string,
  campaignId: string
): Promise<{ id: string } | null> {
  return queryFirst<{ id: string }>(db, "SELECT id FROM campaigns WHERE id = ? AND business_id = ?", [
    campaignId,
    businessId,
  ]);
}

// plan.md Item 21 -- summary row for the new campaign list page (GET
// /campaigns). Deliberately NOT the full serializeCampaign() shape (no
// tasks/rewards arrays) -- the list page only needs enough to render one row
// per campaign and route into the right detail page on click.
async function listCampaignsForBusiness(db: D1Database, businessId: string) {
  const rows = await queryAll<{
    id: string;
    status: string;
    goal: string;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
  }>(
    db,
    `SELECT id, status, goal, start_date, end_date, created_at
     FROM campaigns WHERE business_id = ?
     ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, created_at DESC`,
    [businessId]
  );
  return rows.map((r) => ({
    id: r.id,
    status: r.status as "active" | "draft" | "ended",
    goal: r.goal as "acquisition" | "retention" | "acquisition_retention",
    startDate: r.start_date ?? "",
    endDate: r.end_date ?? "",
    createdAt: r.created_at,
  }));
}

// Exported (plan.md Item 16 Step A) -- same reasoning as findCurrentCampaignId above.
export async function serializeCampaign(db: D1Database, campaignId: string) {
  const campaign = await queryFirst<{
    status: string;
    goal: string;
    point_multiplier: number;
    start_date: string | null;
    end_date: string | null;
  }>(db, "SELECT status, goal, point_multiplier, start_date, end_date FROM campaigns WHERE id = ?", [campaignId]);
  if (!campaign) throw new Error(`Campaign ${campaignId} vanished mid-request`);

  // Item 16 Step E: campaign_tasks.id/campaign_rewards.id have existed as real
  // primary keys since migration 0001 -- they just weren't selected/returned
  // here before, since no caller needed a stable per-row identifier until the
  // manual editor (granular add/remove/edit of individual tasks/rewards, not
  // just whole-array replacement) needed one.
  const tasks = await queryAll<{ id: string; name: string; pattern_name: string; points_value: number }>(
    db,
    `SELECT ct.id, ct.name, tp.name AS pattern_name, ct.points_value
     FROM campaign_tasks ct JOIN task_patterns tp ON tp.id = ct.task_pattern_id
     WHERE ct.campaign_id = ? ORDER BY ct.display_order ASC`,
    [campaignId]
  );

  const rewards = await queryAll<{ id: string; name: string; pattern_name: string; threshold_points: number }>(
    db,
    `SELECT cr.id, cr.name, rp.name AS pattern_name, cr.threshold_points
     FROM campaign_rewards cr JOIN reward_patterns rp ON rp.id = cr.reward_pattern_id
     WHERE cr.campaign_id = ? ORDER BY cr.threshold_points ASC`,
    [campaignId]
  );

  return {
    status: campaign.status as "active" | "draft" | "ended",
    goal: campaign.goal as "acquisition" | "retention" | "acquisition_retention",
    pointMultiplier: campaign.point_multiplier,
    startDate: campaign.start_date ?? "",
    endDate: campaign.end_date ?? "",
    tasks: tasks.map((t) => ({ id: t.id, name: t.name, pattern: t.pattern_name, points: t.points_value })),
    rewards: rewards.map((r) => ({ id: r.id, name: r.name, pattern: r.pattern_name, threshold: r.threshold_points })),
  };
}

businessRouter.get("/campaign", async (c) => {
  const db = c.env.DB;
  const campaignId = await findCurrentCampaignId(db, c.get("auth").sub);
  if (!campaignId) return c.json({ error: "No campaign found for this business" }, 404);
  return c.json(await serializeCampaign(db, campaignId));
});

// Body shape for PUT /campaign, shared by businessRouter (businessId = auth.sub)
// and reviewAdminRouter's businessId-route-param equivalent (plan.md Item 16 Step B).
export type CampaignUpdateBody = Partial<{
  status: string;
  goal: string;
  pointMultiplier: number;
  startDate: string;
  endDate: string;
  // `id` accepted but not required -- a manual-editor client round-trips the
  // ids it got from GET for existing rows and simply omits it for newly
  // added ones. On write, a submitted row whose `id` matches an existing
  // row is UPDATEd in place (so it keeps its id -- any task_submissions /
  // reward_redemptions referencing it stay valid); a row with no id (or an
  // id that doesn't match anything existing) is INSERTed fresh. An existing
  // row that's simply missing from the submitted array is deleted -- UNLESS
  // it has recorded customer activity, in which case the whole save is
  // rejected with a 409 instead (see the fuller note in
  // applyCampaignUpdate's tasks/rewards block for why: this used to be a
  // blind delete-and-reinsert of every row on every save, which crashed
  // with an uncaught 500 the moment any row had ever been referenced).
  tasks: { id?: string; name: string; pattern: string; points: number }[];
  rewards: { id?: string; name: string; pattern: string; threshold: number }[];
}>;

export type CampaignUpdateResult =
  | { ok: true; campaign: Awaited<ReturnType<typeof serializeCampaign>> }
  | { ok: false; status: 400 | 404 | 409; error: string };

// Extracted from the PUT /campaign route handler (plan.md Item 16 Step A) so
// reviewAdminRouter's businessId-route-param PUT endpoint (Step B) can reuse
// the EXACT same validation + side effects (join-slug generation, microsite
// featuring, highlight defaults on activate) as an owner edit -- an admin
// edit should behave identically to an owner edit, per the plan.md decision.
// Returns a discriminated result instead of a Response, since this function
// isn't bound to a Hono context and has two independent callers.
export async function applyCampaignUpdate(
  db: D1Database,
  businessId: string,
  body: CampaignUpdateBody,
  explicitCampaignId?: string
): Promise<CampaignUpdateResult> {
  // plan.md Item 21 -- the new :campaignId-scoped PUT /campaigns/:campaignId
  // route passes its campaignId explicitly; legacy callers (PUT /campaign,
  // reviewAdminRouter's businessId-only endpoint) fall back to
  // findCurrentCampaignId's single-"current"-campaign resolution.
  // Decided 2026-09-15: no more create-on-write here (ensureCampaign
  // removed) -- a legacy caller with no campaign yet gets a 404, forcing
  // an explicit createNewCampaign() (POST /campaigns) instead of silently
  // stubbing one into existence.
  const campaignId = explicitCampaignId ?? (await findCurrentCampaignId(db, businessId));
  if (!campaignId) {
    return { ok: false, status: 404, error: "No campaign found for this business" };
  }

  if (body.status !== undefined) {
    if (!["active", "draft", "ended"].includes(body.status)) {
      return { ok: false, status: 400, error: "Invalid status" };
    }

    // plan.md Item 21 -- only one campaign may be active per business at a
    // time (decided 2026-09-14, supersedes the same-day "simultaneous
    // active" draft of this item). Activating a second campaign while
    // another is still active is rejected rather than silently ending the
    // first one -- an owner must explicitly end the current campaign first.
    if (body.status === "active") {
      const otherActive = await queryFirst<{ id: string }>(
        db,
        "SELECT id FROM campaigns WHERE business_id = ? AND status = 'active' AND id != ?",
        [businessId, campaignId]
      );
      if (otherActive) {
        return {
          ok: false,
          status: 409,
          error: "کمپین دیگری از این کسب‌وکار در حال اجراست. ابتدا آن را پایان دهید.",
        };
      }
    }

    await execute(db, "UPDATE campaigns SET status = ? WHERE id = ?", [body.status, campaignId]);

    // Activating a campaign should make it reachable/advertised from the
    // business's microsite -- gap found 2026-09-12: launching a real campaign
    // through the wizard never gave it a public_join_slug, and the
    // microsite's featured_campaign_id was never wired to point at it (only
    // the old demo seed data (migration 0008) ever had both set). Without
    // this, a real launched campaign has no join link/QR and never appears
    // as the microsite's featured campaign.
    if (body.status === "active") {
      const current = await queryFirst<{ public_join_slug: string | null }>(
        db,
        "SELECT public_join_slug FROM campaigns WHERE id = ?",
        [campaignId]
      );
      if (!current?.public_join_slug) {
        const slug = await generateUniqueJoinSlug(db);
        await execute(db, "UPDATE campaigns SET public_join_slug = ? WHERE id = ?", [slug, campaignId]);
      }
      // The just-activated campaign becomes the one featured on the
      // microsite -- a business has only one "current" campaign at a time
      // (see findCurrentCampaignId's single-current-campaign resolution),
      // so this is always the right campaign to feature going forward.
      // plan.md decision (2026-09-15): non-creating lookup now -- a business
      // that never opted into a microsite (wizard's wantsSite checkbox left
      // unchecked) must not get one provisioned just from activating a
      // campaign. Featuring + highlight-defaults are simply skipped when
      // there's no microsite to feature the campaign on.
      const micrositeId = await getMicrositeId(db, businessId);
      if (micrositeId) {
        await execute(db, "UPDATE business_microsites SET featured_campaign_id = ?, updated_at = ? WHERE id = ?", [
          campaignId,
          nowIso(),
          micrositeId,
        ]);

        // Bug fix 2026-09-12: the campaign_highlight module's title/description/
        // cta_label were never populated anywhere -- see fillCampaignHighlightDefaults
        // for the full story. Only fills in still-empty fields, never overwrites
        // owner customization.
        const activatedCampaign = await queryFirst<{ goal: string }>(db, "SELECT goal FROM campaigns WHERE id = ?", [
          campaignId,
        ]);
        const businessRow = await queryFirst<{ name: string }>(db, "SELECT name FROM businesses WHERE id = ?", [
          businessId,
        ]);
        if (activatedCampaign && businessRow) {
          await fillCampaignHighlightDefaults(
            db,
            micrositeId,
            activatedCampaign.goal as "acquisition" | "retention" | "acquisition_retention",
            businessRow.name
          );
        }
      }
    }
  }
  if (body.goal !== undefined) {
    if (!["acquisition", "retention", "acquisition_retention"].includes(body.goal)) {
      return { ok: false, status: 400, error: "Invalid goal" };
    }
    await execute(db, "UPDATE campaigns SET goal = ? WHERE id = ?", [body.goal, campaignId]);
  }
  if (body.pointMultiplier !== undefined) {
    await execute(db, "UPDATE campaigns SET point_multiplier = ? WHERE id = ?", [body.pointMultiplier, campaignId]);
  }
  if (body.startDate !== undefined) {
    await execute(db, "UPDATE campaigns SET start_date = ? WHERE id = ?", [body.startDate, campaignId]);
  }
  if (body.endDate !== undefined) {
    await execute(db, "UPDATE campaigns SET end_date = ? WHERE id = ?", [body.endDate, campaignId]);
  }

  if (body.tasks !== undefined) {
    const patternRows = await queryAll<{ id: string; name: string }>(db, "SELECT id, name FROM task_patterns");
    const patternIdByName = new Map(patternRows.map((p) => [p.name, p.id]));

    // Validate every submitted pattern up front, before any mutation --
    // otherwise a bad pattern partway through the array would leave earlier
    // deletes/updates already applied with no way to roll them back (D1's
    // execute() calls here aren't wrapped in a transaction).
    const resolvedTaskPatternIds: string[] = [];
    for (const t of body.tasks) {
      const patternId = patternIdByName.get(t.pattern);
      if (!patternId) return { ok: false, status: 400, error: `Unknown task pattern: ${t.pattern}` };
      resolvedTaskPatternIds.push(patternId);
    }

    // Upsert-and-guarded-delete instead of the old blind delete-then-reinsert
    // of every row (found 2026-09-13: task_submissions.campaign_task_id
    // references campaign_tasks(id) with D1's foreign_keys pragma ON, so
    // deleting a task that had ever received a real submission threw an
    // uncaught FOREIGN KEY constraint error -- an unhandled 500 that
    // permanently blocked ALL future saves to that campaign, not just
    // deletion of the referenced task).
    const existingTasks = await queryAll<{ id: string }>(db, "SELECT id FROM campaign_tasks WHERE campaign_id = ?", [
      campaignId,
    ]);
    const existingTaskIds = new Set(existingTasks.map((t) => t.id));
    const submittedTaskIds = new Set(body.tasks.filter((t) => t.id).map((t) => t.id as string));

    // Rows removed from the submitted array. Only actually delete a row if
    // it has zero referencing task_submissions; otherwise block the whole
    // save with a clear error instead of letting the DELETE crash.
    const taskIdsToRemove = [...existingTaskIds].filter((id) => !submittedTaskIds.has(id));
    const blockedTaskNames: string[] = [];
    for (const id of taskIdsToRemove) {
      const referenced = await queryFirst<{ c: number }>(
        db,
        "SELECT COUNT(*) AS c FROM task_submissions WHERE campaign_task_id = ?",
        [id]
      );
      if (referenced && referenced.c > 0) {
        const row = await queryFirst<{ name: string }>(db, "SELECT name FROM campaign_tasks WHERE id = ?", [id]);
        blockedTaskNames.push(row?.name ?? id);
        continue;
      }
      await execute(db, "DELETE FROM campaign_tasks WHERE id = ?", [id]);
    }
    if (blockedTaskNames.length > 0) {
      return {
        ok: false,
        status: 409,
        error: `Cannot remove task(s) that already have recorded customer activity: ${blockedTaskNames.join(
          ", "
        )}. Edit them instead of deleting, or leave them in place.`,
      };
    }

    // Existing rows (matched by id) are updated in place -- keeps their id
    // stable across saves, so any task_submissions referencing them keep
    // pointing at a live, correctly-updated row. Rows with no id (or an id
    // that doesn't match anything existing, e.g. a stale id from a discarded
    // edit) are inserted fresh, same as before.
    for (let i = 0; i < body.tasks.length; i++) {
      const t = body.tasks[i];
      const patternId = resolvedTaskPatternIds[i];
      if (t.id && existingTaskIds.has(t.id)) {
        await execute(
          db,
          `UPDATE campaign_tasks SET task_pattern_id = ?, points_value = ?, display_order = ?, name = ? WHERE id = ?`,
          [patternId, t.points, i, t.name, t.id]
        );
      } else {
        await execute(
          db,
          `INSERT INTO campaign_tasks (id, campaign_id, task_pattern_id, points_value, display_order, name)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [generateId(), campaignId, patternId, t.points, i, t.name]
        );
      }
    }
  }

  if (body.rewards !== undefined) {
    // Resolves reward_pattern_id from the client-supplied `pattern` name,
    // same as campaign_tasks does for task_pattern_id above. Previously this
    // field didn't exist on the frontend shape and every reward was silently
    // linked to the first seeded reward pattern regardless of what the
    // owner actually picked -- see plan.md Open Items (CampaignReward
    // pattern-field gap, flagged in PR #27).
    const patternRows = await queryAll<{ id: string; name: string }>(db, "SELECT id, name FROM reward_patterns");
    const patternIdByName = new Map(patternRows.map((p) => [p.name, p.id]));

    // Same up-front validation as campaign_tasks above.
    const resolvedRewardPatternIds: string[] = [];
    for (const r of body.rewards) {
      const patternId = patternIdByName.get(r.pattern);
      if (!patternId) return { ok: false, status: 400, error: `Unknown reward pattern: ${r.pattern}` };
      resolvedRewardPatternIds.push(patternId);
    }

    // Same upsert-and-guarded-delete approach as campaign_tasks above --
    // reward_redemptions.campaign_reward_id references campaign_rewards(id)
    // with the same foreign_keys=ON constraint.
    const existingRewards = await queryAll<{ id: string }>(
      db,
      "SELECT id FROM campaign_rewards WHERE campaign_id = ?",
      [campaignId]
    );
    const existingRewardIds = new Set(existingRewards.map((r) => r.id));
    const submittedRewardIds = new Set(body.rewards.filter((r) => r.id).map((r) => r.id as string));

    const rewardIdsToRemove = [...existingRewardIds].filter((id) => !submittedRewardIds.has(id));
    const blockedRewardNames: string[] = [];
    for (const id of rewardIdsToRemove) {
      const referenced = await queryFirst<{ c: number }>(
        db,
        "SELECT COUNT(*) AS c FROM reward_redemptions WHERE campaign_reward_id = ?",
        [id]
      );
      if (referenced && referenced.c > 0) {
        const row = await queryFirst<{ name: string }>(db, "SELECT name FROM campaign_rewards WHERE id = ?", [id]);
        blockedRewardNames.push(row?.name ?? id);
        continue;
      }
      await execute(db, "DELETE FROM campaign_rewards WHERE id = ?", [id]);
    }
    if (blockedRewardNames.length > 0) {
      return {
        ok: false,
        status: 409,
        error: `Cannot remove reward(s) that already have recorded customer redemptions: ${blockedRewardNames.join(
          ", "
        )}. Edit them instead of deleting, or leave them in place.`,
      };
    }

    for (let i = 0; i < body.rewards.length; i++) {
      const r = body.rewards[i];
      const patternId = resolvedRewardPatternIds[i];
      if (r.id && existingRewardIds.has(r.id)) {
        await execute(
          db,
          `UPDATE campaign_rewards SET reward_pattern_id = ?, threshold_points = ?, name = ? WHERE id = ?`,
          [patternId, r.threshold, r.name, r.id]
        );
      } else {
        await execute(
          db,
          `INSERT INTO campaign_rewards (id, campaign_id, reward_pattern_id, threshold_points, name)
           VALUES (?, ?, ?, ?, ?)`,
          [generateId(), campaignId, patternId, r.threshold, r.name]
        );
      }
    }
  }

  return { ok: true, campaign: await serializeCampaign(db, campaignId) };
}

// Decided 2026-09-15: the legacy write-side single-campaign route (PUT
// /campaign) was removed -- it had no remaining caller once CampaignWizardForm's
// mode='legacy' branch was retired (the only frontend flow that ever hit this
// without first loading an existing campaign). The equivalent explicit-id
// route, PUT /campaigns/:campaignId, is the only owner-facing campaign write
// path now (plus review-admin's businessId-scoped PUT below, which still
// legitimately needs applyCampaignUpdate's implicit-campaignId resolution
// since admin has no :campaignId concept of its own).

export type DeleteCampaignResult =
  | { ok: true; deletedCampaignId: string }
  | { ok: false; status: 404; error: string };

// ----------------------------------------------------------------------------
// Hard delete of a business's current campaign (review_admin only -- no
// business_owner-facing route calls this; see reviewAdminRouter's DELETE
// /businesses/:businessId/campaign). This is a genuine, irreversible cascade
// delete: every row in the DB that references this campaign (directly or
// transitively through customer_campaign_codes/task_submissions/
// reward_redemptions) is removed too -- deliberately NOT the same
// referenced-rows-block-the-save guard that applyCampaignUpdate's
// tasks/rewards block uses. D1 runs with foreign_keys=ON, so deletes below
// are ordered children-before-parents to avoid FK violations; nothing here
// is wrapped in a D1 transaction (same as applyCampaignUpdate -- see its own
// comment on why), so a mid-sequence failure could in principle leave a
// partially-deleted campaign. Two edge cases get special handling rather
// than an outright block, per the "hard-delete everything" decision:
//   - points_ledger rows crediting a *different* campaign's customer from a
//     point_carryovers row sourced in this campaign are deleted too (the
//     carryover's origin is gone, so the credit's provenance is gone with it).
//   - point_carryovers rows *sourced in another still-live campaign* but
//     *consumed into* this one only get their consumed_in_campaign_id
//     cleared, not deleted -- that carryover's source campaign is untouched
//     and its row still has a reason to exist.
// After this runs, the next GET /campaign (owner or admin) 404s -- same as
// a business that never had a campaign at all -- since these legacy routes
// no longer auto-provision a draft (ensureCampaign was removed 2026-09-15).
// A new campaign only ever comes from an explicit createNewCampaign() call
// (POST /campaigns) or POST /campaign/generate.
export async function deleteCampaignForBusiness(db: D1Database, businessId: string): Promise<DeleteCampaignResult> {
  const current = await queryFirst<{ id: string }>(
    db,
    "SELECT id FROM campaigns WHERE business_id = ? ORDER BY created_at DESC LIMIT 1",
    [businessId]
  );
  if (!current) return { ok: false, status: 404, error: "No campaign found for this business" };
  const campaignId = current.id;

  const codes = await queryAll<{ id: string }>(db, "SELECT id FROM customer_campaign_codes WHERE campaign_id = ?", [
    campaignId,
  ]);
  const codeIds = codes.map((r) => r.id);

  let submissionIds: string[] = [];
  if (codeIds.length > 0) {
    const placeholders = codeIds.map(() => "?").join(",");
    const subs = await queryAll<{ id: string }>(
      db,
      `SELECT id FROM task_submissions WHERE customer_campaign_code_id IN (${placeholders})`,
      codeIds
    );
    submissionIds = subs.map((r) => r.id);
  }

  // task_submissions.qualifying_purchase_id <-> purchase_logs.task_submission_id
  // is a forward-reference cycle (see migration 0001's comment) -- null the
  // former before deleting purchase_logs, so neither delete violates the FK
  // the other side still holds.
  if (submissionIds.length > 0) {
    const placeholders = submissionIds.map(() => "?").join(",");
    await execute(db, `UPDATE task_submissions SET qualifying_purchase_id = NULL WHERE id IN (${placeholders})`, submissionIds);
    await execute(db, `DELETE FROM purchase_logs WHERE task_submission_id IN (${placeholders})`, submissionIds);
  }

  // points_ledger.customer_campaign_code_id is NOT NULL, so every ledger row
  // tied to this campaign's codes (whether via a task_submission or a
  // reward_redemption) is covered by this one delete.
  if (codeIds.length > 0) {
    const placeholders = codeIds.map(() => "?").join(",");
    await execute(db, `DELETE FROM points_ledger WHERE customer_campaign_code_id IN (${placeholders})`, codeIds);
  }
  // Cross-campaign edge case: a ledger entry on a DIFFERENT campaign's code
  // can credit points via a point_carryovers row sourced in this campaign --
  // must go before the point_carryovers delete below, or that delete would
  // violate points_ledger.point_carryover_id's FK.
  await execute(
    db,
    "DELETE FROM points_ledger WHERE point_carryover_id IN (SELECT id FROM point_carryovers WHERE source_campaign_id = ?)",
    [campaignId]
  );

  if (codeIds.length > 0) {
    const placeholders = codeIds.map(() => "?").join(",");
    await execute(db, `DELETE FROM reward_redemptions WHERE customer_campaign_code_id IN (${placeholders})`, codeIds);
  }

  if (submissionIds.length > 0) {
    const placeholders = submissionIds.map(() => "?").join(",");
    await execute(db, `DELETE FROM task_submissions WHERE id IN (${placeholders})`, submissionIds);
  }

  if (codeIds.length > 0) {
    const placeholders = codeIds.map(() => "?").join(",");
    await execute(db, `DELETE FROM referral_flags WHERE referrer_customer_campaign_code_id IN (${placeholders})`, codeIds);
    // Self-referential FK (a code can be another code's referrer) -- clear
    // before deleting the codes themselves.
    await execute(
      db,
      `UPDATE customer_campaign_codes SET referred_by_code_id = NULL WHERE referred_by_code_id IN (${placeholders})`,
      codeIds
    );
    await execute(db, `DELETE FROM notifications_log WHERE customer_campaign_code_id IN (${placeholders})`, codeIds);
  }
  await execute(db, "DELETE FROM notifications_log WHERE campaign_id = ?", [campaignId]);

  await execute(db, "DELETE FROM customer_campaign_codes WHERE campaign_id = ?", [campaignId]);

  // Carryovers sourced in this campaign are fully removed (any ledger rows
  // referencing them were already cleared above); carryovers merely consumed
  // into this campaign but sourced elsewhere keep their row, just lose the
  // now-dangling reference.
  await execute(db, "DELETE FROM point_carryovers WHERE source_campaign_id = ?", [campaignId]);
  await execute(db, "UPDATE point_carryovers SET consumed_in_campaign_id = NULL WHERE consumed_in_campaign_id = ?", [
    campaignId,
  ]);

  await execute(db, "DELETE FROM suggested_changes WHERE campaign_id = ?", [campaignId]);
  await execute(db, "DELETE FROM insights WHERE campaign_id = ?", [campaignId]);

  await execute(db, "UPDATE business_microsites SET featured_campaign_id = NULL WHERE featured_campaign_id = ?", [
    campaignId,
  ]);

  await execute(db, "DELETE FROM campaign_tasks WHERE campaign_id = ?", [campaignId]);
  await execute(db, "DELETE FROM campaign_rewards WHERE campaign_id = ?", [campaignId]);

  await execute(db, "DELETE FROM campaigns WHERE id = ?", [campaignId]);

  return { ok: true, deletedCampaignId: campaignId };
}

// ============================================================================
// Campaign generation (onboarding wizard, plan.md Open Item 8). Takes the
// wizard's 5 steps of answers, resolves the business's real name/category
// (fixing routes/auth.ts's placeholder-name/arbitrary-category auto-create
// gap), deterministically computes size tier + weighted tasks + reward
// thresholds via lib/campaign-generator.ts, and persists the result onto
// the given campaign (always a freshly-created row, see the required
// campaignId param below) as a fresh draft -- mirroring applyCampaignUpdate's
// own replace-tasks/replace-rewards logic so both stay consistent. A
// separate PUT /campaigns/:campaignId { status: 'active' } call (the
// wizard's existing "Launch" action) is what actually activates it.
// ============================================================================

// Body shape shared by POST /campaigns (create-new-campaign flow, businessId
// = auth.sub) and reviewAdminRouter's businessId-route-param equivalent
// (plan.md Item 16 Step B). The legacy POST /campaign/generate route this
// body originally described was removed 2026-09-15 (dead code -- no live
// caller once ensureCampaign's auto-create-on-write behavior went away).
export type CampaignGenerateBody = Partial<{
  businessName: string;
  businessAddress: string;
  categorySlug: string;
  goal: string;
  audienceDescription: string;
  dailyCustomerCount: number;
  monthlyRevenueToman: number;
  /**
   * plan.md Item 21 Step C -- the wizard's actual range-slider selection
   * (not just the average above, which is what feeds the deterministic
   * size-tier math). Optional/additive: an older client that only sends
   * dailyCustomerCount/monthlyRevenueToman still works exactly as before,
   * it just leaves these 4 columns NULL on the resulting campaign row, so
   * a future wizard visit has nothing to pre-fill from this campaign (same
   * as any campaign created before migration 0015).
   */
  dailyCustomerCountMin: number;
  dailyCustomerCountMax: number;
  monthlyRevenueTomanMin: number;
  monthlyRevenueTomanMax: number;
  /** Optional -- omitted/null when the owner has no Instagram page. */
  followerCount: number | null;
  /** Optional (plan.md "Step 4 leads with AI deciding" decision) -- only ever feeds LLM copy, never the deterministic math, so it's not required. */
  offerDescription: string;
  rewardPatternNames: string[];
  /**
   * plan.md Open Item 18 -- the wizard's new opt-in checkbox. Defaults to
   * false (not true) when omitted, since an older/not-yet-updated client
   * sending this body without the field should NOT silently start
   * receiving unrequested site-address suggestions.
   */
  wantsSite: boolean;
}>;

export type CampaignGenerateResult =
  | {
      ok: true;
      result: Awaited<ReturnType<typeof serializeCampaign>> & {
        sizeTier: Awaited<ReturnType<typeof generateCampaignProposal>>["sizeTier"];
        proposalTitle: Awaited<ReturnType<typeof generateCampaignProposal>>["proposalTitle"];
        proposalNarrative: Awaited<ReturnType<typeof generateCampaignProposal>>["proposalNarrative"];
        challenge: Awaited<ReturnType<typeof generateCampaignProposal>>["challenge"];
        discountClamped: Awaited<ReturnType<typeof generateCampaignProposal>>["discountClamped"];
        copyGeneratedByAi: Awaited<ReturnType<typeof generateCampaignProposal>>["copyGeneratedByAi"];
        /**
         * plan.md Open Item 18 -- fully resolved/validated/uniqueness-checked
         * candidate slug, ready to hand straight to PUT /microsite as-is.
         * Absent when wantsSite was false, the microsite's slug is already
         * owner-set (nothing left to suggest), the LLM didn't return one, or
         * every collision-retry attempt still collided.
         */
        suggestedSiteSlug?: string;
      };
    }
  | { ok: false; status: 400 | 409; error: string };

// plan.md Open Item 18: turns the LLM's raw (Latin, hopefully DNS-safe-ish)
// suggestion into something that's actually safe to hand the frontend as a
// ready-to-save default -- reusing the exact same rules PUT /microsite
// already enforces, rather than a parallel rule set that could drift.
// Returns null (never throws) on any failure path -- a missing suggestion is
// not an error, it just means the wizard shows no site-address step.
async function resolveSuggestedMicrositeSlug(
  db: D1Database,
  micrositeId: string,
  rawSlug: string | undefined
): Promise<string | null> {
  if (!rawSlug) return null;

  const current = await queryFirst<{ subdomain_slug_set_by_owner: number }>(
    db,
    "SELECT subdomain_slug_set_by_owner FROM business_microsites WHERE id = ?",
    [micrositeId]
  );
  // Already made their one-time choice (Item 17) -- nothing to suggest.
  if (current?.subdomain_slug_set_by_owner) return null;

  // Slugify: lowercase, transliterate spaces to hyphens, strip anything not
  // DNS-label-safe, collapse repeat hyphens, trim leading/trailing hyphens.
  const base = rawSlug
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!base) return null;

  // Same 5-attempt numbered-suffix retry shape as generateUniqueJoinSlug
  // above, reusing validateMicrositeSlug + PUT /microsite's own uniqueness
  // query rather than inventing new rules.
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    if (validateMicrositeSlug(candidate)) continue; // shape/reserved-word failure -- try next suffix, still worth a shot since length/charset already passed
    const clash = await queryFirst<{ id: string }>(
      db,
      "SELECT id FROM business_microsites WHERE subdomain_slug = ? AND id != ?",
      [candidate, micrositeId]
    );
    if (!clash) return candidate;
  }
  return null;
}

// Extracted from the POST /campaign/generate route handler (plan.md Item 16
// Step A) so reviewAdminRouter's businessId-route-param equivalent (Step B)
// can run the exact same wizard-generation flow the owner's own endpoint
// does. Takes `env` explicitly (rather than reading c.env) since this isn't
// bound to a Hono context and has two independent callers. Returns a
// discriminated result instead of a Response, same pattern as
// applyCampaignUpdate above.
export async function generateCampaignForBusiness(
  db: D1Database,
  env: Env,
  businessId: string,
  body: CampaignGenerateBody,
  campaignId: string
): Promise<CampaignGenerateResult> {
  if (!body.businessName?.trim() || !body.categorySlug || !body.goal || !body.rewardPatternNames?.length) {
    return {
      ok: false,
      status: 400,
      error: "Missing required fields: businessName, categorySlug, goal, rewardPatternNames (at least one)",
    };
  }
  if (!["acquisition", "retention", "acquisition_retention"].includes(body.goal)) {
    return { ok: false, status: 400, error: "Invalid goal" };
  }

  const category = await queryFirst<{ id: string; name_fa: string }>(
    db,
    "SELECT id, name_fa FROM business_categories WHERE slug = ?",
    [body.categorySlug]
  );
  if (!category) return { ok: false, status: 400, error: `Unknown categorySlug: ${body.categorySlug}` };

  // Multi-select reward types: validate every selected name up front and
  // build a name->id map, since each generated reward tier can now carry a
  // different pattern (previously every reward row shared one rewardPattern.id).
  const rewardPatternRows = await queryAll<{ id: string; name: string }>(db, "SELECT id, name FROM reward_patterns");
  const rewardPatternIdByName = new Map(rewardPatternRows.map((p) => [p.name, p.id]));
  for (const name of body.rewardPatternNames) {
    if (!rewardPatternIdByName.has(name)) {
      return { ok: false, status: 400, error: `Unknown rewardPatternName: ${name}` };
    }
  }

  // Single-active-campaign guard (plan.md decision): generation must not
  // silently clobber a live campaign's tasks/rewards/dates out from under
  // active customers. campaignId is a required param, always a freshly-
  // created row from createNewCampaign -- the legacy POST /campaign/generate
  // route (and review-admin's equivalent), which used to resolve it
  // implicitly via findCurrentCampaignId, were removed 2026-09-15 as dead
  // code once ensureCampaign's auto-create-on-write behavior went away
  // (neither had a live UI caller left -- see the file's earlier decision
  // note).
  const currentStatus = await queryFirst<{ status: string }>(db, "SELECT status FROM campaigns WHERE id = ?", [
    campaignId,
  ]);
  if (currentStatus?.status === "active") {
    return {
      ok: false,
      status: 409,
      error: "کمپین فعلی این کسب‌وکار در حال اجراست. برای ساخت کمپین جدید، ابتدا کمپین فعلی را پایان دهید.",
    };
  }

  // Step 1 addition (plan.md decision): write the wizard's business name +
  // category back to `businesses` directly -- fixes routes/auth.ts's
  // hardcoded placeholder name / arbitrary first-row category from first
  // OTP login, since the wizard is realistically the first real screen a
  // new owner meaningfully interacts with.
  const previousBusiness = await queryFirst<{ name: string }>(db, "SELECT name FROM businesses WHERE id = ?", [
    businessId,
  ]);
  await execute(db, "UPDATE businesses SET name = ?, category_id = ? WHERE id = ?", [
    body.businessName.trim(),
    category.id,
    businessId,
  ]);
  if (previousBusiness) {
    await syncMicrositeNameChange(db, businessId, previousBusiness.name, body.businessName.trim());
  }
  // Address (plan.md Open Item 9): optional here too -- an owner who already
  // set it via Settings shouldn't be forced to re-type it in the wizard, so
  // an empty/omitted value leaves the existing column untouched.
  if (body.businessAddress?.trim()) {
    await execute(db, "UPDATE businesses SET address = ? WHERE id = ?", [body.businessAddress.trim(), businessId]);
  }

  // AI constraints interaction (plan.md decision): clamp percentage_discount
  // rewards to the owner's saved max_discount_percent, if already set via
  // Settings. Unset (the common case for a brand-new business) -> unclamped
  // defaults.
  const constraints = await queryFirst<{ max_discount_percent: number | null }>(
    db,
    "SELECT max_discount_percent FROM business_ai_constraints WHERE business_id = ?",
    [businessId]
  );

  const proposal = await generateCampaignProposal(db, env, {
    categoryId: category.id,
    categorySlug: body.categorySlug,
    categoryNameFa: category.name_fa,
    businessName: body.businessName.trim(),
    goal: body.goal as "acquisition" | "retention" | "acquisition_retention",
    audienceDescription: body.audienceDescription?.trim() ?? "",
    offerDescription: body.offerDescription?.trim() ?? "",
    followerCount: body.followerCount != null ? Number(body.followerCount) || 0 : null,
    dailyCustomerCount: Number(body.dailyCustomerCount) || 0,
    monthlyRevenueToman: Number(body.monthlyRevenueToman) || 0,
    rewardPatternNames: body.rewardPatternNames,
    maxDiscountPercent: constraints?.max_discount_percent ?? null,
    wantsSuggestedSiteSlug: !!body.wantsSite,
  });

  // plan.md decision (2026-09-15): microsite creation is no longer lazy --
  // it happens exactly once, explicitly, right here, only when the wizard's
  // site checkbox (wantsSite) was checked. See ensureMicrosite's own comment
  // below for why GET/PUT /microsite no longer auto-provision on access.
  const suggestedSiteSlug = body.wantsSite
    ? await resolveSuggestedMicrositeSlug(db, await ensureMicrosite(db, businessId), proposal.suggestedSiteSlug)
    : null;

  const nowMs = Date.now();
  const startDate = new Date(nowMs).toISOString();
  const endDate = new Date(nowMs + proposal.durationDays * 24 * 60 * 60 * 1000).toISOString();

  // Always resets to 'draft' regardless of whether the prior campaign was
  // 'draft' or 'ended' -- generation always produces a fresh proposal cycle;
  // 'active' was already rejected above with a 409.
  // plan.md Item 21 Step C -- persist the wizard's raw size-signal range
  // (not just the average that fed generateCampaignProposal above) so a
  // future campaign for this business can pre-fill Step 3 from it via GET
  // /campaigns/latest-signals below. All 5 default to null when the client
  // didn't send them (older client, or the min/max fields simply omitted),
  // matching migration 0015's nullable columns -- never a required field.
  await execute(
    db,
    `UPDATE campaigns
     SET status = 'draft', goal = ?, point_multiplier = ?, start_date = ?, end_date = ?,
         audience_description = ?, offer_description = ?,
         daily_customer_count_min = ?, daily_customer_count_max = ?,
         monthly_revenue_toman_min = ?, monthly_revenue_toman_max = ?, follower_count = ?
     WHERE id = ?`,
    [
      body.goal,
      proposal.sizeTier.pointMultiplier,
      startDate,
      endDate,
      body.audienceDescription?.trim() ?? "",
      body.offerDescription?.trim() ?? "",
      body.dailyCustomerCountMin ?? null,
      body.dailyCustomerCountMax ?? null,
      body.monthlyRevenueTomanMin ?? null,
      body.monthlyRevenueTomanMax ?? null,
      body.followerCount ?? null,
      campaignId,
    ]
  );

  const taskPatternRows = await queryAll<{ id: string; name: string }>(db, "SELECT id, name FROM task_patterns");
  const taskPatternIdByName = new Map(taskPatternRows.map((p) => [p.name, p.id]));
  await execute(db, "DELETE FROM campaign_tasks WHERE campaign_id = ?", [campaignId]);
  for (let i = 0; i < proposal.tasks.length; i++) {
    const t = proposal.tasks[i];
    const patternId = taskPatternIdByName.get(t.patternName);
    if (!patternId) continue; // shouldn't happen -- generator only returns patterns that exist in task_patterns
    await execute(
      db,
      `INSERT INTO campaign_tasks (id, campaign_id, task_pattern_id, points_value, display_order, name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [generateId(), campaignId, patternId, t.points, i, t.name]
    );
  }

  await execute(db, "DELETE FROM campaign_rewards WHERE campaign_id = ?", [campaignId]);
  for (const r of proposal.rewards) {
    const patternId = rewardPatternIdByName.get(r.patternName);
    if (!patternId) continue; // shouldn't happen -- generator only returns patterns from the validated list above
    await execute(
      db,
      `INSERT INTO campaign_rewards (id, campaign_id, reward_pattern_id, threshold_points, name, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [generateId(), campaignId, patternId, r.threshold, r.name, r.description]
    );
  }

  const serialized = await serializeCampaign(db, campaignId);
  return {
    ok: true,
    result: {
      ...serialized,
      sizeTier: proposal.sizeTier,
      proposalTitle: proposal.proposalTitle,
      proposalNarrative: proposal.proposalNarrative,
      challenge: proposal.challenge,
      discountClamped: proposal.discountClamped,
      copyGeneratedByAi: proposal.copyGeneratedByAi,
      ...(suggestedSiteSlug ? { suggestedSiteSlug } : {}),
    },
  };
}

// ============================================================================
// Campaign list + :campaignId-scoped routes (plan.md Item 21). GET /campaign
// remains in place above for the dashboard's own single-"current"-campaign
// summary view (see findCurrentCampaignId's comment for its active-first/
// newest-else fallback order); its write-side siblings (PUT /campaign, POST
// /campaign/generate) were removed 2026-09-15 as dead code -- see the
// decision note above applyCampaignUpdate/generateCampaignForBusiness. These
// :campaignId-scoped routes are the only way to write a campaign now, aside
// from review-admin's businessId-scoped PUT (kept -- admin has no
// :campaignId concept of its own).
// ============================================================================

businessRouter.get("/campaigns", async (c) => {
  const db = c.env.DB;
  const rows = await listCampaignsForBusiness(db, c.get("auth").sub);
  return c.json(rows);
});

// Creates a brand-new campaign row and immediately generates its
// tasks/rewards/copy from the wizard body, for the campaign list page's
// "ایجاد کمپین" entry point -- this is now the only way to generate a
// campaign's tasks/rewards/copy (the legacy POST /campaign/generate, which
// generated into whatever campaign findCurrentCampaignId resolved to, was
// removed 2026-09-15), so unlike that route this never reuses/overwrites an
// existing campaign.
// plan.md Item 23 (2026-09-15): the businesses row (business PROFILE -- name,
// category) is created here, lazily, the first time an owner creates a
// campaign -- never at signup. If a businesses row already exists for this
// owner (auth.sub was already remapped to it by the router-wide middleware
// above), reuse it as-is; a 2nd/3rd campaign doesn't create a new business.
// Only a brand-new owner (auth.sub still equals their ownerId, i.e. no
// business exists yet) needs businessName/categorySlug validated here --
// generateCampaignForBusiness's own validation still runs afterward for the
// full body (goal, rewardPatternNames, etc.), this only covers the two
// fields a businesses row itself needs to exist at all.
async function ensureBusinessForOwner(
  db: D1Database,
  ownerId: string,
  existingBusinessId: string | undefined,
  businessName: string | undefined,
  categorySlug: string | undefined
): Promise<{ ok: true; businessId: string } | { ok: false; status: 400; error: string }> {
  if (existingBusinessId) return { ok: true, businessId: existingBusinessId };

  if (!businessName?.trim() || !categorySlug) {
    return { ok: false, status: 400, error: "Missing required fields: businessName, categorySlug" };
  }
  const category = await queryFirst<{ id: string }>(db, "SELECT id FROM business_categories WHERE slug = ?", [
    categorySlug,
  ]);
  if (!category) return { ok: false, status: 400, error: `Unknown categorySlug: ${categorySlug}` };

  const id = generateId();
  await execute(
    db,
    `INSERT INTO businesses (id, owner_id, name, category_id, autopilot_enabled, size_tier, created_at)
     VALUES (?, ?, ?, ?, 0, 'small', ?)`,
    [id, ownerId, businessName.trim(), category.id, nowIso()]
  );
  return { ok: true, businessId: id };
}

businessRouter.post("/campaigns", async (c) => {
  const db = c.env.DB;
  const auth = c.get("auth") as JWTPayload & { ownerId?: string };
  const body = await c.req.json<CampaignGenerateBody>();

  // auth.sub was already remapped by the router-wide middleware: it's the
  // resolved businessId if one exists, or still the raw ownerId if not (see
  // that middleware's comment). ensureBusinessForOwner tells the two apart
  // by checking whether a businesses row exists for auth.ownerId, not by
  // guessing from the shape of auth.sub.
  const existing = await queryFirst<{ id: string }>(db, "SELECT id FROM businesses WHERE owner_id = ?", [
    auth.ownerId ?? auth.sub,
  ]);
  const ensured = await ensureBusinessForOwner(
    db,
    auth.ownerId ?? auth.sub,
    existing?.id,
    body.businessName,
    body.categorySlug
  );
  if (!ensured.ok) return c.json({ error: ensured.error }, ensured.status);
  const businessId = ensured.businessId;

  const campaignId = await createNewCampaign(db, businessId);
  const result = await generateCampaignForBusiness(db, c.env, businessId, body, campaignId);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json({ campaignId, ...result.result }, 201);
});

// plan.md Item 21 Step C -- lets the wizard pre-fill Step 3's size-signal
// inputs (daily-customer-count range, monthly-revenue range, follower count)
// from the business's most-recently-created campaign, editable in place, per
// this item's "wizard business-size signals ... pre-filled ... when starting
// a new one" decision. Registered BEFORE the /campaigns/:campaignId route
// below since Hono matches routes in registration order -- a static
// "latest-signals" segment would otherwise be swallowed by the :campaignId
// param route.
async function getLatestCampaignSizeSignals(db: D1Database, businessId: string) {
  const row = await queryFirst<{
    daily_customer_count_min: number | null;
    daily_customer_count_max: number | null;
    monthly_revenue_toman_min: number | null;
    monthly_revenue_toman_max: number | null;
    follower_count: number | null;
  }>(
    db,
    `SELECT daily_customer_count_min, daily_customer_count_max,
            monthly_revenue_toman_min, monthly_revenue_toman_max, follower_count
     FROM campaigns WHERE business_id = ?
     ORDER BY created_at DESC, id DESC LIMIT 1`,
    [businessId]
  );
  // No campaign yet (brand-new business), or the most recent campaign predates
  // migration 0015 / never had any signal recorded -- nothing to pre-fill
  // from either way, same as a business's very first-ever campaign. The
  // wizard falls back to its own hardcoded defaults in both cases.
  if (
    !row ||
    (row.daily_customer_count_min === null &&
      row.daily_customer_count_max === null &&
      row.monthly_revenue_toman_min === null &&
      row.monthly_revenue_toman_max === null &&
      row.follower_count === null)
  ) {
    return null;
  }
  return {
    dailyCustomerCountMin: row.daily_customer_count_min,
    dailyCustomerCountMax: row.daily_customer_count_max,
    monthlyRevenueTomanMin: row.monthly_revenue_toman_min,
    monthlyRevenueTomanMax: row.monthly_revenue_toman_max,
    followerCount: row.follower_count,
  };
}

businessRouter.get("/campaigns/latest-signals", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").sub;
  const signals = await getLatestCampaignSizeSignals(db, businessId);
  return c.json(signals);
});

businessRouter.get("/campaigns/:campaignId", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").sub;
  const campaignId = c.req.param("campaignId");
  const owned = await getCampaignOwnedByBusiness(db, businessId, campaignId);
  if (!owned) return c.json({ error: "Campaign not found" }, 404);
  return c.json(await serializeCampaign(db, campaignId));
});

businessRouter.put("/campaigns/:campaignId", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").sub;
  const campaignId = c.req.param("campaignId");
  const owned = await getCampaignOwnedByBusiness(db, businessId, campaignId);
  if (!owned) return c.json({ error: "Campaign not found" }, 404);
  const body = await c.req.json<CampaignUpdateBody>();
  const result = await applyCampaignUpdate(db, businessId, body, campaignId);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json(result.campaign);
});

businessRouter.get("/campaigns/:campaignId/stats", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").sub;
  const campaignId = c.req.param("campaignId");
  const owned = await getCampaignOwnedByBusiness(db, businessId, campaignId);
  if (!owned) return c.json({ error: "Campaign not found" }, 404);
  return c.json(await loadBusinessStats(db, campaignId));
});

// ============================================================================
// Stats (dashboard overview panel). Scoped to the business's single "current"
// campaign, same scope as GET /campaign -- the dashboard shows one campaign
// at a time, so lifetime-across-all-campaigns aggregation isn't what's
// wanted here.
//
// conversionRatePercent definition (explicit product decision, since this
// wasn't specified anywhere in architecture.md/plan.md): "combined funnel" --
// total conversions (task completions + referral signups) divided by total
// opportunities (tasks assigned + referrals sent), i.e. one volume-weighted
// rate rather than an average of two separately-computed rates. This was
// chosen over averaging because averaging would let a low-volume funnel
// (e.g. 1-2 referrals) swing the number as much as a high-volume one
// (hundreds of task attempts).
//
// Both funnels are already fully represented in task_submissions: a
// 'referral_auto' submission_type row IS a referral attempt (created when
// someone uses a referral code), and its status becoming 'approved' IS the
// signup/conversion -- there's no separate "referral sent" event tracked
// anywhere, so no new table is needed to derive this. Non-referral
// submissions represent regular task attempts/completions the same way.
// This means opportunities = COUNT(*) of all task_submissions for the
// campaign, and conversions = COUNT(*) of those with status = 'approved'.
// ============================================================================

async function loadBusinessStats(db: D1Database, campaignId: string) {
  const members = await queryFirst<{ count: number }>(
    db,
    "SELECT COUNT(*) AS count FROM customer_campaign_codes WHERE campaign_id = ?",
    [campaignId]
  );

  const pointsIssued = await queryFirst<{ total: number }>(
    db,
    `SELECT COALESCE(SUM(pl.points), 0) AS total
     FROM points_ledger pl JOIN customer_campaign_codes ccc ON ccc.id = pl.customer_campaign_code_id
     WHERE ccc.campaign_id = ? AND pl.entry_type = 'earned'`,
    [campaignId]
  );

  const redemptions = await queryFirst<{ count: number }>(
    db,
    `SELECT COUNT(*) AS count
     FROM reward_redemptions rr JOIN customer_campaign_codes ccc ON ccc.id = rr.customer_campaign_code_id
     WHERE ccc.campaign_id = ? AND rr.status = 'fulfilled'`,
    [campaignId]
  );

  const funnel = await queryFirst<{ opportunities: number; conversions: number }>(
    db,
    `SELECT
       COUNT(*) AS opportunities,
       COALESCE(SUM(CASE WHEN ts.status = 'approved' THEN 1 ELSE 0 END), 0) AS conversions
     FROM task_submissions ts JOIN customer_campaign_codes ccc ON ccc.id = ts.customer_campaign_code_id
     WHERE ccc.campaign_id = ?`,
    [campaignId]
  );

  const opportunities = funnel?.opportunities ?? 0;
  const conversions = funnel?.conversions ?? 0;
  const conversionRatePercent = opportunities > 0 ? Math.round((conversions / opportunities) * 1000) / 10 : 0;

  return {
    totalMembers: members?.count ?? 0,
    totalPointsIssued: pointsIssued?.total ?? 0,
    rewardsRedeemed: redemptions?.count ?? 0,
    conversionRatePercent,
  };
}

businessRouter.get("/stats", async (c) => {
  const db = c.env.DB;
  const campaignId = await findCurrentCampaignId(db, c.get("auth").sub);
  if (!campaignId) {
    // No campaign yet -- zeroed stats rather than a 404, since this is a
    // routine "nothing has happened yet" state, not an error.
    return c.json({ totalMembers: 0, totalPointsIssued: 0, rewardsRedeemed: 0, conversionRatePercent: 0 });
  }
  return c.json(await loadBusinessStats(db, campaignId));
});

// ============================================================================
// Insights (read-only, generated elsewhere)
// ============================================================================

businessRouter.get("/insights", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").sub;
  const rows = await queryAll<{ id: string; cadence: string; message: string }>(
    db,
    `SELECT i.id, i.cadence, i.message
     FROM insights i JOIN campaigns cp ON cp.id = i.campaign_id
     WHERE cp.business_id = ?
     ORDER BY i.created_at DESC`,
    [businessId]
  );
  return c.json(
    rows.map((r) => ({ id: r.id, cadence: r.cadence as "daily" | "weekly" | "anomaly", message: r.message }))
  );
});

// ============================================================================
// Suggested changes (autopilot / AI-suggested campaign edits)
// ============================================================================

function serializeSuggestion(row: {
  id: string;
  risk_tier: string;
  change_type: string;
  rationale: string | null;
  status: string;
}) {
  return {
    id: row.id,
    riskTier: row.risk_tier as "low" | "high",
    changeType: row.change_type,
    rationale: row.rationale ?? "",
    status: row.status as "pending" | "applied" | "dismissed",
  };
}

businessRouter.get("/suggestions", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").sub;
  const rows = await queryAll<{
    id: string;
    risk_tier: string;
    change_type: string;
    rationale: string | null;
    status: string;
  }>(
    db,
    `SELECT sc.id, sc.risk_tier, sc.change_type, sc.rationale, sc.status
     FROM suggested_changes sc JOIN campaigns cp ON cp.id = sc.campaign_id
     WHERE cp.business_id = ?
     ORDER BY sc.created_at DESC`,
    [businessId]
  );
  return c.json(rows.map(serializeSuggestion));
});

async function loadOwnedSuggestion(db: D1Database, businessId: string, suggestionId: string) {
  return queryFirst<{
    id: string;
    campaign_id: string;
    risk_tier: string;
    change_type: string;
    target_id: string | null;
    suggested_value: string | null;
    rationale: string | null;
    status: string;
  }>(
    db,
    `SELECT sc.id, sc.campaign_id, sc.risk_tier, sc.change_type, sc.target_id, sc.suggested_value, sc.rationale, sc.status
     FROM suggested_changes sc JOIN campaigns cp ON cp.id = sc.campaign_id
     WHERE sc.id = ? AND cp.business_id = ?`,
    [suggestionId, businessId]
  );
}

// ============================================================================
// Natural-language campaign editing chat (plan.md Open Item 20, Part B).
// Wires Part A's parseNaturalLanguageCampaignRequest (lib/campaign-agent.ts)
// into a real endpoint: loads/saves per-session chat history in Workers KV
// (lib/chat-history.ts, per plan.md's decision), calls the parser with the
// owner's current campaign state, and on a non-clarification result inserts
// the resulting `pending` row directly into the suggested_changes table
// above -- reusing the EXACT same Apply/Dismiss flow SuggestionsTab.tsx
// already renders for analysis-driven suggestions, per Part B's "one
// unified place changes get confirmed" decision. This route NEVER calls
// applyCampaignUpdate itself, matching campaign-agent.ts's own load-bearing
// safety rule that an NL request only ever proposes, never writes live.
//
// sessionId is chosen client-side (crypto.randomUUID() once per mounted
// chat widget) -- there's no server-side "start session" step, since the
// first message for a brand-new sessionId simply finds no prior history in
// KV and starts a fresh conversation, same as any later message would.
//
// campaignId (plan.md Item 21 deferred sub-item 2, closed here) -- this
// route used to resolve "the" campaign via the legacy ensureCampaign
// active-then-newest fallback, same as the still-legacy GET/PUT /campaign
// routes above. Now takes an explicit campaignId from the client and
// verifies ownership via getCampaignOwnedByBusiness (the same
// WHERE id = ? AND business_id = ? pattern the :campaignId-scoped routes
// use), so a business with multiple non-active campaigns open can no
// longer have the chat silently edit whichever one ensureCampaign happened
// to resolve to. lib/chat-history.ts's KV key is already keyed by
// campaignId (`chat:{campaignId}:{sessionId}`), so no change was needed
// there -- it simply now receives the real campaignId instead of
// ensureCampaign's guess.
// ============================================================================

export interface CampaignChatRequestBody {
  campaignId: string;
  sessionId: string;
  text: string;
}

businessRouter.post("/campaign/chat", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").sub;
  const body = await c.req.json<Partial<CampaignChatRequestBody>>();

  if (!body.campaignId || typeof body.campaignId !== "string") {
    return c.json({ error: "Missing required field: campaignId" }, 400);
  }
  if (!body.sessionId || typeof body.sessionId !== "string") {
    return c.json({ error: "Missing required field: sessionId" }, 400);
  }
  if (!body.text || typeof body.text !== "string" || !body.text.trim()) {
    return c.json({ error: "Missing required field: text" }, 400);
  }

  const owned = await getCampaignOwnedByBusiness(db, businessId, body.campaignId);
  if (!owned) return c.json({ error: "Campaign not found" }, 404);
  const campaignId = body.campaignId;
  const campaignState = await serializeCampaign(db, campaignId);
  const history = await loadChatHistory(c.env, campaignId, body.sessionId);

  const result = await parseNaturalLanguageCampaignRequest(c.env, body.text, campaignState, history);

  if (result.needsClarification) {
    await appendChatTurns(c.env, campaignId, body.sessionId, [
      { role: "owner", content: body.text },
      { role: "assistant", content: result.clarifyingQuestion },
    ]);
    return c.json({ needsClarification: true, clarifyingQuestion: result.clarifyingQuestion });
  }

  const id = generateId();
  await execute(
    db,
    `INSERT INTO suggested_changes
       (id, campaign_id, risk_tier, change_type, target_id, current_value, suggested_value, rationale, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      id,
      campaignId,
      result.riskTier,
      result.changeType,
      result.targetId ?? null,
      result.currentValue,
      result.suggestedValue,
      result.rationale,
    ]
  );

  // Confirms the request landed in the suggestions queue -- keeps the chat
  // transcript coherent if the owner sends a follow-up in the same session,
  // even though the actual Apply/Dismiss decision now happens over in
  // SuggestionsTab, not in this chat widget.
  await appendChatTurns(c.env, campaignId, body.sessionId, [
    { role: "owner", content: body.text },
    { role: "assistant", content: `پیشنهاد ثبت شد و به بخش پیشنهادها اضافه شد: ${result.rationale}` },
  ]);

  const created = await loadOwnedSuggestion(db, businessId, id);
  if (!created) return c.json({ error: "Suggestion vanished mid-request" }, 500);
  return c.json({ needsClarification: false, suggestion: serializeSuggestion(created) });
});

type SuggestionMutationResult = { ok: true } | { ok: false; status: 400 | 404 | 409; error: string };

// Actually performs the DB mutation a suggested_changes row describes --
// the gap this whole feature was missing (see this route's own commit
// message / the checkpoint notes for the bug history). Parses
// suggested_value per the JSON shape migration 0003 documents (produced by
// campaign-agent.ts's buildPrompt for chat-originated suggestions; any
// future analysis-driven-insight producer of suggested_changes rows must
// follow the same shape). Returns a discriminated result rather than
// throwing, since an invalid/stale suggestion (edited target deleted out
// from under it, malformed JSON) is a routine, expected failure mode here,
// not a crash -- the caller decides what status/message to surface and,
// critically, does NOT flip status to 'applied' on failure.
async function applySuggestionMutation(
  db: D1Database,
  campaignId: string,
  changeType: string,
  targetId: string | null,
  suggestedValueRaw: string | null
): Promise<SuggestionMutationResult> {
  let value: Record<string, unknown>;
  try {
    const parsed = JSON.parse(suggestedValueRaw ?? "{}");
    value = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return { ok: false, status: 400, error: "Suggestion has malformed suggested_value and cannot be applied" };
  }

  switch (changeType) {
    case "task_points": {
      const points = value.points;
      if (typeof points !== "number" || !Number.isInteger(points) || points <= 0 || !targetId) {
        return { ok: false, status: 400, error: "Suggestion is missing a valid points value or target task" };
      }
      const task = await queryFirst<{ id: string }>(db, "SELECT id FROM campaign_tasks WHERE id = ? AND campaign_id = ?", [
        targetId,
        campaignId,
      ]);
      if (!task) return { ok: false, status: 404, error: "Target task no longer exists in this campaign" };
      await execute(db, "UPDATE campaign_tasks SET points_value = ? WHERE id = ?", [points, targetId]);
      return { ok: true };
    }
    case "reward_threshold": {
      const threshold = value.threshold;
      if (typeof threshold !== "number" || !Number.isInteger(threshold) || threshold <= 0 || !targetId) {
        return { ok: false, status: 400, error: "Suggestion is missing a valid threshold value or target reward" };
      }
      const reward = await queryFirst<{ id: string }>(
        db,
        "SELECT id FROM campaign_rewards WHERE id = ? AND campaign_id = ?",
        [targetId, campaignId]
      );
      if (!reward) return { ok: false, status: 404, error: "Target reward no longer exists in this campaign" };
      await execute(db, "UPDATE campaign_rewards SET threshold_points = ? WHERE id = ?", [threshold, targetId]);
      return { ok: true };
    }
    case "reward_depth": {
      const description = value.description;
      if (typeof description !== "string" || !description.trim() || !targetId) {
        return { ok: false, status: 400, error: "Suggestion is missing a valid description or target reward" };
      }
      const reward = await queryFirst<{ id: string }>(
        db,
        "SELECT id FROM campaign_rewards WHERE id = ? AND campaign_id = ?",
        [targetId, campaignId]
      );
      if (!reward) return { ok: false, status: 404, error: "Target reward no longer exists in this campaign" };
      // reward_depth (discount/gift depth) has no dedicated column on
      // campaign_rewards -- description is the free-text field that already
      // carries this information for display (see migration 0001's schema
      // and campaignRewards seed examples), so that's what this writes to.
      await execute(db, "UPDATE campaign_rewards SET description = ? WHERE id = ?", [description.trim(), targetId]);
      return { ok: true };
    }
    case "remove_task": {
      if (!targetId) return { ok: false, status: 400, error: "Suggestion is missing a target task" };
      const task = await queryFirst<{ id: string; name: string }>(
        db,
        "SELECT id, name FROM campaign_tasks WHERE id = ? AND campaign_id = ?",
        [targetId, campaignId]
      );
      if (!task) return { ok: false, status: 404, error: "Target task no longer exists in this campaign" };
      // Same guard applyCampaignUpdate's tasks block uses -- do not delete a
      // task that already has recorded customer activity (task_submissions
      // references it via campaign_task_id), or the DELETE throws an
      // uncaught FOREIGN KEY constraint error. Reused verbatim rather than
      // reimplemented, per this route's own commit message.
      const referenced = await queryFirst<{ c: number }>(
        db,
        "SELECT COUNT(*) AS c FROM task_submissions WHERE campaign_task_id = ?",
        [targetId]
      );
      if (referenced && referenced.c > 0) {
        return {
          ok: false,
          status: 409,
          error: `Cannot remove task "${task.name}": it already has recorded customer activity. Edit it instead of removing, or leave it in place.`,
        };
      }
      await execute(db, "DELETE FROM campaign_tasks WHERE id = ?", [targetId]);
      return { ok: true };
    }
    case "campaign_duration": {
      const deltaDays = value.deltaDays;
      if (typeof deltaDays !== "number" || !Number.isInteger(deltaDays) || deltaDays === 0) {
        return { ok: false, status: 400, error: "Suggestion is missing a valid day delta" };
      }
      const campaign = await queryFirst<{ end_date: string | null }>(db, "SELECT end_date FROM campaigns WHERE id = ?", [
        campaignId,
      ]);
      if (!campaign) return { ok: false, status: 404, error: "Campaign no longer exists" };
      // No current end_date to extend from (shouldn't normally happen --
      // every campaign gets one at creation/generation time) -- rather than
      // guess a base date, reject cleanly so the owner can set dates via the
      // campaign editor instead.
      if (!campaign.end_date) {
        return { ok: false, status: 400, error: "Campaign has no end date to extend" };
      }
      const newEndDate = new Date(new Date(campaign.end_date).getTime() + deltaDays * 24 * 60 * 60 * 1000).toISOString();
      await execute(db, "UPDATE campaigns SET end_date = ? WHERE id = ?", [newEndDate, campaignId]);
      return { ok: true };
    }
    case "add_task": {
      const pattern = value.pattern;
      const name = value.name;
      const points = value.points;
      if (
        typeof pattern !== "string" ||
        typeof name !== "string" ||
        !name.trim() ||
        typeof points !== "number" ||
        !Number.isInteger(points) ||
        points <= 0
      ) {
        return { ok: false, status: 400, error: "Suggestion is missing a valid pattern/name/points for the new task" };
      }
      const patternRow = await queryFirst<{ id: string }>(db, "SELECT id FROM task_patterns WHERE name = ?", [pattern]);
      if (!patternRow) return { ok: false, status: 400, error: `Unknown task pattern: ${pattern}` };
      const maxOrder = await queryFirst<{ max_order: number | null }>(
        db,
        "SELECT MAX(display_order) AS max_order FROM campaign_tasks WHERE campaign_id = ?",
        [campaignId]
      );
      await execute(
        db,
        `INSERT INTO campaign_tasks (id, campaign_id, task_pattern_id, points_value, display_order, name)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [generateId(), campaignId, patternRow.id, points, (maxOrder?.max_order ?? -1) + 1, name.trim()]
      );
      return { ok: true };
    }
    default:
      return { ok: false, status: 400, error: `Unsupported change_type: ${changeType}` };
  }
}

businessRouter.post("/suggestions/:id/apply", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").sub;
  const id = c.req.param("id");

  const existing = await loadOwnedSuggestion(db, businessId, id);
  if (!existing) return c.json({ error: "Suggestion not found" }, 404);
  if (existing.status !== "pending") {
    return c.json({ error: `Suggestion is already ${existing.status}` }, 409);
  }

  // Perform the real mutation FIRST -- status only flips to 'applied' (and
  // manual_apply_count only increments) if this actually succeeds. Fixes
  // the bug where every apply unconditionally marked itself 'applied' even
  // though nothing underneath it had changed.
  const mutation = await applySuggestionMutation(
    db,
    existing.campaign_id,
    existing.change_type,
    existing.target_id,
    existing.suggested_value
  );
  if (!mutation.ok) {
    return c.json({ error: mutation.error }, mutation.status);
  }

  await execute(
    db,
    "UPDATE suggested_changes SET status = 'applied', applied_by = 'business_owner', applied_at = ? WHERE id = ?",
    [nowIso(), id]
  );
  // Denormalized counter on businesses -- see migration 0003 for rationale.
  await execute(db, "UPDATE businesses SET manual_apply_count = manual_apply_count + 1 WHERE id = ?", [businessId]);

  const updated = await loadOwnedSuggestion(db, businessId, id);
  if (!updated) return c.json({ error: "Suggestion not found" }, 404);
  return c.json(serializeSuggestion(updated));
});

businessRouter.post("/suggestions/:id/dismiss", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").sub;
  const id = c.req.param("id");

  const existing = await loadOwnedSuggestion(db, businessId, id);
  if (!existing) return c.json({ error: "Suggestion not found" }, 404);
  if (existing.status !== "pending") {
    return c.json({ error: `Suggestion is already ${existing.status}` }, 409);
  }

  let reason: string | undefined;
  const raw = await c.req.text();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { reason?: string };
      reason = parsed.reason;
    } catch {
      return c.json({ error: "Invalid request body" }, 400);
    }
  }
  if (reason !== undefined && !["too_aggressive", "not_relevant", "other"].includes(reason)) {
    return c.json({ error: "Invalid dismiss reason" }, 400);
  }

  await execute(
    db,
    "UPDATE suggested_changes SET status = 'dismissed', dismiss_reason = ?, dismissed_at = ? WHERE id = ?",
    [reason ?? null, nowIso(), id]
  );

  const updated = await loadOwnedSuggestion(db, businessId, id);
  if (!updated) return c.json({ error: "Suggestion not found" }, 404);
  return c.json(serializeSuggestion(updated));
});

// ============================================================================
// Autopilot
// ============================================================================

async function loadAutopilot(db: D1Database, businessId: string) {
  return queryFirst<{
    autopilot_enabled: number;
    manual_apply_count: number;
    autopilot_eligibility_threshold: number;
  }>(
    db,
    "SELECT autopilot_enabled, manual_apply_count, autopilot_eligibility_threshold FROM businesses WHERE id = ?",
    [businessId]
  );
}

function serializeAutopilot(row: NonNullable<Awaited<ReturnType<typeof loadAutopilot>>>) {
  return {
    enabled: !!row.autopilot_enabled,
    manualApplyCount: row.manual_apply_count,
    eligibilityThreshold: row.autopilot_eligibility_threshold,
  };
}

businessRouter.get("/autopilot", async (c) => {
  const db = c.env.DB;
  const row = await loadAutopilot(db, c.get("auth").sub);
  if (!row) return c.json({ error: "Business not found" }, 404);
  return c.json(serializeAutopilot(row));
});

businessRouter.put("/autopilot", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").sub;
  const body = await c.req.json<Partial<{ enabled: boolean }>>();

  if (body.enabled !== undefined) {
    const row = await loadAutopilot(db, businessId);
    if (!row) return c.json({ error: "Business not found" }, 404);
    if (body.enabled && row.manual_apply_count < row.autopilot_eligibility_threshold) {
      return c.json(
        {
          error: "Not eligible for autopilot yet: manual apply count is below the eligibility threshold",
        },
        400
      );
    }
    await execute(db, "UPDATE businesses SET autopilot_enabled = ? WHERE id = ?", [
      body.enabled ? 1 : 0,
      businessId,
    ]);
  }

  const row = await loadAutopilot(db, businessId);
  if (!row) return c.json({ error: "Business not found" }, 404);
  return c.json(serializeAutopilot(row));
});

// ============================================================================
// Microsite
// ============================================================================

// Default per-module content, written the first time a business_microsite_modules
// row is created (see loop below). Was previously left NULL entirely -- see
// plan.md Phase 0.75 "Backend-wiring scope decision" (2026-09-11): the public
// microsite endpoint (routes/public-microsite.ts) reads this column directly,
// so a brand-new business with no owner-authored content yet would otherwise
// render with holes. Businesses seeded with real content (migration 0008)
// already have non-null rows and are unaffected by this function (it only
// INSERTs on first-ever creation of a microsite for a given business).
// Keyed by website_modules.key -- matches WebsiteModuleKey in
// apps/microsite/app/lib/mock-data.ts.
function defaultModuleContent(moduleKey: string, businessName: string, businessAddress: string): Record<string, unknown> | null {
  switch (moduleKey) {
    case "hero":
      return { badge_label: businessName, title: businessName, subtitle: "" };
    case "about":
      return { heading: `درباره ${businessName}`, description: "" };
    case "gallery":
      return { heading: "گالری تصاویر", images: [] };
    case "product_menu":
      return { heading: "منو / محصولات", items: [] };
    case "testimonials":
      return { heading: "نظرات مشتریان", items: [] };
    case "booking_cta":
      return { heading: "رزرو / تماس", button_label: "تماس بگیرید" };
    case "contact":
      // Pre-fills from businesses.address (plan.md Open Item 9) instead of
      // always starting blank -- the owner can still edit/clear it from
      // Microsite settings same as before, this just removes what was
      // previously a mandatory manual re-entry of something already on file.
      return { address: businessAddress, phone: "", hours: "" };
    case "campaign_highlight":
      return {
        title: "",
        description: "",
        cta_label: "",
        no_campaign_title: "کمپین بعدی به‌زودی می‌آید",
        no_campaign_description: "در حال حاضر کمپین فعالی نداریم.",
      };
    default:
      return null;
  }
}

// Deterministic goal-based fallback copy for the campaign_highlight module,
// used only to fill in a still-untouched (all-empty-string) module when a
// campaign is activated -- see PUT /campaign's status:'active' branch below.
// Bug found 2026-09-12: activating a campaign gave it a public_join_slug and
// featured it on the microsite (see the featured_campaign_id block above),
// but nothing ever wrote real title/description/cta_label into this
// module's content -- defaultModuleContent() only ever produces empty
// strings for these fields, and no other code path fills them in, so a
// launched campaign's highlight section renders with a visible goal badge
// but a blank title/description and an invisible (label-less) CTA button.
// Same non-LLM deterministic-fallback style as defaultModuleContent -- no
// content-editing UI exists for this module yet either way, so a sensible
// default beats a permanently blank section.
function campaignHighlightDefaults(
  goal: "acquisition" | "retention" | "acquisition_retention",
  businessName: string
): { title: string; description: string; cta_label: string } {
  switch (goal) {
    case "acquisition":
      return {
        title: `به جمع مشتریان ${businessName} بپیوندید`,
        description: `با عضویت در این کمپین، به عنوان مشتری جدید از پاداش‌های ویژه ${businessName} بهره‌مند شوید.`,
        cta_label: "همین حالا عضو شوید",
      };
    case "retention":
      return {
        title: `پاداش ویژه مشتریان همیشگی ${businessName}`,
        description: `با هر خرید امتیاز جمع کنید و جوایز ویژه‌ای که ${businessName} برایتان در نظر گرفته دریافت کنید.`,
        cta_label: "مشاهده باشگاه مشتریان",
      };
    case "acquisition_retention":
      return {
        title: `کمپین ویژه ${businessName}`,
        description: `چه مشتری جدید ${businessName} باشید و چه همیشگی، همین حالا جایزه‌ای منتظر شماست.`,
        cta_label: "همین حالا شروع کنید",
      };
  }
}

// Fills in a campaign's featured campaign_highlight module content the
// first time it's activated, but ONLY if title/description/cta_label are
// still all empty strings (i.e. the untouched default from
// defaultModuleContent) -- if the owner (or anything else) has already
// customized any of the three fields, this leaves the module alone rather
// than clobbering a deliberate edit. no_campaign_title/no_campaign_description
// are preserved as-is either way, since they're unrelated to a live campaign.
async function fillCampaignHighlightDefaults(
  db: D1Database,
  micrositeId: string,
  goal: "acquisition" | "retention" | "acquisition_retention",
  businessName: string
): Promise<void> {
  const row = await queryFirst<{ id: string; content: string | null }>(
    db,
    `SELECT bmm.id, bmm.content
     FROM business_microsite_modules bmm JOIN website_modules wm ON wm.id = bmm.website_module_id
     WHERE bmm.business_microsite_id = ? AND wm.key = 'campaign_highlight'`,
    [micrositeId]
  );
  if (!row?.content) return;

  let current: Record<string, unknown>;
  try {
    current = JSON.parse(row.content);
  } catch {
    return;
  }

  const isUntouched = current.title === "" && current.description === "" && current.cta_label === "";
  if (!isUntouched) return;

  const filled = campaignHighlightDefaults(goal, businessName);
  await execute(db, "UPDATE business_microsite_modules SET content = ? WHERE id = ?", [
    JSON.stringify({ ...current, ...filled }),
    row.id,
  ]);
}

// Keeps the microsite's hero/about content (and top-level business_name)
// in step with businesses.name after it changes -- without this, a rename
// via the onboarding wizard's Step 1 or the Settings profile form leaves
// the microsite permanently showing whatever placeholder/old name existed
// when ensureMicrosite() first auto-created the row (plan.md, found
// 2026-09-12 while investigating a stale "کسب‌وکار جدید" hero on a business
// that had since been renamed to a real name via the wizard).
//
// Only overwrites a field if its current stored value exactly matches what
// defaultModuleContent(oldName, ...) would have produced -- i.e. it still
// looks like an untouched auto-generated default. If the owner has since
// hand-edited the hero/about text (or the top-level business_name shown in
// the microsite header), this leaves it alone rather than clobbering a
// deliberate customization. No microsite row yet -> nothing to sync;
// ensureMicrosite() will use the already-updated name whenever it first runs.
async function syncMicrositeNameChange(
  db: D1Database,
  businessId: string,
  oldName: string,
  newName: string
): Promise<void> {
  if (oldName === newName) return;

  const microsite = await queryFirst<{ id: string; content: string }>(
    db,
    "SELECT id, content FROM business_microsites WHERE business_id = ?",
    [businessId]
  );
  if (!microsite) return;

  try {
    const topContent = JSON.parse(microsite.content) as { business_name?: string; [key: string]: unknown };
    if (topContent.business_name === oldName) {
      topContent.business_name = newName;
      await execute(db, "UPDATE business_microsites SET content = ?, updated_at = ? WHERE id = ?", [
        JSON.stringify(topContent),
        nowIso(),
        microsite.id,
      ]);
    }
  } catch {
    // Malformed/unexpected content shape -- leave it untouched rather than guessing.
  }

  const rows = await queryAll<{ id: string; key: string; content: string | null }>(
    db,
    `SELECT bmm.id, wm.key, bmm.content
     FROM business_microsite_modules bmm JOIN website_modules wm ON wm.id = bmm.website_module_id
     WHERE bmm.business_microsite_id = ? AND wm.key IN ('hero', 'about')`,
    [microsite.id]
  );
  for (const row of rows) {
    if (!row.content) continue;
    let current: Record<string, unknown>;
    try {
      current = JSON.parse(row.content);
    } catch {
      continue;
    }
    // Address doesn't factor into hero/about's default shape, so "" is fine here.
    const oldDefault = defaultModuleContent(row.key, oldName, "");
    if (oldDefault && JSON.stringify(current) === JSON.stringify(oldDefault)) {
      const newDefault = defaultModuleContent(row.key, newName, "");
      await execute(db, "UPDATE business_microsite_modules SET content = ? WHERE id = ?", [
        JSON.stringify(newDefault),
        row.id,
      ]);
    }
  }
}

// plan.md decision (2026-09-15, supersedes the original "lazy on first
// access" design): microsite creation is no longer an automatic side effect
// of GET/PUT /microsite (see getMicrositeId's non-creating resolver just
// below, used by those routes instead) or of activating a campaign -- it's
// created explicitly, exactly once, only when the wizard's site checkbox is
// checked (see generateCampaignForBusiness's call site above). A business
// that never opts in simply has no business_microsites row, ever. Kept
// idempotent (checks for an existing row first) as a defensive no-op, not
// because anything is expected to call it twice.
async function ensureMicrosite(db: D1Database, businessId: string): Promise<string> {
  const existing = await queryFirst<{ id: string }>(db, "SELECT id FROM business_microsites WHERE business_id = ?", [
    businessId,
  ]);
  if (existing) return existing.id;

  const template = await queryFirst<{ id: string }>(db, "SELECT id FROM website_templates LIMIT 1");
  if (!template) throw new Error("No website_templates seeded -- run migration 0005");

  const biz = await queryFirst<{ name: string; address: string | null }>(
    db,
    "SELECT name, address FROM businesses WHERE id = ?",
    [businessId]
  );
  const businessName = biz?.name ?? "";
  const businessAddress = biz?.address ?? "";

  const id = generateId();
  const slug = `biz-${businessId.slice(0, 8)}`;
  await execute(
    db,
    `INSERT INTO business_microsites (id, business_id, website_template_id, subdomain_slug, content, published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    [id, businessId, template.id, slug, JSON.stringify({ logo_url: null, business_name: businessName, tagline: "" }), nowIso(), nowIso()]
  );

  // category_module_defaults is deliberately unseeded (see 0002's header
  // comment), so there's no per-category default to read yet -- every
  // module starts enabled and the owner toggles off what they don't want.
  const modules = await queryAll<{ id: string; key: string }>(db, "SELECT id, key FROM website_modules");
  let order = 0;
  for (const m of modules) {
    await execute(
      db,
      `INSERT INTO business_microsite_modules (id, business_microsite_id, website_module_id, enabled, display_order, content)
       VALUES (?, ?, ?, 1, ?, ?)`,
      [generateId(), id, m.id, order++, JSON.stringify(defaultModuleContent(m.key, businessName, businessAddress))]
    );
  }
  return id;
}

// Non-creating resolver -- companion to ensureMicrosite above, same
// find-without-creating principle as findCurrentCampaignId. Returns null
// (never fabricates a row) when the business hasn't opted into a microsite
// yet. Used by GET/PUT /microsite and by applyCampaignUpdate's
// campaign-activation branch, neither of which may have the side effect of
// provisioning a microsite for a business that never asked for one.
async function getMicrositeId(db: D1Database, businessId: string): Promise<string | null> {
  const existing = await queryFirst<{ id: string }>(db, "SELECT id FROM business_microsites WHERE business_id = ?", [
    businessId,
  ]);
  return existing?.id ?? null;
}

async function serializeMicrosite(db: D1Database, micrositeId: string) {
  const site = await queryFirst<{
    published: number;
    subdomain_slug: string;
    template_name: string;
    subdomain_slug_set_by_owner: number;
  }>(
    db,
    `SELECT bm.published, bm.subdomain_slug, wt.name AS template_name, bm.subdomain_slug_set_by_owner
     FROM business_microsites bm JOIN website_templates wt ON wt.id = bm.website_template_id
     WHERE bm.id = ?`,
    [micrositeId]
  );
  if (!site) throw new Error(`Microsite ${micrositeId} vanished mid-request`);

  const modules = await queryAll<{ key: string; name_fa: string; enabled: number }>(
    db,
    `SELECT wm.key, wm.name_fa, bmm.enabled
     FROM business_microsite_modules bmm JOIN website_modules wm ON wm.id = bmm.website_module_id
     WHERE bmm.business_microsite_id = ?
     ORDER BY bmm.display_order ASC`,
    [micrositeId]
  );

  return {
    published: !!site.published,
    templateName: site.template_name,
    subdomainSlug: site.subdomain_slug,
    // plan.md Item 17 -- once true (owner has made their one-time slug
    // choice), PUT /microsite's subdomainSlug field is locked; the frontend
    // uses this to switch from an editable field to read-only display.
    subdomainSlugEditable: !site.subdomain_slug_set_by_owner,
    modules: modules.map((m) => ({ key: m.key, labelFa: m.name_fa, enabled: !!m.enabled })),
  };
}

businessRouter.get("/microsite", async (c) => {
  const db = c.env.DB;
  const micrositeId = await getMicrositeId(db, c.get("auth").sub);
  if (!micrositeId) {
    return c.json({ error: "این کسب‌وکار هنوز میکروسایت نساخته است", code: "microsite_not_created" }, 404);
  }
  return c.json(await serializeMicrosite(db, micrositeId));
});

businessRouter.put("/microsite", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").sub;
  const micrositeId = await getMicrositeId(db, businessId);
  if (!micrositeId) {
    return c.json({ error: "این کسب‌وکار هنوز میکروسایت نساخته است", code: "microsite_not_created" }, 404);
  }
  const body = await c.req.json<
    Partial<{
      published: boolean;
      templateName: string;
      subdomainSlug: string;
      modules: { key: string; labelFa: string; enabled: boolean }[];
    }>
  >();

  if (body.published !== undefined) {
    await execute(db, "UPDATE business_microsites SET published = ?, updated_at = ? WHERE id = ?", [
      body.published ? 1 : 0,
      nowIso(),
      micrositeId,
    ]);
  }
  if (body.subdomainSlug !== undefined) {
    // plan.md Item 17: the owner gets exactly one chance to pick a real
    // slug -- once subdomain_slug_set_by_owner is 1, further changes are
    // rejected outright rather than silently 404ing an already-shared/
    // printed referral link later. A brand-new (still-auto-generated)
    // microsite has this at 0 (both freshly created ones, and every
    // pre-existing row per migration 0014's default), so it's still
    // editable until the owner's first real choice.
    const current = await queryFirst<{ subdomain_slug: string; subdomain_slug_set_by_owner: number }>(
      db,
      "SELECT subdomain_slug, subdomain_slug_set_by_owner FROM business_microsites WHERE id = ?",
      [micrositeId]
    );
    if (current?.subdomain_slug_set_by_owner && body.subdomainSlug !== current.subdomain_slug) {
      return c.json({ error: "Subdomain slug has already been set and cannot be changed" }, 409);
    }

    const validationError = validateMicrositeSlug(body.subdomainSlug);
    if (validationError) return c.json({ error: validationError }, 400);

    const clash = await queryFirst<{ id: string }>(
      db,
      "SELECT id FROM business_microsites WHERE subdomain_slug = ? AND id != ?",
      [body.subdomainSlug, micrositeId]
    );
    if (clash) return c.json({ error: "Subdomain slug already taken" }, 409);
    await execute(
      db,
      "UPDATE business_microsites SET subdomain_slug = ?, subdomain_slug_set_by_owner = 1, updated_at = ? WHERE id = ?",
      [body.subdomainSlug, nowIso(), micrositeId]
    );
  }
  if (body.templateName !== undefined) {
    const tpl = await queryFirst<{ id: string }>(db, "SELECT id FROM website_templates WHERE name = ?", [
      body.templateName,
    ]);
    if (!tpl) return c.json({ error: "Unknown templateName" }, 400);
    await execute(db, "UPDATE business_microsites SET website_template_id = ?, updated_at = ? WHERE id = ?", [
      tpl.id,
      nowIso(),
      micrositeId,
    ]);
  }
  if (body.modules !== undefined) {
    for (const m of body.modules) {
      await execute(
        db,
        `UPDATE business_microsite_modules
         SET enabled = ?
         WHERE business_microsite_id = ?
           AND website_module_id = (SELECT id FROM website_modules WHERE key = ?)`,
        [m.enabled ? 1 : 0, micrositeId, m.key]
      );
    }
  }

  return c.json(await serializeMicrosite(db, micrositeId));
});

// ============================================================================
// Microsite activation ("request a microsite for an existing campaign").
// Fixes the gap where a business that skipped the wizard's "wantsSite"
// checkbox had no way back in -- GET/PUT /microsite above only ever 404
// with code 'microsite_not_created' and neither may create one as a side
// effect (see ensureMicrosite's own comment). These two routes are the
// explicit, owner-initiated alternative entry point: GET /microsite/eligibility
// tells the frontend whether there's anything to offer (a campaign exists,
// no microsite yet) plus a ready-to-edit suggested slug; POST
// /microsite/activate does the actual create-and-turn-on-the-addon step,
// reusing ensureMicrosite (same idempotent creator the wizard path already
// uses) rather than a second, parallel creation path.
// ============================================================================

// Slugify a business name into a candidate subdomain slug, same shape rules
// as resolveSuggestedMicrositeSlug's slugify step above (lowercase,
// spaces->hyphens, strip anything not DNS-label-safe, collapse/trim
// hyphens) but usable BEFORE a microsite row exists -- resolveSuggestedMicrositeSlug
// requires an existing micrositeId (to exclude from its own clash check and
// to check the owner-lock flag), neither of which applies here since this
// only ever runs pre-creation. Same 5-attempt numbered-suffix retry against
// the live table; falls back to a random `biz-xxxxxxxx` (matching
// ensureMicrosite's own default shape) if every attempt collides or the
// business name doesn't yield any DNS-safe characters at all (e.g. an
// all-Persian name with no Latin transliteration).
async function suggestMicrositeSlugForBusinessName(db: D1Database, businessName: string): Promise<string> {
  const fallback = `biz-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;

  const base = businessName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!base) return fallback;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    if (validateMicrositeSlug(candidate)) continue;
    const clash = await queryFirst<{ id: string }>(db, "SELECT id FROM business_microsites WHERE subdomain_slug = ?", [
      candidate,
    ]);
    if (!clash) return candidate;
  }
  return fallback;
}

export type MicrositeEligibility =
  | { eligible: false; reason: "already_created" | "no_campaign" }
  | {
      eligible: true;
      businessName: string;
      campaignGoal: "acquisition" | "retention" | "acquisition_retention";
      campaignStatus: "active" | "draft" | "ended";
      suggestedSlug: string;
      addonMonthlyPriceToman: number;
    };

businessRouter.get("/microsite/eligibility", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").sub;

  const existingMicrosite = await getMicrositeId(db, businessId);
  if (existingMicrosite) {
    return c.json<MicrositeEligibility>({ eligible: false, reason: "already_created" });
  }

  const campaignId = await findCurrentCampaignId(db, businessId);
  if (!campaignId) {
    return c.json<MicrositeEligibility>({ eligible: false, reason: "no_campaign" });
  }

  const campaign = await queryFirst<{ status: string; goal: string }>(
    db,
    "SELECT status, goal FROM campaigns WHERE id = ?",
    [campaignId]
  );
  const profile = await loadProfile(db, businessId);
  const businessName = profile?.name ?? "";

  return c.json<MicrositeEligibility>({
    eligible: true,
    businessName,
    campaignGoal: (campaign?.goal ?? "acquisition") as "acquisition" | "retention" | "acquisition_retention",
    campaignStatus: (campaign?.status ?? "draft") as "active" | "draft" | "ended",
    suggestedSlug: await suggestMicrositeSlugForBusinessName(db, businessName),
    addonMonthlyPriceToman: MICROSITE_ADDON_MONTHLY_PRICE_TOMAN,
  });
});

businessRouter.post("/microsite/activate", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").sub;

  if (await getMicrositeId(db, businessId)) {
    return c.json({ error: "میکروسایت قبلاً ساخته شده است", code: "microsite_already_created" }, 409);
  }
  const campaignId = await findCurrentCampaignId(db, businessId);
  if (!campaignId) {
    return c.json({ error: "ابتدا باید یک کمپین بسازید", code: "no_campaign" }, 409);
  }

  const body = await c.req.json<Partial<{ subdomainSlug: string }>>();

  // Validate the requested slug (if any) BEFORE creating the microsite row --
  // an invalid/taken slug should fail cleanly with nothing created, rather
  // than leaving an orphaned row behind with ensureMicrosite's ugly default
  // slug that the owner then has to notice and fix via PUT /microsite.
  let slug: string | undefined;
  if (body.subdomainSlug !== undefined) {
    const trimmed = body.subdomainSlug.trim().toLowerCase();
    const validationError = validateMicrositeSlug(trimmed);
    if (validationError) return c.json({ error: validationError }, 400);
    const clash = await queryFirst<{ id: string }>(db, "SELECT id FROM business_microsites WHERE subdomain_slug = ?", [
      trimmed,
    ]);
    if (clash) return c.json({ error: "این آدرس قبلاً استفاده شده است", code: "slug_taken" }, 409);
    slug = trimmed;
  }

  const micrositeId = await ensureMicrosite(db, businessId);

  // The owner's edited/confirmed slug from this flow counts as their
  // one-time choice (plan.md Item 17) -- same lock semantics as PUT
  // /microsite's own subdomainSlug branch, just applied at creation time
  // instead of afterward.
  if (slug !== undefined) {
    await execute(
      db,
      "UPDATE business_microsites SET subdomain_slug = ?, subdomain_slug_set_by_owner = 1, updated_at = ? WHERE id = ?",
      [slug, nowIso(), micrositeId]
    );
  }

  // "Buy and activate" -- turns on the add-on. No payment processor exists
  // anywhere in this codebase yet (architecture.md's addon_monthly_price_toman
  // is still an unwired placeholder column), so this records the add-on as
  // active at today's placeholder price rather than actually charging
  // anything -- consistent with ensureSubscription's own 'trialing'-by-default
  // approach to a not-yet-built billing flow.
  await execute(
    db,
    "UPDATE business_microsites SET addon_status = 'active', addon_monthly_price_toman = ?, updated_at = ? WHERE id = ?",
    [MICROSITE_ADDON_MONTHLY_PRICE_TOMAN, nowIso(), micrositeId]
  );

  return c.json(await serializeMicrosite(db, micrositeId), 201);
});

// ============================================================================
// Subscription (read-only here; upgrades/downgrades are a separate future
// flow, not part of this endpoint set)
// ============================================================================

async function ensureSubscription(db: D1Database, businessId: string): Promise<string> {
  const existing = await queryFirst<{ id: string }>(
    db,
    "SELECT id FROM business_subscriptions WHERE business_id = ?",
    [businessId]
  );
  if (existing) return existing.id;

  const biz = await queryFirst<{ size_tier: string | null }>(db, "SELECT size_tier FROM businesses WHERE id = ?", [
    businessId,
  ]);
  const tier = biz?.size_tier ?? "small";
  const plan = await queryFirst<{ id: string }>(db, "SELECT id FROM subscription_plans WHERE tier = ?", [tier]);
  if (!plan) throw new Error(`No subscription_plans row for tier ${tier} -- run migration 0005`);

  const id = generateId();
  const start = new Date();
  const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
  await execute(
    db,
    `INSERT INTO business_subscriptions (id, business_id, subscription_plan_id, status, current_period_start, current_period_end)
     VALUES (?, ?, ?, 'trialing', ?, ?)`,
    [id, businessId, plan.id, start.toISOString(), end.toISOString()]
  );
  return id;
}

businessRouter.get("/subscription", async (c) => {
  const db = c.env.DB;
  const subId = await ensureSubscription(db, c.get("auth").sub);
  const row = await queryFirst<{
    tier: string;
    monthly_price_toman: number;
    status: string;
    current_period_end: string | null;
  }>(
    db,
    `SELECT sp.tier, sp.monthly_price_toman, bs.status, bs.current_period_end
     FROM business_subscriptions bs JOIN subscription_plans sp ON sp.id = bs.subscription_plan_id
     WHERE bs.id = ?`,
    [subId]
  );
  if (!row) return c.json({ error: "Subscription not found" }, 404);
  return c.json({
    tier: row.tier,
    monthlyPriceToman: row.monthly_price_toman,
    status: row.status,
    currentPeriodEnd: row.current_period_end ?? "",
  });
});

// ============================================================================
// Notifications log (sends log)
// ============================================================================

businessRouter.get("/notifications-log", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").sub;
  const rows = await queryAll<{
    id: string;
    channel: string;
    status: string;
    sent_at: string;
    trigger_type: string;
    contact: string | null;
  }>(
    db,
    `SELECT nl.id, nl.channel, nl.status, nl.sent_at, nt.trigger_type,
            COALESCE(cust.phone_number, bc.phone_number) AS contact
     FROM notifications_log nl
     JOIN notification_templates nt ON nt.id = nl.notification_template_id
     LEFT JOIN customer_campaign_codes ccc ON ccc.id = nl.customer_campaign_code_id
     LEFT JOIN customers cust ON cust.id = ccc.customer_id
     LEFT JOIN business_contacts bc ON bc.id = nl.business_contact_id
     LEFT JOIN campaigns cp ON cp.id = nl.campaign_id
     WHERE cp.business_id = ? OR bc.business_id = ?
     ORDER BY nl.sent_at DESC
     LIMIT 200`,
    [businessId, businessId]
  );
  return c.json(
    rows.map((r) => ({
      id: r.id,
      contact: r.contact ?? "unknown",
      channel: r.channel as "sms" | "telegram",
      trigger: r.trigger_type,
      status: r.status as "sent" | "skipped" | "failed",
      sentAt: r.sent_at,
    }))
  );
});

// ============================================================================
// Staff (staff-pos persona). Staff signup is invite-only -- a business owner
// must register a staff phone here BEFORE that phone can complete OTP
// verification with role='staff' (see routes/auth.ts). Deactivating (rather
// than deleting) a staff row is how a business owner revokes access without
// losing the historical record of who did what.
// ============================================================================

function serializeStaff(row: { id: string; name: string; phone: string; phone_verified: number; active: number }) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    phoneVerified: !!row.phone_verified,
    active: !!row.active,
  };
}

businessRouter.get("/staff", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").sub;
  const rows = await queryAll<{ id: string; name: string; phone: string; phone_verified: number; active: number }>(
    db,
    "SELECT id, name, phone, phone_verified, active FROM staff WHERE business_id = ? ORDER BY created_at ASC",
    [businessId]
  );
  return c.json(rows.map(serializeStaff));
});

businessRouter.post("/staff", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").sub;
  const body = await c.req.json<Partial<{ name: string; phone: string }>>();

  if (!body.name || !body.phone) {
    return c.json({ error: "Missing required fields: name and phone" }, 400);
  }

  const clash = await queryFirst<{ id: string }>(db, "SELECT id FROM staff WHERE phone = ?", [body.phone]);
  if (clash) {
    return c.json({ error: "This phone number is already registered as staff (at this or another business)" }, 409);
  }

  const id = generateId();
  await execute(
    db,
    "INSERT INTO staff (id, business_id, name, phone, phone_verified, active, created_at) VALUES (?, ?, ?, ?, 0, 1, ?)",
    [id, businessId, body.name, body.phone, nowIso()]
  );

  const row = await queryFirst<{ id: string; name: string; phone: string; phone_verified: number; active: number }>(
    db,
    "SELECT id, name, phone, phone_verified, active FROM staff WHERE id = ?",
    [id]
  );
  if (!row) return c.json({ error: "Staff row vanished mid-request" }, 500);
  return c.json(serializeStaff(row), 201);
});

businessRouter.patch("/staff/:id", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").sub;
  const id = c.req.param("id");
  const body = await c.req.json<Partial<{ active: boolean; name: string }>>();

  const existing = await queryFirst<{ id: string }>(db, "SELECT id FROM staff WHERE id = ? AND business_id = ?", [
    id,
    businessId,
  ]);
  if (!existing) return c.json({ error: "Staff member not found" }, 404);

  if (body.active !== undefined) {
    await execute(db, "UPDATE staff SET active = ? WHERE id = ?", [body.active ? 1 : 0, id]);
  }
  if (body.name !== undefined) {
    await execute(db, "UPDATE staff SET name = ? WHERE id = ?", [body.name, id]);
  }

  const row = await queryFirst<{ id: string; name: string; phone: string; phone_verified: number; active: number }>(
    db,
    "SELECT id, name, phone, phone_verified, active FROM staff WHERE id = ?",
    [id]
  );
  if (!row) return c.json({ error: "Staff member not found" }, 404);
  return c.json(serializeStaff(row));
});

export { businessRouter };
