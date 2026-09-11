import { Hono } from "hono";
import type { D1Database } from "@cloudflare/workers-types";
import type { Env } from "../types";
import type { JWTPayload } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { generateId, queryAll, queryFirst, execute } from "../lib/db";
import { scoreTaskSubmission } from "../lib/vision";

const customerRouter = new Hono<{ Bindings: Env; Variables: { auth: JWTPayload } }>();

function nowIso(): string {
  return new Date().toISOString();
}

// All routes below act on "my own customer record" -- the customer id is
// always taken from the authenticated JWT subject (auth.sub), same pattern
// as business.ts.
customerRouter.use("/*", requireAuth);
customerRouter.use("/*", async (c, next) => {
  if (c.get("auth").role !== "customer") {
    return c.json({ error: "Forbidden: customer role required" }, 403);
  }
  await next();
});

// ============================================================================
// Campaign code auto-provisioning
//
// Single-tenant simplification (matches the current customer app's UI, which
// hardcodes one demo business/campaign -- see plan.md "Frontend-to-backend
// wiring / Customer persona" investigation notes): resolves/joins the FIRST
// campaign that exists in the DB, generating a personal_code + qr_payload the
// first time a given customer is seen. Flag as a gap once a real
// multi-business customer join flow (via microsite slug) is needed.
//
// Exported so auth.ts's verify-otp can call it directly at signup time, to
// fold referral-code-at-signup handling into the OTP flow (see referralCode
// param) rather than needing a second round-trip endpoint.
// ============================================================================

function generatePersonalCode(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}

export async function ensureCustomerCampaignCode(
  db: D1Database,
  customerId: string,
  referralCode?: string
): Promise<{ id: string; capped: boolean } | null> {
  const campaign = await queryFirst<{ id: string; max_referrals_per_customer: number }>(
    db,
    "SELECT id, max_referrals_per_customer FROM campaigns ORDER BY created_at ASC LIMIT 1"
  );
  // No campaign exists yet anywhere in the DB (e.g. no business has onboarded
  // yet) -- caller decides how to handle this (customer routes return 404;
  // verify-otp just skips code creation and tries again lazily on first
  // profile fetch, without the referral link in that fallback case).
  if (!campaign) return null;

  const existing = await queryFirst<{ id: string }>(
    db,
    "SELECT id FROM customer_campaign_codes WHERE customer_id = ? AND campaign_id = ?",
    [customerId, campaign.id]
  );
  if (existing) return { id: existing.id, capped: false };

  let referredByCodeId: string | null = null;
  let capped = false;
  if (referralCode) {
    const referrer = await queryFirst<{ id: string }>(
      db,
      "SELECT id FROM customer_campaign_codes WHERE personal_code = ? AND campaign_id = ?",
      [referralCode, campaign.id]
    );
    if (referrer) {
      const countRow = await queryFirst<{ n: number }>(
        db,
        "SELECT COUNT(*) AS n FROM customer_campaign_codes WHERE referred_by_code_id = ?",
        [referrer.id]
      );
      if ((countRow?.n ?? 0) >= campaign.max_referrals_per_customer) {
        capped = true;
      } else {
        referredByCodeId = referrer.id;
      }
    }
    // Unknown/typo'd referral code: silently ignored, not an error -- mirrors
    // processReferralSignup's leniency in the current frontend mock.
  }

  const id = generateId();
  const personalCode = generatePersonalCode();
  await execute(
    db,
    `INSERT INTO customer_campaign_codes (id, customer_id, campaign_id, personal_code, qr_payload, referred_by_code_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, customerId, campaign.id, personalCode, `CAMP-${personalCode}`, referredByCodeId, nowIso()]
  );

  // NOTE (flagging, not blocking): the "referral_joined" immediate ping to
  // the referrer (Phase 0.75 trigger #6) is a notification-system concern,
  // not implemented here -- notifications_log rows are not created by this
  // function. Same for referral points staying "Pending" until the referred
  // customer's first purchase (Phase 0.5 referral abuse prevention rule #2):
  // that requires a referral_auto task_submission tied to the referrer's own
  // "Referral" pattern campaign_task, which this signup-time function does
  // not create. Both are real gaps, tracked here rather than silently
  // dropped.

  return { id, capped };
}

async function resolveCode(db: D1Database, customerId: string) {
  return ensureCustomerCampaignCode(db, customerId);
}

// ============================================================================
// Profile
// ============================================================================

customerRouter.get("/profile", async (c) => {
  const db = c.env.DB;
  const customerId = c.get("auth").sub;

  const code = await resolveCode(db, customerId);
  if (!code) return c.json({ error: "No campaign available yet" }, 404);

  const row = await queryFirst<{
    business_name: string;
    personal_code: string;
    qr_payload: string;
    max_referrals_per_customer: number;
    business_id: string;
    campaign_id: string;
  }>(
    db,
    `SELECT b.name AS business_name, ccc.personal_code, ccc.qr_payload,
            cp.max_referrals_per_customer, b.id AS business_id, cp.id AS campaign_id
     FROM customer_campaign_codes ccc
     JOIN campaigns cp ON cp.id = ccc.campaign_id
     JOIN businesses b ON b.id = cp.business_id
     WHERE ccc.id = ?`,
    [code.id]
  );
  if (!row) return c.json({ error: "Campaign code vanished mid-request" }, 500);

  const balanceRow = await queryFirst<{ total: number | null }>(
    db,
    "SELECT SUM(points) AS total FROM points_ledger WHERE customer_campaign_code_id = ?",
    [code.id]
  );
  const referralCountRow = await queryFirst<{ n: number }>(
    db,
    "SELECT COUNT(*) AS n FROM customer_campaign_codes WHERE referred_by_code_id = ?",
    [code.id]
  );
  const carryoverRow = await queryFirst<{ total: number | null }>(
    db,
    `SELECT SUM(points) AS total FROM point_carryovers
     WHERE customer_id = ? AND business_id = ? AND consumed_in_campaign_id IS NULL`,
    [customerId, row.business_id]
  );
  const customerRow = await queryFirst<{ telegram_opted_in: number }>(
    db,
    "SELECT telegram_opted_in FROM customers WHERE id = ?",
    [customerId]
  );

  return c.json({
    businessName: row.business_name,
    personalCode: row.personal_code,
    qrPayload: row.qr_payload,
    pointsBalance: balanceRow?.total ?? 0,
    referralCount: referralCountRow?.n ?? 0,
    maxReferralCap: row.max_referrals_per_customer,
    carryoverBonus: carryoverRow?.total ?? 0,
    telegramOptedIn: !!(customerRow?.telegram_opted_in ?? 0),
  });
});

customerRouter.put("/telegram-opt-in", async (c) => {
  const db = c.env.DB;
  const customerId = c.get("auth").sub;
  let optedIn = true;
  const raw = await c.req.text();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { optedIn?: boolean };
      if (parsed.optedIn !== undefined) optedIn = parsed.optedIn;
    } catch {
      return c.json({ error: "Invalid request body" }, 400);
    }
  }
  await execute(db, "UPDATE customers SET telegram_opted_in = ? WHERE id = ?", [optedIn ? 1 : 0, customerId]);
  return c.json({ telegramOptedIn: optedIn });
});

// ============================================================================
// Tasks
// ============================================================================

customerRouter.get("/tasks", async (c) => {
  const db = c.env.DB;
  const customerId = c.get("auth").sub;
  const code = await resolveCode(db, customerId);
  if (!code) return c.json({ error: "No campaign available yet" }, 404);

  const campaign = await queryFirst<{ campaign_id: string }>(
    db,
    "SELECT campaign_id FROM customer_campaign_codes WHERE id = ?",
    [code.id]
  );
  if (!campaign) return c.json({ error: "Campaign code vanished mid-request" }, 500);

  const rows = await queryAll<{
    id: string;
    name: string;
    verification_method: string;
    points_value: number;
    submission_status: string | null;
  }>(
    db,
    `SELECT ct.id, ct.name, tp.verification_method, ct.points_value,
       (SELECT ts.status FROM task_submissions ts
        WHERE ts.campaign_task_id = ct.id AND ts.customer_campaign_code_id = ?
        ORDER BY ts.submitted_at DESC LIMIT 1) AS submission_status
     FROM campaign_tasks ct JOIN task_patterns tp ON tp.id = ct.task_pattern_id
     WHERE ct.campaign_id = ?
     ORDER BY ct.display_order ASC`,
    [code.id, campaign.campaign_id]
  );

  return c.json(
    rows.map((r) => ({
      id: r.id,
      title: r.name,
      // No dedicated "instruction" column exists on campaign_tasks (0001/0004
      // migrations only added a free-form `name`, not a longer description).
      // Left blank rather than adding a migration for this pass -- see
      // plan.md's customer-wiring investigation notes.
      instruction: "",
      verificationMethod: r.verification_method as "screenshot_ai" | "code_link_auto" | "pos_scan" | "receipt_claim",
      pointsValue: r.points_value,
      status: (r.submission_status === "rejected" ? null : r.submission_status) as "pending" | "approved" | null,
    }))
  );
});

customerRouter.post("/tasks/:id/submit", async (c) => {
  const db = c.env.DB;
  const customerId = c.get("auth").sub;
  const taskId = c.req.param("id");
  const code = await resolveCode(db, customerId);
  if (!code) return c.json({ error: "No campaign available yet" }, 404);

  const task = await queryFirst<{ id: string; name: string; verification_method: string }>(
    db,
    `SELECT ct.id, ct.name, tp.verification_method
     FROM campaign_tasks ct JOIN task_patterns tp ON tp.id = ct.task_pattern_id
     WHERE ct.id = ?`,
    [taskId]
  );
  if (!task) return c.json({ error: "Task not found" }, 404);

  let evidenceUrl: string | null = null;
  const raw = await c.req.text();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { evidenceUrl?: string };
      evidenceUrl = parsed.evidenceUrl ?? null;
    } catch {
      return c.json({ error: "Invalid request body" }, 400);
    }
  }

  const submissionId = generateId();
  await execute(
    db,
    `INSERT INTO task_submissions (id, customer_campaign_code_id, campaign_task_id, submission_type, evidence_url, status, submitted_at)
     VALUES (?, ?, ?, 'screenshot', ?, 'pending', ?)`,
    [submissionId, code.id, taskId, evidenceUrl, nowIso()]
  );

  // Vision scoring (Open Item 1, lib/vision.ts): only meaningful for
  // screenshot_ai-verified tasks with real evidence to look at. Runs via
  // waitUntil so it happens AFTER this response is sent -- the customer
  // shouldn't wait on a multimodal API call just to see "submitted".
  // Populates ai_confidence_score only; never changes `status` here (no
  // auto-approve/reject tiers exist yet -- Item 5 is still blocked on this
  // pipeline producing real score distributions first). Any failure
  // (unconfigured provider, fetch error, malformed model response) is
  // swallowed -- the submission still lands in Review Console's manual-hold
  // queue with a null score either way, exactly as it does today.
  if (evidenceUrl && task.verification_method === "screenshot_ai") {
    c.executionCtx.waitUntil(
      scoreTaskSubmission(c.env, evidenceUrl, task.name)
        .then(async (result) => {
          if (!result) return; // provider not configured -- leave score null
          await execute(db, "UPDATE task_submissions SET ai_confidence_score = ? WHERE id = ?", [
            result.confidenceScore,
            submissionId,
          ]);
        })
        .catch((err) => {
          console.error(`vision scoring failed for submission ${submissionId}:`, err);
        })
    );
  }

  return c.json({ submissionId, status: "pending" as const });
});

// Dev-only stub mirroring the current customer UI's "شبیه‌سازی بررسی AI"
// button -- real AI review isn't built yet. Kept clearly marked, same
// convention as auth.ts's DEV_OTPS.
customerRouter.post("/tasks/:id/simulate-ai-approve", async (c) => {
  const db = c.env.DB;
  const customerId = c.get("auth").sub;
  const taskId = c.req.param("id");
  const code = await resolveCode(db, customerId);
  if (!code) return c.json({ error: "No campaign available yet" }, 404);

  const submission = await queryFirst<{ id: string }>(
    db,
    `SELECT id FROM task_submissions
     WHERE campaign_task_id = ? AND customer_campaign_code_id = ? AND status = 'pending'
     ORDER BY submitted_at DESC LIMIT 1`,
    [taskId, code.id]
  );
  if (!submission) return c.json({ error: "No pending submission found for this task" }, 404);

  const task = await queryFirst<{ points_value: number }>(
    db,
    "SELECT points_value FROM campaign_tasks WHERE id = ?",
    [taskId]
  );
  if (!task) return c.json({ error: "Task not found" }, 404);

  await execute(
    db,
    "UPDATE task_submissions SET status = 'approved', reviewed_by = 'ai', reviewed_at = ?, points_awarded = ? WHERE id = ?",
    [nowIso(), task.points_value, submission.id]
  );
  await execute(
    db,
    `INSERT INTO points_ledger (id, customer_campaign_code_id, task_submission_id, entry_type, points, created_at)
     VALUES (?, ?, ?, 'earned', ?, ?)`,
    [generateId(), code.id, submission.id, task.points_value, nowIso()]
  );

  return c.json({ status: "approved" as const, pointsAwarded: task.points_value });
});

// ============================================================================
// Rewards
// ============================================================================

customerRouter.get("/rewards", async (c) => {
  const db = c.env.DB;
  const customerId = c.get("auth").sub;
  const code = await resolveCode(db, customerId);
  if (!code) return c.json({ error: "No campaign available yet" }, 404);

  const campaign = await queryFirst<{ campaign_id: string }>(
    db,
    "SELECT campaign_id FROM customer_campaign_codes WHERE id = ?",
    [code.id]
  );
  if (!campaign) return c.json({ error: "Campaign code vanished mid-request" }, 500);

  const balanceRow = await queryFirst<{ total: number | null }>(
    db,
    "SELECT SUM(points) AS total FROM points_ledger WHERE customer_campaign_code_id = ?",
    [code.id]
  );
  const balance = balanceRow?.total ?? 0;

  const rows = await queryAll<{ id: string; name: string; threshold_points: number }>(
    db,
    "SELECT id, name, threshold_points FROM campaign_rewards WHERE campaign_id = ? ORDER BY threshold_points ASC",
    [campaign.campaign_id]
  );

  return c.json(
    rows.map((r) => ({
      id: r.id,
      title: r.name,
      thresholdPoints: r.threshold_points,
      unlocked: balance >= r.threshold_points,
    }))
  );
});

customerRouter.post("/rewards/:id/redeem", async (c) => {
  const db = c.env.DB;
  const customerId = c.get("auth").sub;
  const rewardId = c.req.param("id");
  const code = await resolveCode(db, customerId);
  if (!code) return c.json({ error: "No campaign available yet" }, 404);

  const reward = await queryFirst<{ threshold_points: number }>(
    db,
    "SELECT threshold_points FROM campaign_rewards WHERE id = ?",
    [rewardId]
  );
  if (!reward) return c.json({ error: "Reward not found" }, 404);

  const balanceRow = await queryFirst<{ total: number | null }>(
    db,
    "SELECT SUM(points) AS total FROM points_ledger WHERE customer_campaign_code_id = ?",
    [code.id]
  );
  const balance = balanceRow?.total ?? 0;
  if (balance < reward.threshold_points) {
    return c.json({ error: "Insufficient points balance" }, 400);
  }

  const redemptionId = generateId();
  const redemptionCode = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  await execute(
    db,
    `INSERT INTO reward_redemptions (id, customer_campaign_code_id, campaign_reward_id, points_spent, status, redemption_code, redemption_code_expires_at, redeemed_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [redemptionId, code.id, rewardId, reward.threshold_points, redemptionCode, expiresAt, nowIso()]
  );
  await execute(
    db,
    `INSERT INTO points_ledger (id, customer_campaign_code_id, reward_redemption_id, entry_type, points, created_at)
     VALUES (?, ?, ?, 'redemption', ?, ?)`,
    [generateId(), code.id, redemptionId, -reward.threshold_points, nowIso()]
  );

  return c.json({ redemptionId, redemptionCode, expiresAt });
});

// ============================================================================
// Retroactive purchase claims
// Server-side re-implementation of mock-data.ts's submitRetroactivePurchaseClaim
// -- a client-only rate limit / dedup is meaningless once this is a real API,
// so all three rejection rules move here. Reason strings match the frontend's
// RetroClaimResult union exactly so the eventual frontend wiring pass can map
// this response directly.
// ============================================================================

const RETRO_CLAIM_RATE_LIMIT = 3;
const RETRO_CLAIM_MAX_HOURS = 72;

customerRouter.post("/retro-claims", async (c) => {
  const db = c.env.DB;
  const customerId = c.get("auth").sub;
  const code = await resolveCode(db, customerId);
  if (!code) return c.json({ error: "No campaign available yet" }, 404);

  const body = await c.req.json<{ receiptHash?: string; receiptNumber?: string; hoursAgo?: number }>();
  const hoursAgo = body.hoursAgo ?? 0;
  const receiptHash = (body.receiptHash ?? "").trim() || `hash_${Date.now()}`;
  const receiptNumber = (body.receiptNumber ?? "").trim() || `RCP-${Math.floor(1000 + Math.random() * 9000)}`;

  if (hoursAgo > RETRO_CLAIM_MAX_HOURS) {
    return c.json({ success: false, reason: "outside_time_window" }, 400);
  }

  const duplicate = await queryFirst<{ id: string }>(
    db,
    `SELECT pl.id FROM purchase_logs pl
     JOIN task_submissions ts ON ts.id = pl.task_submission_id
     WHERE ts.customer_campaign_code_id = ? AND pl.receipt_hash = ?`,
    [code.id, receiptHash]
  );
  if (duplicate) {
    return c.json({ success: false, reason: "duplicate_receipt" }, 409);
  }

  const pendingCountRow = await queryFirst<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM task_submissions
     WHERE customer_campaign_code_id = ? AND submission_type = 'receipt_claim' AND status = 'pending'`,
    [code.id]
  );
  if ((pendingCountRow?.n ?? 0) >= RETRO_CLAIM_RATE_LIMIT) {
    return c.json({ success: false, reason: "rate_limited" }, 429);
  }

  // Retroactive claims aren't tied to a specific campaign_task the way a
  // normal submission is (no task was "clicked" to trigger this) -- attach
  // to the campaign's pos_scan-verified task (the one a retro claim is a
  // fallback for), same task pattern the mockup uses for the POS-scanned
  // "repeat purchase" task.
  const campaign = await queryFirst<{ campaign_id: string }>(
    db,
    "SELECT campaign_id FROM customer_campaign_codes WHERE id = ?",
    [code.id]
  );
  if (!campaign) return c.json({ error: "Campaign code vanished mid-request" }, 500);

  const posTask = await queryFirst<{ id: string }>(
    db,
    `SELECT ct.id FROM campaign_tasks ct JOIN task_patterns tp ON tp.id = ct.task_pattern_id
     WHERE ct.campaign_id = ? AND tp.verification_method = 'pos_scan' LIMIT 1`,
    [campaign.campaign_id]
  );
  if (!posTask) {
    return c.json({ error: "No POS-verified task configured for this campaign" }, 400);
  }

  const submissionId = generateId();
  await execute(
    db,
    `INSERT INTO task_submissions (id, customer_campaign_code_id, campaign_task_id, submission_type, status, submitted_at)
     VALUES (?, ?, ?, 'receipt_claim', 'pending', ?)`,
    [submissionId, code.id, posTask.id, nowIso()]
  );
  await execute(
    db,
    `INSERT INTO purchase_logs (id, task_submission_id, receipt_hash, synced_from_offline, created_at)
     VALUES (?, ?, ?, 0, ?)`,
    [generateId(), submissionId, receiptHash, nowIso()]
  );

  return c.json({
    success: true,
    claim: {
      id: submissionId,
      receiptHash,
      receiptNumber,
      hoursAgo,
      submittedAt: nowIso(),
      status: "pending" as const,
    },
  });
});

// ============================================================================
// Notifications
// ============================================================================

customerRouter.get("/notifications", async (c) => {
  const db = c.env.DB;
  const customerId = c.get("auth").sub;
  const code = await resolveCode(db, customerId);
  if (!code) return c.json({ error: "No campaign available yet" }, 404);

  const rows = await queryAll<{ id: string; channel: string; trigger_type: string; body_template: string; sent_at: string }>(
    db,
    `SELECT nl.id, nl.channel, nt.trigger_type, nt.body_template, nl.sent_at
     FROM notifications_log nl JOIN notification_templates nt ON nt.id = nl.notification_template_id
     WHERE nl.customer_campaign_code_id = ?
     ORDER BY nl.sent_at DESC
     LIMIT 100`,
    [code.id]
  );

  return c.json(
    rows.map((r) => ({
      id: r.id,
      channel: r.channel as "sms" | "telegram",
      trigger: r.trigger_type,
      // Raw template text, no variable substitution applied yet (e.g. "{{personal_code}}"
      // placeholders aren't filled in) -- templating engine is a separate gap.
      text: r.body_template,
      sentAt: r.sent_at,
    }))
  );
});

export { customerRouter };
