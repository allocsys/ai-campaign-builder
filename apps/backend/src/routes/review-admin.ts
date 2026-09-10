import { Hono } from "hono";
import type { Env } from "../types";
import type { JWTPayload } from "../middleware/auth";
import { requireAuth, signJWT } from "../middleware/auth";
import { generateId, queryAll, queryFirst, execute } from "../lib/db";
import { hashPassword, verifyPassword } from "../lib/password";

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
  const body = await c.req.json<{ username?: string; password?: string }>().catch(() => ({}));
  const { username, password } = body;
  if (!username || !password) {
    return c.json({ error: "Missing required fields: username and password" }, 400);
  }

  const secret = c.env.JWT_SECRET || "default-dev-secret-key-change-in-production";

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

  const body = await c.req.json<{ currentPassword?: string; newPassword?: string }>().catch(() => ({}));
  const { currentPassword, newPassword } = body;
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
  const body = await c.req.json<Partial<{ active: boolean; name: string }>>();

  const existing = await queryFirst<{ id: string }>(db, "SELECT id FROM review_team_members WHERE id = ?", [id]);
  if (!existing) return c.json({ error: "Review-team member not found" }, 404);

  if (body.active !== undefined) {
    await execute(db, "UPDATE review_team_members SET active = ? WHERE id = ?", [body.active ? 1 : 0, id]);
  }
  if (body.name !== undefined) {
    await execute(db, "UPDATE review_team_members SET name = ? WHERE id = ?", [body.name, id]);
  }

  const row = await queryFirst<{ id: string; name: string; phone: string; phone_verified: number; active: number }>(
    db,
    "SELECT id, name, phone, phone_verified, active FROM review_team_members WHERE id = ?",
    [id]
  );
  if (!row) return c.json({ error: "Review-team member not found" }, 404);
  return c.json(serializeReviewTeamMember(row));
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

export { reviewAdminRouter };
