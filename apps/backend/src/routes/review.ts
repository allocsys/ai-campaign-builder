import { Hono } from "hono";
import type { D1Database } from "@cloudflare/workers-types";
import type { Env } from "../types";
import type { JWTPayload } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { generateId, queryAll, queryFirst, execute } from "../lib/db";

const reviewRouter = new Hono<{ Bindings: Env; Variables: { auth: JWTPayload } }>();

function nowIso(): string {
  return new Date().toISOString();
}

// review_team is a cross-business role (central team reviews submissions for
// every business, not scoped to one the way staff/business_owner are) -- no
// businessId filtering anywhere in this router, unlike staff-pos.ts.
reviewRouter.use("/*", requireAuth);
reviewRouter.use("/*", async (c, next) => {
  if (c.get("auth").role !== "review_team") {
    return c.json({ error: "Forbidden: review_team role required" }, 403);
  }
  await next();
});

// ============================================================================
// The manual review queue for receipt_claim/screenshot submissions that used
// to live here (GET/resolve /submissions*) has been removed (2026-09-13) --
// per explicit user request, staff now handle ALL screenshot AND receipt_claim
// review firsthand (apps/backend/src/routes/staff-pos.ts's /submissions*
// endpoints), since the central review team has no way to recognize a given
// business's receipts/products out of context the way that business's own
// staff can. AI-scored submissions only reach staff's queue at all when
// confidence is below the auto-approve threshold or scoring fails/isn't
// configured -- see customer.ts's applyVisionScoreAndMaybeAutoApprove for the
// gate. pos_scan and referral_auto submissions are auto-approved elsewhere
// and never land in a manual queue at all.
// ============================================================================

// ============================================================================
// Referral anomaly flags -- live aggregates computed on read, persisted flag
// rows written by run-detection. Two rules, same thresholds as the original
// frontend mock's runReferralAnomalyDetection: velocity (>5 referred signups
// in 24h) and dead_referral_ratio (>=5 referred signups older than 7 days
// with zero approved task_submissions).
// ============================================================================

const VELOCITY_THRESHOLD = 5;
const DEAD_REFERRAL_THRESHOLD = 5;

interface ReferrerAggregateRow {
  code_id: string;
  referrer_phone: string;
  personal_code: string;
  referral_count_24h: number;
  dead_referral_count: number;
}

async function computeReferrerAggregates(db: D1Database): Promise<ReferrerAggregateRow[]> {
  // One row per referrer (customer_campaign_codes row that has been used as
  // referred_by_code_id at least once), with both counts computed in the
  // same pass so a referrer can qualify for either/both rules.
  const rows = await queryAll<ReferrerAggregateRow>(
    db,
    `SELECT
       referrer.id AS code_id,
       cust.phone_number AS referrer_phone,
       referrer.personal_code AS personal_code,
       (SELECT COUNT(*) FROM customer_campaign_codes r24
        WHERE r24.referred_by_code_id = referrer.id
          AND r24.created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-24 hours')) AS referral_count_24h,
       (SELECT COUNT(*) FROM customer_campaign_codes rdead
        WHERE rdead.referred_by_code_id = referrer.id
          AND rdead.created_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 days')
          AND NOT EXISTS (
            SELECT 1 FROM task_submissions ts
            WHERE ts.customer_campaign_code_id = rdead.id AND ts.status = 'approved'
          )) AS dead_referral_count
     FROM customer_campaign_codes referrer
     JOIN customers cust ON cust.id = referrer.customer_id
     WHERE EXISTS (
       SELECT 1 FROM customer_campaign_codes ref
       WHERE ref.referred_by_code_id = referrer.id
     )`
  );
  return rows;
}

reviewRouter.get("/referral-aggregates", async (c) => {
  const db = c.env.DB;
  const aggregates = await computeReferrerAggregates(db);
  return c.json(
    aggregates.map((a) => ({
      codeId: a.code_id,
      referrerName: a.referrer_phone,
      personalCode: a.personal_code,
      referralCount24h: a.referral_count_24h,
      deadReferralCount: a.dead_referral_count,
    }))
  );
});

function flagRowToJson(f: {
  id: string;
  referrer_phone: string;
  personal_code: string;
  rule_triggered: string;
  description: string;
  status: string;
  notes: string | null;
  triggered_at: string;
}) {
  const ruleNameFa =
    f.rule_triggered === "velocity"
      ? "تعداد دعوت نامتعارف در بازه کوتاه (Velocity)"
      : "دعوت‌های غیرفعال بدون خرید (Dead Referral Ratio)";
  return {
    id: f.id,
    referrerName: `${f.referrer_phone} (${f.personal_code})`,
    ruleTriggered: f.rule_triggered as "velocity" | "dead_referral_ratio",
    ruleNameFa,
    description: f.description,
    triggeredAt: f.triggered_at,
    status: f.status as "open" | "reviewed" | "dismissed",
    notes: f.notes ?? "",
  };
}

async function listFlags(db: D1Database) {
  return queryAll<{
    id: string;
    referrer_phone: string;
    personal_code: string;
    rule_triggered: string;
    description: string;
    status: string;
    notes: string | null;
    triggered_at: string;
  }>(
    db,
    `SELECT rf.id, cust.phone_number AS referrer_phone, ccc.personal_code,
            rf.rule_triggered, rf.description, rf.status, rf.notes, rf.triggered_at
     FROM referral_flags rf
     JOIN customer_campaign_codes ccc ON ccc.id = rf.customer_campaign_code_id
     JOIN customers cust ON cust.id = ccc.customer_id
     ORDER BY rf.triggered_at DESC`
  );
}

reviewRouter.get("/referral-flags", async (c) => {
  const db = c.env.DB;
  const rows = await listFlags(db);
  return c.json(rows.map(flagRowToJson));
});

reviewRouter.post("/referral-flags/run-detection", async (c) => {
  const db = c.env.DB;
  const aggregates = await computeReferrerAggregates(db);
  let addedCount = 0;

  for (const agg of aggregates) {
    if (agg.referral_count_24h > VELOCITY_THRESHOLD) {
      const already = await queryFirst<{ id: string }>(
        db,
        "SELECT id FROM referral_flags WHERE customer_campaign_code_id = ? AND rule_triggered = 'velocity' AND status = 'open'",
        [agg.code_id]
      );
      if (!already) {
        await execute(
          db,
          `INSERT INTO referral_flags (id, customer_campaign_code_id, rule_triggered, description, status, triggered_at)
           VALUES (?, ?, 'velocity', ?, 'open', ?)`,
          [
            generateId(),
            agg.code_id,
            `تعداد ${agg.referral_count_24h} ثبت‌نام موفق با این کد معرف ثبت شده است (سقف سیستم ۵ است).`,
            nowIso(),
          ]
        );
        addedCount++;
      }
    }

    if (agg.dead_referral_count >= DEAD_REFERRAL_THRESHOLD) {
      const already = await queryFirst<{ id: string }>(
        db,
        "SELECT id FROM referral_flags WHERE customer_campaign_code_id = ? AND rule_triggered = 'dead_referral_ratio' AND status = 'open'",
        [agg.code_id]
      );
      if (!already) {
        await execute(
          db,
          `INSERT INTO referral_flags (id, customer_campaign_code_id, rule_triggered, description, status, triggered_at)
           VALUES (?, ?, 'dead_referral_ratio', ?, 'open', ?)`,
          [
            generateId(),
            agg.code_id,
            `تعداد ${agg.dead_referral_count} کاربر دعوت‌شده بیش از ۷ روز است ثبت‌نام کرده‌اند اما هیچ خرید یا فعالیتی ثبت نکرده‌اند.`,
            nowIso(),
          ]
        );
        addedCount++;
      }
    }
  }

  const rows = await listFlags(db);
  return c.json({ flags: rows.map(flagRowToJson), addedCount });
});

reviewRouter.post("/referral-flags/:id/resolve", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json<{ decision?: "reviewed" | "dismissed" }>();

  if (body.decision !== "reviewed" && body.decision !== "dismissed") {
    return c.json({ error: "decision must be 'reviewed' or 'dismissed'" }, 400);
  }

  const flag = await queryFirst<{ id: string; status: string }>(
    db,
    "SELECT id, status FROM referral_flags WHERE id = ?",
    [id]
  );
  if (!flag) return c.json({ error: "Flag not found" }, 404);
  if (flag.status !== "open") {
    return c.json({ error: `Flag is already ${flag.status}` }, 409);
  }

  const notes =
    body.decision === "reviewed"
      ? "توسط تیم مرکزی بررسی و بدون اقدام مخرب تشخیص داده شد."
      : "به‌عنوان هشدار اشتباه (False Positive) رد شد.";

  // resolved_by_user_id (Open Item 2) -- see reviewed_by_user_id note above.
  await execute(
    db,
    "UPDATE referral_flags SET status = ?, notes = ?, resolved_at = ?, resolved_by = 'central_team', resolved_by_user_id = ? WHERE id = ?",
    [body.decision, notes, nowIso(), c.get("auth").sub, id]
  );

  return c.json({ id, status: body.decision, notes });
});

export { reviewRouter };
