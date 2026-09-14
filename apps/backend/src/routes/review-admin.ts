import { Hono } from "hono";
import type { D1Database } from "@cloudflare/workers-types";
import type { Env } from "../types";
import type { JWTPayload } from "../middleware/auth";
import { requireAuth, signJWT } from "../middleware/auth";
import { getJwtSecret } from "../lib/jwt-config";
import { generateId, queryAll, queryFirst, execute } from "../lib/db";
import { hashPassword, verifyPassword } from "../lib/password";
import {
  ensureCampaign,
  findCurrentCampaignId,
  serializeCampaign,
  applyCampaignUpdate,
  generateCampaignForBusiness,
  deleteCampaignForBusiness,
} from "./business";
import type { CampaignUpdateBody, CampaignGenerateBody } from "./business";

const reviewAdminRouter = new Hono<{ Bindings: Env; Variables: { auth: JWTPayload } }>();

function nowIso(): string {
  return new Date().toISOString();
}

// ============================================================================
// Admin login -- username + password, NOT phone+OTP (deliberate departure
// from every other persona, see plan.md "Admin login mechanism"). Two
// identities are checked: the single env-configured root admin (no DB row,
// see types.ts's Env), and persisted apps/backend/migrations/0009 rows in
// review_admins. Both compare via the same hashed-password path
// (lib/password.ts), per the "Root admin password storage" decision.
// ============================================================================

reviewAdminRouter.post("/login", async (c) => {
  let username: string | undefined;
  let password: string | undefined;
  try {
    const body = await c.req.json<{ username?: string; password?: string }>();
    username = body.username;
    password = body.password;
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }
  if (!username || !password) {
    return c.json({ error: "Missing required fields: username and password" }, 400);
  }

  const secret = getJwtSecret(c.env);

  // Root identity check first -- env-configured, no DB row. See plan.md
  // "Admin storage + bootstrap" for why this sidesteps the roster table.
  if (c.env.REVIEW_ADMIN_USERNAME && c.env.REVIEW_ADMIN_PASSWORD_HASH && username === c.env.REVIEW_ADMIN_USERNAME) {
    const ok = await verifyPassword(password, c.env.REVIEW_ADMIN_PASSWORD_HASH);
    if (!ok) return c.json({ error: "Invalid username or password" }, 401);

    const token = await signJWT({ sub: username, role: "review_admin", isRoot: true }, secret);
    return c.json({ ok: true, token, user: { id: username, username, role: "review_admin", isRoot: true } });
  }

  // Non-root: check review_admins.
  const db = c.env.DB;
  const admin = await queryFirst<{ id: string; password_hash: string }>(
    db,
    "SELECT id, password_hash FROM review_admins WHERE username = ?",
    [username]
  );
  if (!admin) return c.json({ error: "Invalid username or password" }, 401);

  const ok = await verifyPassword(password, admin.password_hash);
  if (!ok) return c.json({ error: "Invalid username or password" }, 401);

  const token = await signJWT({ sub: admin.id, role: "review_admin", isRoot: false }, secret);
  return c.json({ ok: true, token, user: { id: admin.id, username, role: "review_admin", isRoot: false } });
});

// ============================================================================
// Everything below requires an authenticated review_admin.
// ============================================================================

reviewAdminRouter.use("/*", requireAuth);
reviewAdminRouter.use("/*", async (c, next) => {
  if (c.get("auth").role !== "review_admin") {
    return c.json({ error: "Forbidden: review_admin role required" }, 403);
  }
  await next();
});

// ----------------------------------------------------------------------------
// Self-service password change -- optional, any time, NOT forced on first
// login (see plan.md "Password change" decision). Root is permanently
// excluded: its password only ever changes via redeploying the
// REVIEW_ADMIN_PASSWORD_HASH secret, never through this endpoint (see
// "Root admin password mutability").
// ----------------------------------------------------------------------------

reviewAdminRouter.patch("/password", async (c) => {
  const auth = c.get("auth");
  if (auth.isRoot) {
    return c.json({ error: "The root admin's password is fixed via environment configuration and cannot be changed here." }, 403);
  }

  let currentPassword: string | undefined;
  let newPassword: string | undefined;
  try {
    const body = await c.req.json<{ currentPassword?: string; newPassword?: string }>();
    currentPassword = body.currentPassword;
    newPassword = body.newPassword;
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }
  if (!currentPassword || !newPassword) {
    return c.json({ error: "Missing required fields: currentPassword and newPassword" }, 400);
  }
  if (newPassword.length < 8) {
    return c.json({ error: "newPassword must be at least 8 characters" }, 400);
  }

  const db = c.env.DB;
  const admin = await queryFirst<{ id: string; password_hash: string }>(
    db,
    "SELECT id, password_hash FROM review_admins WHERE id = ?",
    [auth.sub]
  );
  if (!admin) return c.json({ error: "Admin not found" }, 404);

  const ok = await verifyPassword(currentPassword, admin.password_hash);
  if (!ok) return c.json({ error: "currentPassword is incorrect" }, 401);

  const newHash = await hashPassword(newPassword);
  await execute(db, "UPDATE review_admins SET password_hash = ? WHERE id = ?", [newHash, admin.id]);

  return c.json({ ok: true });
});

// ----------------------------------------------------------------------------
// review_team_members management -- register/deactivate reviewer phones.
// Mirrors business.ts's /staff endpoints exactly (same invite-only shape).
// ----------------------------------------------------------------------------

function serializeReviewTeamMember(row: { id: string; name: string; phone: string; phone_verified: number; active: number }) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    phoneVerified: !!row.phone_verified,
    active: !!row.active,
  };
}

reviewAdminRouter.get("/team-members", async (c) => {
  const db = c.env.DB;
  const rows = await queryAll<{ id: string; name: string; phone: string; phone_verified: number; active: number }>(
    db,
    "SELECT id, name, phone, phone_verified, active FROM review_team_members ORDER BY created_at ASC"
  );
  return c.json(rows.map(serializeReviewTeamMember));
});

reviewAdminRouter.post("/team-members", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<Partial<{ name: string; phone: string }>>();

  if (!body.name || !body.phone) {
    return c.json({ error: "Missing required fields: name and phone" }, 400);
  }

  const clash = await queryFirst<{ id: string }>(db, "SELECT id FROM review_team_members WHERE phone = ?", [body.phone]);
  if (clash) {
    return c.json({ error: "This phone number is already registered as a review-team member" }, 409);
  }

  const id = generateId();
  await execute(
    db,
    "INSERT INTO review_team_members (id, name, phone, phone_verified, active, created_at) VALUES (?, ?, ?, 0, 1, ?)",
    [id, body.name, body.phone, nowIso()]
  );

  const row = await queryFirst<{ id: string; name: string; phone: string; phone_verified: number; active: number }>(
    db,
    "SELECT id, name, phone, phone_verified, active FROM review_team_members WHERE id = ?",
    [id]
  );
  if (!row) return c.json({ error: "Review-team member row vanished mid-request" }, 500);
  return c.json(serializeReviewTeamMember(row), 201);
});

reviewAdminRouter.patch("/team-members/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json<Partial<{ active: boolean; name: string; phone: string }>>();

  const existing = await queryFirst<{ id: string }>(db, "SELECT id FROM review_team_members WHERE id = ?", [id]);
  if (!existing) return c.json({ error: "Review-team member not found" }, 404);

  if (body.active !== undefined) {
    await execute(db, "UPDATE review_team_members SET active = ? WHERE id = ?", [body.active ? 1 : 0, id]);
  }
  if (body.name !== undefined) {
    await execute(db, "UPDATE review_team_members SET name = ? WHERE id = ?", [body.name, id]);
  }
  if (body.phone !== undefined) {
    const clash = await queryFirst<{ id: string }>(
      db,
      "SELECT id FROM review_team_members WHERE phone = ? AND id != ?",
      [body.phone, id]
    );
    if (clash) {
      return c.json({ error: "This phone number is already registered as a review-team member" }, 409);
    }
    await execute(db, "UPDATE review_team_members SET phone = ? WHERE id = ?", [body.phone, id]);
  }

  const row = await queryFirst<{ id: string; name: string; phone: string; phone_verified: number; active: number }>(
    db,
    "SELECT id, name, phone, phone_verified, active FROM review_team_members WHERE id = ?",
    [id]
  );
  if (!row) return c.json({ error: "Review-team member not found" }, 404);
  return c.json(serializeReviewTeamMember(row));
});

reviewAdminRouter.delete("/team-members/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const existing = await queryFirst<{ id: string }>(db, "SELECT id FROM review_team_members WHERE id = ?", [id]);
  if (!existing) return c.json({ error: "Review-team member not found" }, 404);

  await execute(db, "DELETE FROM review_team_members WHERE id = ?", [id]);
  return c.json({ ok: true, id });
});

// ----------------------------------------------------------------------------
// review_admins management -- add/remove other admins (full-access scope,
// see plan.md "Admin scope + UI"). New admins are issued a username+password
// at creation time by the creating admin, not env-configured (see
// "Non-root admin login" decision). Root itself never appears in this list --
// it has no row.
// ----------------------------------------------------------------------------

function serializeReviewAdmin(row: { id: string; username: string; created_at: string; created_by: string }) {
  return { id: row.id, username: row.username, createdAt: row.created_at, createdBy: row.created_by };
}

reviewAdminRouter.get("/admins", async (c) => {
  const db = c.env.DB;
  const rows = await queryAll<{ id: string; username: string; created_at: string; created_by: string }>(
    db,
    "SELECT id, username, created_at, created_by FROM review_admins ORDER BY created_at ASC"
  );
  return c.json(rows.map(serializeReviewAdmin));
});

reviewAdminRouter.post("/admins", async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  const body = await c.req.json<Partial<{ username: string; password: string }>>();

  if (!body.username || !body.password) {
    return c.json({ error: "Missing required fields: username and password" }, 400);
  }
  if (body.password.length < 8) {
    return c.json({ error: "password must be at least 8 characters" }, 400);
  }
  if (c.env.REVIEW_ADMIN_USERNAME && body.username === c.env.REVIEW_ADMIN_USERNAME) {
    return c.json({ error: "This username is reserved for the root admin" }, 409);
  }

  const clash = await queryFirst<{ id: string }>(db, "SELECT id FROM review_admins WHERE username = ?", [body.username]);
  if (clash) return c.json({ error: "This username is already taken" }, 409);

  const id = generateId();
  const passwordHash = await hashPassword(body.password);
  // createdBy: the env-configured username when root creates it, otherwise
  // the creating admin's own username (looked up since JWT.sub is the row
  // id, not the username, for non-root admins).
  let createdBy = auth.sub;
  if (!auth.isRoot) {
    const creator = await queryFirst<{ username: string }>(db, "SELECT username FROM review_admins WHERE id = ?", [auth.sub]);
    createdBy = creator?.username ?? auth.sub;
  }

  await execute(
    db,
    "INSERT INTO review_admins (id, username, password_hash, created_at, created_by) VALUES (?, ?, ?, ?, ?)",
    [id, body.username, passwordHash, nowIso(), createdBy]
  );

  const row = await queryFirst<{ id: string; username: string; created_at: string; created_by: string }>(
    db,
    "SELECT id, username, created_at, created_by FROM review_admins WHERE id = ?",
    [id]
  );
  if (!row) return c.json({ error: "Admin row vanished mid-request" }, 500);
  return c.json(serializeReviewAdmin(row), 201);
});

reviewAdminRouter.delete("/admins/:id", async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");

  if (!auth.isRoot && auth.sub === id) {
    return c.json({ error: "You cannot remove your own admin account" }, 400);
  }

  const existing = await queryFirst<{ id: string }>(db, "SELECT id FROM review_admins WHERE id = ?", [id]);
  if (!existing) return c.json({ error: "Admin not found" }, 404);

  await execute(db, "DELETE FROM review_admins WHERE id = ?", [id]);
  return c.json({ ok: true, id });
});

// ----------------------------------------------------------------------------
// Campaign access (plan.md Item 16 Step B). Gives review_admin FULL PARITY
// with a business owner's own campaign access ("I'm the one making changes
// so it's full access" -- user's decision, no partial/read-only subset).
// Reuses business.ts's Step A exports (ensureCampaign, serializeCampaign,
// applyCampaignUpdate, generateCampaignForBusiness) so an admin edit goes
// through the EXACT same validation and side effects as an owner edit
// (join-slug generation, microsite featuring, campaign_highlight defaults
// on activate, single-active-campaign guard, AI-constraints clamping, etc.)
// -- nothing here reimplements that logic separately. No additional auth
// restriction beyond the router-wide review_admin role check above (no
// isRoot distinction for campaign access, per the full-access decision).
// ----------------------------------------------------------------------------

function serializeBusinessListItem(row: { id: string; name: string; phone: string; name_fa: string; manual_editor_enabled: number }) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    categoryLabel: row.name_fa,
    // plan.md Item 16 Step E -- lets the business picker show/toggle each
    // business's "حالت حرفه‌ای" state without a separate per-business fetch.
    manualEditorEnabled: !!row.manual_editor_enabled,
  };
}

// Business picker for the admin campaign UI (Step D/E) -- every business in
// the system, since review_admin has no per-business scoping (unlike
// business_owner, whose JWT sub IS the business id).
reviewAdminRouter.get("/businesses", async (c) => {
  const db = c.env.DB;
  const rows = await queryAll<{ id: string; name: string; phone: string; name_fa: string; manual_editor_enabled: number }>(
    db,
    `SELECT b.id, b.name, b.phone, bc.name_fa, b.manual_editor_enabled
     FROM businesses b JOIN business_categories bc ON bc.id = b.category_id
     ORDER BY b.name ASC`
  );
  return c.json(rows.map(serializeBusinessListItem));
});

// Admin-side toggle for a business's manual-editor gate (plan.md Item 16 Step
// E) -- the other half of the "either owner or admin can flip it" decision.
// review_admin's OWN use of the manual editor is unconditional regardless of
// this flag (same full-access model as the rest of this router); this only
// controls whether the flag/editor appear in that business owner's own UI.
reviewAdminRouter.patch("/businesses/:businessId/manual-editor", async (c) => {
  const db = c.env.DB;
  const businessId = c.req.param("businessId");
  if (!(await loadBusinessOr404(db, businessId))) return c.json({ error: "Business not found" }, 404);

  const body = await c.req.json<Partial<{ enabled: boolean }>>();
  if (body.enabled === undefined) {
    return c.json({ error: "Missing required field: enabled" }, 400);
  }
  await execute(db, "UPDATE businesses SET manual_editor_enabled = ? WHERE id = ?", [
    body.enabled ? 1 : 0,
    businessId,
  ]);
  return c.json({ id: businessId, manualEditorEnabled: body.enabled });
});

async function loadBusinessOr404(db: D1Database, businessId: string): Promise<boolean> {
  const exists = await queryFirst<{ id: string }>(db, "SELECT id FROM businesses WHERE id = ?", [businessId]);
  return !!exists;
}

// businessId-route-param equivalent of business.ts's GET /campaign. Uses the
// read-only findCurrentCampaignId (not ensureCampaign) so an admin merely
// viewing a business that hasn't been through the wizard yet can't silently
// create a phantom campaign for them -- same root-cause fix as the owner-
// facing GET /campaign.
reviewAdminRouter.get("/businesses/:businessId/campaign", async (c) => {
  const db = c.env.DB;
  const businessId = c.req.param("businessId");
  if (!(await loadBusinessOr404(db, businessId))) return c.json({ error: "Business not found" }, 404);

  const campaignId = await findCurrentCampaignId(db, businessId);
  if (!campaignId) return c.json({ error: "No campaign found for this business" }, 404);
  return c.json(await serializeCampaign(db, campaignId));
});

// businessId-route-param equivalent of business.ts's PUT /campaign --
// delegates to applyCampaignUpdate for identical validation/side effects.
reviewAdminRouter.put("/businesses/:businessId/campaign", async (c) => {
  const db = c.env.DB;
  const businessId = c.req.param("businessId");
  if (!(await loadBusinessOr404(db, businessId))) return c.json({ error: "Business not found" }, 404);

  const body = await c.req.json<CampaignUpdateBody>();
  const result = await applyCampaignUpdate(db, businessId, body);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json(result.campaign);
});

// Pause is a plain status change, not a distinct DB concept -- reuses the
// same PUT /campaign { status: 'draft' } path above (no separate route).
// This DELETE, however, is genuinely destructive: it hard-deletes the
// business's current campaign and every row that references it (customer
// codes, task submissions, redemptions, points ledger entries, etc.) --
// see deleteCampaignForBusiness's own comment for the full cascade and its
// two carryover edge cases. No confirmation step server-side; the
// review-console UI is expected to confirm with the admin before calling
// this. review_admin-only, same full-access model as the rest of this router.
reviewAdminRouter.delete("/businesses/:businessId/campaign", async (c) => {
  const db = c.env.DB;
  const businessId = c.req.param("businessId");
  if (!(await loadBusinessOr404(db, businessId))) return c.json({ error: "Business not found" }, 404);

  const result = await deleteCampaignForBusiness(db, businessId);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json({ ok: true, deletedCampaignId: result.deletedCampaignId });
});

// businessId-route-param equivalent of business.ts's POST /campaign/generate
// (the full onboarding-wizard generation flow) -- delegates to
// generateCampaignForBusiness for identical validation/side effects,
// including the single-active-campaign guard and AI-constraints clamping.
reviewAdminRouter.post("/businesses/:businessId/campaign/generate", async (c) => {
  const db = c.env.DB;
  const businessId = c.req.param("businessId");
  if (!(await loadBusinessOr404(db, businessId))) return c.json({ error: "Business not found" }, 404);

  const body = await c.req.json<CampaignGenerateBody>();
  const result = await generateCampaignForBusiness(db, c.env, businessId, body);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json(result.result);
});

// ----------------------------------------------------------------------------
// Admin entity deletion (staff / customers / businesses / microsites).
// Mirrors deleteCampaignForBusiness's manual-cascade style: D1/SQLite here
// has no ON DELETE CASCADE on any of these FKs, so every child table has to
// be cleaned up explicitly, in FK-safe order, before the parent row goes.
// All routes below are review_admin-only (same router-wide guard as
// everything else in this file) and are irreversible hard deletes -- no
// confirmation step server-side, same contract as the existing campaign
// delete (the review-console UI is expected to confirm first).
// ----------------------------------------------------------------------------

function serializeStaffMember(row: { id: string; name: string; phone: string; phone_verified: number; active: number }) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    phoneVerified: !!row.phone_verified,
    active: !!row.active,
  };
}

// List staff for one business -- admin has no per-business scoping, so this
// exists purely so the review-console staff list has something to render
// before offering delete (business.ts's own GET /business/staff is scoped to
// auth.sub, i.e. the business owner's own session, not usable here).
reviewAdminRouter.get("/businesses/:businessId/staff", async (c) => {
  const db = c.env.DB;
  const businessId = c.req.param("businessId");
  if (!(await loadBusinessOr404(db, businessId))) return c.json({ error: "Business not found" }, 404);

  const rows = await queryAll<{ id: string; name: string; phone: string; phone_verified: number; active: number }>(
    db,
    "SELECT id, name, phone, phone_verified, active FROM staff WHERE business_id = ? ORDER BY created_at ASC",
    [businessId]
  );
  return c.json(rows.map(serializeStaffMember));
});

// Staff rows have no children referencing them anywhere in the schema --
// a plain delete, scoped to the given business so an admin can't delete a
// staff id that belongs to a different business by mistake.
reviewAdminRouter.delete("/businesses/:businessId/staff/:staffId", async (c) => {
  const db = c.env.DB;
  const businessId = c.req.param("businessId");
  const staffId = c.req.param("staffId");

  const existing = await queryFirst<{ id: string }>(
    db,
    "SELECT id FROM staff WHERE id = ? AND business_id = ?",
    [staffId, businessId]
  );
  if (!existing) return c.json({ error: "Staff member not found for this business" }, 404);

  await execute(db, "DELETE FROM staff WHERE id = ?", [staffId]);
  return c.json({ ok: true, id: staffId });
});

// Deletes the given business's published microsite, if any. A microsite's
// only child table is business_microsite_modules (FK business_microsite_id);
// nothing else references a microsite's id (campaigns.featured_campaign_id
// runs the other direction, business_microsites -> campaigns).
async function deleteMicrositeForBusiness(db: D1Database, businessId: string): Promise<{ ok: true; deletedMicrositeId: string } | { ok: false; status: 404; error: string }> {
  const microsite = await queryFirst<{ id: string }>(db, "SELECT id FROM business_microsites WHERE business_id = ?", [
    businessId,
  ]);
  if (!microsite) return { ok: false, status: 404, error: "No microsite found for this business" };

  await execute(db, "DELETE FROM business_microsite_modules WHERE business_microsite_id = ?", [microsite.id]);
  await execute(db, "DELETE FROM business_microsites WHERE id = ?", [microsite.id]);
  return { ok: true, deletedMicrositeId: microsite.id };
}

reviewAdminRouter.delete("/businesses/:businessId/microsite", async (c) => {
  const db = c.env.DB;
  const businessId = c.req.param("businessId");
  if (!(await loadBusinessOr404(db, businessId))) return c.json({ error: "Business not found" }, 404);

  const result = await deleteMicrositeForBusiness(db, businessId);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json({ ok: true, deletedMicrositeId: result.deletedMicrositeId });
});

function serializeAdminCustomer(row: {
  id: string;
  phone_number: string;
  phone_verified: number;
  telegram_opted_in: number;
  created_at: string;
}) {
  return {
    id: row.id,
    phoneNumber: row.phone_number,
    phoneVerified: !!row.phone_verified,
    telegramOptedIn: !!row.telegram_opted_in,
    createdAt: row.created_at,
  };
}

// Customers are global (not business-scoped) -- listed here in full for the
// admin customers page, same "no per-business scoping" model as GET /businesses.
reviewAdminRouter.get("/customers", async (c) => {
  const db = c.env.DB;
  const rows = await queryAll<{
    id: string;
    phone_number: string;
    phone_verified: number;
    telegram_opted_in: number;
    created_at: string;
  }>(db, "SELECT id, phone_number, phone_verified, telegram_opted_in, created_at FROM customers ORDER BY created_at DESC");
  return c.json(rows.map(serializeAdminCustomer));
});

// Full cascade delete for one customer -- mirrors deleteCampaignForBusiness's
// cascade style but scoped to this customer's customer_campaign_codes rows
// (across however many businesses/campaigns they've joined) instead of one
// campaign's codes.
async function deleteCustomerCompletely(db: D1Database, customerId: string): Promise<{ ok: true } | { ok: false; status: 404; error: string }> {
  const customer = await queryFirst<{ id: string }>(db, "SELECT id FROM customers WHERE id = ?", [customerId]);
  if (!customer) return { ok: false, status: 404, error: "Customer not found" };

  const codes = await queryAll<{ id: string }>(db, "SELECT id FROM customer_campaign_codes WHERE customer_id = ?", [
    customerId,
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

  if (submissionIds.length > 0) {
    const placeholders = submissionIds.map(() => "?").join(",");
    await execute(db, `UPDATE task_submissions SET qualifying_purchase_id = NULL WHERE id IN (${placeholders})`, submissionIds);
    await execute(db, `DELETE FROM purchase_logs WHERE task_submission_id IN (${placeholders})`, submissionIds);
  }

  if (codeIds.length > 0) {
    const placeholders = codeIds.map(() => "?").join(",");
    await execute(db, `DELETE FROM points_ledger WHERE customer_campaign_code_id IN (${placeholders})`, codeIds);
    await execute(db, `DELETE FROM reward_redemptions WHERE customer_campaign_code_id IN (${placeholders})`, codeIds);
  }

  if (submissionIds.length > 0) {
    const placeholders = submissionIds.map(() => "?").join(",");
    await execute(db, `DELETE FROM task_submissions WHERE id IN (${placeholders})`, submissionIds);
  }

  if (codeIds.length > 0) {
    const placeholders = codeIds.map(() => "?").join(",");
    await execute(db, `DELETE FROM referral_flags WHERE referrer_customer_campaign_code_id IN (${placeholders})`, codeIds);
    await execute(
      db,
      `UPDATE customer_campaign_codes SET referred_by_code_id = NULL WHERE referred_by_code_id IN (${placeholders})`,
      codeIds
    );
    await execute(db, `DELETE FROM notifications_log WHERE customer_campaign_code_id IN (${placeholders})`, codeIds);
  }

  await execute(db, "DELETE FROM customer_campaign_codes WHERE customer_id = ?", [customerId]);

  // point_carryovers.customer_id is a real FK to customers.id (D1 runs with
  // foreign_keys=ON) -- any row where this customer was the carryover's
  // origin must go before the customers row itself. Any points_ledger row
  // that credited via one of these carryovers was already removed above
  // (points_ledger.customer_campaign_code_id is NOT NULL, so a carryover
  // credit always lands on one of this same customer's own codes, already
  // covered by the customer_campaign_code_id-scoped delete a few lines up).
  await execute(db, "DELETE FROM point_carryovers WHERE customer_id = ?", [customerId]);

  await execute(db, "DELETE FROM customers WHERE id = ?", [customerId]);

  return { ok: true };
}

reviewAdminRouter.delete("/customers/:customerId", async (c) => {
  const db = c.env.DB;
  const customerId = c.req.param("customerId");

  const result = await deleteCustomerCompletely(db, customerId);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json({ ok: true, id: customerId });
});

// Full cascade delete for a business owner -- deletes every campaign the
// business has ever had (looping deleteCampaignForBusiness, which only ever
// removes the single most-recent campaign per call), plus every other child
// table that references businesses.id, before the businesses row itself.
// This is the most destructive route in the admin panel: it removes the
// business's entire history (staff, contacts, subscription, SMS wallet log,
// microsite, checklist progress, AI constraints, carryovers) in addition to
// campaigns. No confirmation step server-side -- review-console UI must
// confirm first, same contract as the campaign delete above.
async function deleteBusinessCompletely(db: D1Database, businessId: string): Promise<{ ok: true } | { ok: false; status: 404; error: string }> {
  const business = await queryFirst<{ id: string }>(db, "SELECT id FROM businesses WHERE id = ?", [businessId]);
  if (!business) return { ok: false, status: 404, error: "Business not found" };

  // Repeatedly delete this business's "most recent" campaign until none are
  // left -- deleteCampaignForBusiness only ever targets one campaign per call.
  // Cap the loop defensively so a bug elsewhere can't spin forever.
  for (let i = 0; i < 1000; i++) {
    const result = await deleteCampaignForBusiness(db, businessId);
    if (!result.ok) break;
  }

  await deleteMicrositeForBusiness(db, businessId);

  await execute(db, "DELETE FROM staff WHERE business_id = ?", [businessId]);

  // notifications_log.business_contact_id is a real FK to business_contacts.id
  // (foreign_keys=ON) -- null it out (the column is nullable) rather than
  // deleting the log rows outright, since sms_wallet_transactions.notification_log_id
  // in turn references notifications_log.id and this keeps that side untouched.
  await execute(
    db,
    "UPDATE notifications_log SET business_contact_id = NULL WHERE business_contact_id IN (SELECT id FROM business_contacts WHERE business_id = ?)",
    [businessId]
  );
  await execute(db, "DELETE FROM business_contacts WHERE business_id = ?", [businessId]);
  await execute(db, "DELETE FROM business_subscriptions WHERE business_id = ?", [businessId]);
  await execute(db, "DELETE FROM sms_wallet_transactions WHERE business_id = ?", [businessId]);
  await execute(db, "DELETE FROM business_checklist_progress WHERE business_id = ?", [businessId]);
  await execute(db, "DELETE FROM business_ai_constraints WHERE business_id = ?", [businessId]);

  // Defensive only, expected to affect 0 rows in practice: the campaign-
  // deletion loop above already removes every point_carryovers row sourced
  // from one of this business's own campaigns (deleteCampaignForBusiness's
  // own DELETE ... WHERE source_campaign_id = ?), and any points_ledger row
  // crediting through one of those is cleared in that same function before
  // the carryover row goes. This only catches a data-inconsistency edge
  // case (a stray row whose business_id doesn't match any campaign this
  // loop saw), so it's still guarded the same way.
  await execute(db, "DELETE FROM point_carryovers WHERE business_id = ?", [businessId]);

  await execute(db, "DELETE FROM businesses WHERE id = ?", [businessId]);

  return { ok: true };
}

reviewAdminRouter.delete("/businesses/:businessId", async (c) => {
  const db = c.env.DB;
  const businessId = c.req.param("businessId");

  const result = await deleteBusinessCompletely(db, businessId);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json({ ok: true, id: businessId });
});

export { reviewAdminRouter };
