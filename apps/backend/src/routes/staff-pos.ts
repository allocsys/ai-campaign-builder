import { Hono } from "hono";
import type { D1Database } from "@cloudflare/workers-types";
import type { Env } from "../types";
import type { JWTPayload } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { generateId, queryAll, queryFirst, execute } from "../lib/db";
import { downloadEvidenceImage } from "../lib/storage";

const staffPosRouter = new Hono<{ Bindings: Env; Variables: { auth: JWTPayload } }>();

function nowIso(): string {
  return new Date().toISOString();
}

// All routes below act on behalf of a staff member scoped to a single
// business (auth.businessId, set at verify-otp time in auth.ts). Every query
// below joins through campaigns.business_id = businessId so one business's
// staff can never read or act on another business's customers, campaigns, or
// rewards -- staff has no "own record" the way business_owner/customer do,
// so this scoping has to be explicit in every query rather than implicit via
// auth.sub.
staffPosRouter.use("/*", requireAuth);
staffPosRouter.use("/*", async (c, next) => {
  const auth = c.get("auth");
  if (auth.role !== "staff") {
    return c.json({ error: "Forbidden: staff role required" }, 403);
  }
  if (!auth.businessId) {
    return c.json({ error: "Staff token missing businessId scope" }, 403);
  }
  await next();
});

// ============================================================================
// Shared helpers
// ============================================================================

// Resolves the business's current campaign the same way business.ts's
// ensureCampaign does for reads (most-recently-created), but read-only here
// -- staff never creates a campaign, only acts against an existing one.
async function findActiveCampaignId(db: D1Database, businessId: string): Promise<string | null> {
  const row = await queryFirst<{ id: string }>(
    db,
    "SELECT id FROM campaigns WHERE business_id = ? ORDER BY created_at DESC LIMIT 1",
    [businessId]
  );
  return row?.id ?? null;
}

// The single pos_scan-verified task for a campaign -- same lookup pattern as
// customer.ts's /retro-claims, and the source of the flat points-per-purchase
// value (no amount-based formula exists anywhere else in this schema).
async function findPosScanTask(db: D1Database, campaignId: string) {
  return queryFirst<{ id: string; points_value: number }>(
    db,
    `SELECT ct.id, ct.points_value FROM campaign_tasks ct
     JOIN task_patterns tp ON tp.id = ct.task_pattern_id
     WHERE ct.campaign_id = ? AND tp.verification_method = 'pos_scan' LIMIT 1`,
    [campaignId]
  );
}

// ============================================================================
// Customer lookup (by personal_code) -- scoped to this business's campaign.
// ============================================================================

staffPosRouter.get("/customers/:code", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").businessId as string;
  const personalCode = c.req.param("code");

  const campaignId = await findActiveCampaignId(db, businessId);
  if (!campaignId) return c.json({ error: "No campaign found for this business" }, 404);

  const row = await queryFirst<{ id: string; phone_number: string }>(
    db,
    `SELECT ccc.id, cust.phone_number
     FROM customer_campaign_codes ccc
     JOIN customers cust ON cust.id = ccc.customer_id
     WHERE ccc.personal_code = ? AND ccc.campaign_id = ?`,
    [personalCode, campaignId]
  );
  if (!row) return c.json({ error: "No customer found with this code for the active campaign" }, 404);

  const balanceRow = await queryFirst<{ total: number | null }>(
    db,
    "SELECT SUM(points) AS total FROM points_ledger WHERE customer_campaign_code_id = ?",
    [row.id]
  );

  // No `name` column exists on customers (schema is phone-only) -- customer
  // display name isn't captured anywhere in this app yet. Falling back to
  // the phone number for the staff-facing lookup UI; flagged as a gap, not
  // silently invented.
  return c.json({
    personalCode,
    name: row.phone_number,
    pointsBalance: balanceRow?.total ?? 0,
    campaignId,
  });
});

// ============================================================================
// Purchase logging (POS scan) -- creates an approved task_submission +
// purchase_logs row + points_ledger entry in one go, same two-step
// award-then-ledger pattern as customer.ts's simulate-ai-approve.
// Supports an optional idempotencyKey so this same endpoint can be called
// directly (online) or via /sync (offline replay) without double-awarding.
// ============================================================================

staffPosRouter.post("/purchases", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").businessId as string;
  const staffId = c.get("auth").sub;
  const body = await c.req.json<{
    personalCode?: string;
    amountToman?: number;
    idempotencyKey?: string;
  }>();

  if (!body.personalCode) {
    return c.json({ error: "Missing required field: personalCode" }, 400);
  }

  const campaignId = await findActiveCampaignId(db, businessId);
  if (!campaignId) return c.json({ error: "No campaign found for this business" }, 404);

  const code = await queryFirst<{ id: string }>(
    db,
    "SELECT id FROM customer_campaign_codes WHERE personal_code = ? AND campaign_id = ?",
    [body.personalCode, campaignId]
  );
  if (!code) return c.json({ error: "No customer found with this code for the active campaign" }, 404);

  if (body.idempotencyKey) {
    const dup = await queryFirst<{ id: string }>(
      db,
      "SELECT id FROM task_submissions WHERE idempotency_key = ?",
      [body.idempotencyKey]
    );
    if (dup) {
      return c.json({ status: "duplicate_skipped" as const }, 200);
    }
  }

  const task = await findPosScanTask(db, campaignId);
  if (!task) return c.json({ error: "No POS-verified task configured for this campaign" }, 400);

  const submissionId = generateId();
  await execute(
    db,
    `INSERT INTO task_submissions
       (id, customer_campaign_code_id, campaign_task_id, submission_type, status, reviewed_by, reviewed_at, points_awarded, submitted_at, idempotency_key)
     VALUES (?, ?, ?, 'pos_scan', 'approved', 'business_owner', ?, ?, ?, ?)`,
    [submissionId, code.id, task.id, nowIso(), task.points_value, nowIso(), body.idempotencyKey ?? null]
  );
  await execute(
    db,
    `INSERT INTO purchase_logs (id, task_submission_id, amount, synced_from_offline, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [generateId(), submissionId, body.amountToman ?? null, body.idempotencyKey ? 1 : 0, nowIso()]
  );
  await execute(
    db,
    `INSERT INTO points_ledger (id, customer_campaign_code_id, task_submission_id, entry_type, points, created_at)
     VALUES (?, ?, ?, 'earned', ?, ?)`,
    [generateId(), code.id, submissionId, task.points_value, nowIso()]
  );

  return c.json({
    status: "synced" as const,
    submissionId,
    pointsAwarded: task.points_value,
    loggedBy: staffId,
  });
});

// ============================================================================
// Reward fulfillment -- lookup by redemption_code, then a separate fulfill
// step. Points were already deducted at redeem-time in customer.ts (a
// negative points_ledger entry is written there), so fulfill here only
// flips reward_redemptions.status -- it must NOT touch points_ledger again.
// ============================================================================

async function loadOwnedRedemption(db: D1Database, businessId: string, redemptionCode: string) {
  return queryFirst<{
    id: string;
    status: string;
    points_spent: number;
    redemption_code_expires_at: string | null;
    reward_name: string;
    customer_phone: string;
    personal_code: string;
  }>(
    db,
    `SELECT rr.id, rr.status, rr.points_spent, rr.redemption_code_expires_at,
            cr.name AS reward_name, cust.phone_number AS customer_phone, ccc.personal_code
     FROM reward_redemptions rr
     JOIN campaign_rewards cr ON cr.id = rr.campaign_reward_id
     JOIN customer_campaign_codes ccc ON ccc.id = rr.customer_campaign_code_id
     JOIN customers cust ON cust.id = ccc.customer_id
     JOIN campaigns cp ON cp.id = ccc.campaign_id
     WHERE rr.redemption_code = ? AND cp.business_id = ?`,
    [redemptionCode, businessId]
  );
}

staffPosRouter.get("/redemptions/:code", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").businessId as string;
  const redemptionCode = c.req.param("code");

  const row = await loadOwnedRedemption(db, businessId, redemptionCode);
  if (!row) return c.json({ error: "No redemption found with this code for your business" }, 404);

  return c.json({
    code: redemptionCode,
    rewardTitle: row.reward_name,
    customerName: row.customer_phone,
    customerCode: row.personal_code,
    pointsDeducted: row.points_spent,
    status: row.status as "pending" | "fulfilled" | "cancelled",
    expired: row.redemption_code_expires_at !== null && new Date(row.redemption_code_expires_at) < new Date(),
  });
});

staffPosRouter.post("/redemptions/:code/fulfill", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").businessId as string;
  const redemptionCode = c.req.param("code");

  const row = await loadOwnedRedemption(db, businessId, redemptionCode);
  if (!row) return c.json({ error: "No redemption found with this code for your business" }, 404);
  if (row.status !== "pending") {
    return c.json({ error: `Redemption is already ${row.status}` }, 409);
  }
  if (row.redemption_code_expires_at && new Date(row.redemption_code_expires_at) < new Date()) {
    return c.json({ error: "Redemption code has expired" }, 410);
  }

  await execute(db, "UPDATE reward_redemptions SET status = 'fulfilled', fulfilled_at = ? WHERE id = ?", [
    nowIso(),
    row.id,
  ]);

  return c.json({
    code: redemptionCode,
    rewardTitle: row.reward_name,
    customerName: row.customer_phone,
    customerCode: row.personal_code,
    pointsDeducted: row.points_spent,
    status: "fulfilled" as const,
  });
});

// ============================================================================
// Offline queue sync -- batch replay of purchase/fulfill_reward actions
// queued while the POS device was offline. Server-side dedup uses the real
// idempotency_key UNIQUE index (migration 0006) as source of truth, not a
// client-supplied "already synced" set the way the frontend mock approximated
// it -- so a retried sync call is naturally idempotent even across app
// restarts.
// ============================================================================

interface OfflineQueueItemIn {
  id: string;
  idempotencyKey: string;
  personalCode: string;
  actionType: "purchase" | "fulfill_reward";
  amountToman?: number;
  redemptionCode?: string;
}

staffPosRouter.post("/sync", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").businessId as string;
  const body = await c.req.json<{ items?: OfflineQueueItemIn[] }>();
  const items = body.items ?? [];

  const campaignId = await findActiveCampaignId(db, businessId);
  const results: Array<{
    itemId: string;
    idempotencyKey: string;
    actionType: OfflineQueueItemIn["actionType"];
    status: "synced" | "duplicate_skipped" | "invalid_skipped";
    pointsAwarded?: number;
    reason: string;
  }> = [];

  for (const item of items) {
    // Duplicate check first -- applies to both action types since fulfill
    // could equally be replayed after a flaky connection.
    const dup = await queryFirst<{ id: string }>(
      db,
      "SELECT id FROM task_submissions WHERE idempotency_key = ?",
      [item.idempotencyKey]
    );
    if (dup) {
      results.push({
        itemId: item.id,
        idempotencyKey: item.idempotencyKey,
        actionType: item.actionType,
        status: "duplicate_skipped",
        reason: "An action with this idempotency key was already synced.",
      });
      continue;
    }

    if (!campaignId) {
      results.push({
        itemId: item.id,
        idempotencyKey: item.idempotencyKey,
        actionType: item.actionType,
        status: "invalid_skipped",
        reason: "No campaign found for this business.",
      });
      continue;
    }

    if (item.actionType === "purchase") {
      const code = await queryFirst<{ id: string }>(
        db,
        "SELECT id FROM customer_campaign_codes WHERE personal_code = ? AND campaign_id = ?",
        [item.personalCode, campaignId]
      );
      const task = code ? await findPosScanTask(db, campaignId) : null;
      if (!code || !task) {
        results.push({
          itemId: item.id,
          idempotencyKey: item.idempotencyKey,
          actionType: item.actionType,
          status: "invalid_skipped",
          reason: "Invalid customer code or no POS task configured for this campaign.",
        });
        continue;
      }

      const submissionId = generateId();
      await execute(
        db,
        `INSERT INTO task_submissions
           (id, customer_campaign_code_id, campaign_task_id, submission_type, status, reviewed_by, reviewed_at, points_awarded, submitted_at, idempotency_key)
         VALUES (?, ?, ?, 'pos_scan', 'approved', 'business_owner', ?, ?, ?, ?)`,
        [submissionId, code.id, task.id, nowIso(), task.points_value, nowIso(), item.idempotencyKey]
      );
      await execute(
        db,
        `INSERT INTO purchase_logs (id, task_submission_id, amount, synced_from_offline, created_at)
         VALUES (?, ?, ?, 1, ?)`,
        [generateId(), submissionId, item.amountToman ?? null, nowIso()]
      );
      await execute(
        db,
        `INSERT INTO points_ledger (id, customer_campaign_code_id, task_submission_id, entry_type, points, created_at)
         VALUES (?, ?, ?, 'earned', ?, ?)`,
        [generateId(), code.id, submissionId, task.points_value, nowIso()]
      );

      results.push({
        itemId: item.id,
        idempotencyKey: item.idempotencyKey,
        actionType: item.actionType,
        status: "synced",
        pointsAwarded: task.points_value,
        reason: "Purchase synced and points awarded.",
      });
    } else {
      // fulfill_reward
      const row = item.redemptionCode ? await loadOwnedRedemption(db, businessId, item.redemptionCode) : null;
      if (!row || row.status !== "pending") {
        results.push({
          itemId: item.id,
          idempotencyKey: item.idempotencyKey,
          actionType: item.actionType,
          status: "invalid_skipped",
          reason: !row ? "Invalid redemption code." : `Redemption is already ${row.status}.`,
        });
        continue;
      }

      await execute(db, "UPDATE reward_redemptions SET status = 'fulfilled', fulfilled_at = ? WHERE id = ?", [
        nowIso(),
        row.id,
      ]);
      // Reward fulfillment doesn't create a task_submission (points were
      // already deducted at redeem time), so there's no natural row to hang
      // the idempotency_key off. Recorded on a lightweight marker instead:
      // reuse task_submissions with a null campaign_task_id would violate
      // the NOT NULL constraint, so instead we rely on reward_redemptions'
      // own status check above (fulfilling an already-fulfilled redemption
      // is itself naturally idempotent-safe) rather than the idempotency_key
      // index for this action type.
      results.push({
        itemId: item.id,
        idempotencyKey: item.idempotencyKey,
        actionType: item.actionType,
        status: "synced",
        pointsAwarded: 0,
        reason: "Reward fulfillment synced.",
      });
    }
  }

  return c.json({ results });
});

// ============================================================================
// Recent activity (purchases + fulfillments) for this business, most recent
// first. Returns raw structured data rather than pre-formatted Farsi text --
// the frontend already has a formatToman() helper and is better placed to
// handle i18n/formatting than the backend.
// ============================================================================

staffPosRouter.get("/activity", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").businessId as string;

  const purchases = await queryAll<{
    id: string;
    amount: number | null;
    points_awarded: number | null;
    personal_code: string;
    created_at: string;
    synced_from_offline: number;
  }>(
    db,
    `SELECT pl.id, pl.amount, ts.points_awarded, ccc.personal_code, pl.created_at, pl.synced_from_offline
     FROM purchase_logs pl
     JOIN task_submissions ts ON ts.id = pl.task_submission_id
     JOIN customer_campaign_codes ccc ON ccc.id = ts.customer_campaign_code_id
     JOIN campaigns cp ON cp.id = ccc.campaign_id
     WHERE cp.business_id = ?
     ORDER BY pl.created_at DESC
     LIMIT 50`,
    [businessId]
  );

  const fulfillments = await queryAll<{
    id: string;
    reward_name: string;
    points_spent: number;
    personal_code: string;
    fulfilled_at: string;
  }>(
    db,
    `SELECT rr.id, cr.name AS reward_name, rr.points_spent, ccc.personal_code, rr.fulfilled_at
     FROM reward_redemptions rr
     JOIN campaign_rewards cr ON cr.id = rr.campaign_reward_id
     JOIN customer_campaign_codes ccc ON ccc.id = rr.customer_campaign_code_id
     JOIN campaigns cp ON cp.id = ccc.campaign_id
     WHERE cp.business_id = ? AND rr.status = 'fulfilled' AND rr.fulfilled_at IS NOT NULL
     ORDER BY rr.fulfilled_at DESC
     LIMIT 50`,
    [businessId]
  );

  const merged = [
    ...purchases.map((p) => ({
      id: p.id,
      type: "purchase" as const,
      customerCode: p.personal_code,
      amountToman: p.amount ?? null,
      pointsAwarded: p.points_awarded ?? 0,
      createdAt: p.created_at,
      // All rows read here are already persisted in D1, so they're "synced"
      // by definition -- a "queued" status only exists client-side, before
      // an item has been sent to /sync at all.
      status: "synced" as const,
    })),
    ...fulfillments.map((f) => ({
      id: f.id,
      type: "fulfill" as const,
      customerCode: f.personal_code,
      rewardTitle: f.reward_name,
      pointsDeducted: f.points_spent,
      createdAt: f.fulfilled_at,
      status: "synced" as const,
    })),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return c.json(merged.slice(0, 50));
});

// ============================================================================
// Firsthand screenshot verification queue -- social_proof/review_ugc
// submissions (Instagram story/post shares, written reviews) used to be
// routed to the central review console (review.ts) alongside receipt claims,
// but staff can check these firsthand since the customer is standing right
// there -- no need to route them through the central team async. Scoped to
// this business only (unlike review.ts's cross-business review_team queue),
// same businessId-through-campaigns join pattern as the rest of this router.
// receipt_claim submissions are NOT included here -- those still go through
// the central review console, since a retroactive purchase claim isn't
// something staff can verify firsthand at the point the claim is submitted.
// ============================================================================

staffPosRouter.get("/submissions", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").businessId as string;
  const status = c.req.query("status") ?? "pending";

  const rows = await queryAll<{
    id: string;
    customer_phone: string;
    task_name: string;
    task_pattern: string;
    evidence_url: string | null;
    status: string;
    points_awarded: number | null;
    submitted_at: string;
    points_value: number;
  }>(
    db,
    `SELECT ts.id, cust.phone_number AS customer_phone, ct.name AS task_name,
            tp.name AS task_pattern, ts.evidence_url, ts.status, ts.points_awarded,
            ts.submitted_at, ct.points_value
     FROM task_submissions ts
     JOIN campaign_tasks ct ON ct.id = ts.campaign_task_id
     JOIN task_patterns tp ON tp.id = ct.task_pattern_id
     JOIN customer_campaign_codes ccc ON ccc.id = ts.customer_campaign_code_id
     JOIN customers cust ON cust.id = ccc.customer_id
     JOIN campaigns cp ON cp.id = ccc.campaign_id
     WHERE cp.business_id = ?
       AND ts.submission_type = 'screenshot'
       AND tp.name IN ('social_proof', 'review_ugc')
       AND ts.status = ?
     ORDER BY ts.submitted_at DESC`,
    [businessId, status]
  );

  return c.json(
    rows.map((r) => ({
      id: r.id,
      customerName: r.customer_phone,
      taskTitle: r.task_name,
      taskPattern: r.task_pattern as "social_proof" | "review_ugc",
      evidenceUrl: r.evidence_url,
      status: r.status as "pending" | "approved" | "rejected",
      pointsAwarded: r.points_awarded,
      submittedAt: r.submitted_at,
      taskPointsValue: r.points_value,
    }))
  );
});

// Same private-B2-bucket proxy pattern as review.ts's evidence endpoint, but
// scoped to this business -- the join through campaigns.business_id is what
// prevents one business's staff from viewing another business's evidence
// images by guessing submission ids.
staffPosRouter.get("/submissions/:id/evidence", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").businessId as string;
  const id = c.req.param("id");

  const row = await queryFirst<{ evidence_url: string | null }>(
    db,
    `SELECT ts.evidence_url
     FROM task_submissions ts
     JOIN customer_campaign_codes ccc ON ccc.id = ts.customer_campaign_code_id
     JOIN campaigns cp ON cp.id = ccc.campaign_id
     WHERE ts.id = ? AND cp.business_id = ?`,
    [id, businessId]
  );
  if (!row || !row.evidence_url) {
    return c.json({ error: "Evidence not found" }, 404);
  }

  try {
    const { bytes, contentType } = await downloadEvidenceImage(c.env, row.evidence_url);
    return c.body(bytes, 200, { "Content-Type": contentType });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`evidence download failed for submission ${id}:`, message);
    const status = message.includes("not configured") ? 503 : 502;
    return c.json({ error: "Evidence download failed" }, status);
  }
});

staffPosRouter.post("/submissions/:id/resolve", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").businessId as string;
  const id = c.req.param("id");
  const body = await c.req.json<{ decision?: "approved" | "rejected" }>();

  if (body.decision !== "approved" && body.decision !== "rejected") {
    return c.json({ error: "decision must be 'approved' or 'rejected'" }, 400);
  }

  const submission = await queryFirst<{
    id: string;
    status: string;
    submission_type: string;
    customer_campaign_code_id: string;
    campaign_task_id: string;
  }>(
    db,
    `SELECT ts.id, ts.status, ts.submission_type, ts.customer_campaign_code_id, ts.campaign_task_id
     FROM task_submissions ts
     JOIN customer_campaign_codes ccc ON ccc.id = ts.customer_campaign_code_id
     JOIN campaigns cp ON cp.id = ccc.campaign_id
     WHERE ts.id = ? AND cp.business_id = ?`,
    [id, businessId]
  );
  if (!submission) return c.json({ error: "Submission not found" }, 404);
  if (submission.submission_type !== "screenshot") {
    return c.json({ error: "This endpoint only resolves screenshot submissions -- receipt claims go through the central review console" }, 400);
  }
  if (submission.status !== "pending") {
    return c.json({ error: `Submission is already ${submission.status}` }, 409);
  }

  const task = await queryFirst<{ points_value: number }>(
    db,
    "SELECT points_value FROM campaign_tasks WHERE id = ?",
    [submission.campaign_task_id]
  );
  if (!task) return c.json({ error: "Task not found" }, 500);

  const pointsAwarded = body.decision === "approved" ? task.points_value : 0;

  // reviewed_by is a fixed-value CHECK column ('ai' | 'central_team' |
  // 'business_owner' -- migration 0001_init.sql), with no distinct value for
  // staff. Reusing 'business_owner' here follows the exact same convention
  // already used a few lines up in /purchases and /sync for staff-initiated
  // pos_scan approvals -- the real staff identity is captured in
  // reviewed_by_user_id (auth.sub) instead, same as pos_scan does not track
  // it at all today but review.ts's newer convention does.
  await execute(
    db,
    "UPDATE task_submissions SET status = ?, reviewed_by = 'business_owner', reviewed_by_user_id = ?, reviewed_at = ?, points_awarded = ? WHERE id = ?",
    [body.decision, c.get("auth").sub, nowIso(), pointsAwarded, id]
  );

  if (body.decision === "approved") {
    await execute(
      db,
      `INSERT INTO points_ledger (id, customer_campaign_code_id, task_submission_id, entry_type, points, created_at)
       VALUES (?, ?, ?, 'earned', ?, ?)`,
      [generateId(), submission.customer_campaign_code_id, submission.id, pointsAwarded, nowIso()]
    );
  }

  return c.json({ id, status: body.decision, pointsAwarded });
});

export { staffPosRouter };
