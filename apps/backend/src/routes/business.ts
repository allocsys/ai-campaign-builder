import { Hono } from "hono";
import type { D1Database } from "@cloudflare/workers-types";
import type { Env } from "../types";
import type { JWTPayload } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { generateId, queryAll, queryFirst, execute } from "../lib/db";

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

// ============================================================================
// Profile
// ============================================================================

async function loadProfile(db: D1Database, businessId: string) {
  return queryFirst<{
    name: string;
    phone: string;
    size_tier: string | null;
    sms_wallet_balance_toman: number;
    sms_monthly_cap_toman: number | null;
    name_fa: string;
  }>(
    db,
    `SELECT b.name, b.phone, b.size_tier, b.sms_wallet_balance_toman, b.sms_monthly_cap_toman, bc.name_fa
     FROM businesses b JOIN business_categories bc ON bc.id = b.category_id
     WHERE b.id = ?`,
    [businessId]
  );
}

function serializeProfile(row: NonNullable<Awaited<ReturnType<typeof loadProfile>>>) {
  return {
    name: row.name,
    categoryLabel: row.name_fa,
    phone: row.phone,
    sizeTier: (row.size_tier ?? "small") as "micro" | "small" | "medium" | "large",
    smsWalletBalanceToman: row.sms_wallet_balance_toman,
    smsMonthlyCapToman: row.sms_monthly_cap_toman,
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
    }>
  >();

  if (body.name !== undefined) {
    await execute(db, "UPDATE businesses SET name = ? WHERE id = ?", [body.name, businessId]);
  }
  if (body.sizeTier !== undefined) {
    if (!["micro", "small", "medium", "large"].includes(body.sizeTier)) {
      return c.json({ error: "Invalid sizeTier" }, 400);
    }
    await execute(db, "UPDATE businesses SET size_tier = ? WHERE id = ?", [body.sizeTier, businessId]);
  }
  if (body.smsMonthlyCapToman !== undefined) {
    await execute(db, "UPDATE businesses SET sms_monthly_cap_toman = ? WHERE id = ?", [
      body.smsMonthlyCapToman,
      businessId,
    ]);
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
// Campaign (single "current" campaign per business -- auto-provisioned as a
// draft the first time it's read, since the frontend model always expects
// exactly one Campaign object, not a list)
// ============================================================================

async function ensureCampaign(db: D1Database, businessId: string): Promise<string> {
  const existing = await queryFirst<{ id: string }>(
    db,
    "SELECT id FROM campaigns WHERE business_id = ? ORDER BY created_at DESC LIMIT 1",
    [businessId]
  );
  if (existing) return existing.id;

  const id = generateId();
  await execute(
    db,
    `INSERT INTO campaigns (id, business_id, goal, status, point_multiplier, created_at)
     VALUES (?, ?, 'acquisition', 'draft', 1, ?)`,
    [id, businessId, nowIso()]
  );
  return id;
}

async function serializeCampaign(db: D1Database, campaignId: string) {
  const campaign = await queryFirst<{
    status: string;
    goal: string;
    point_multiplier: number;
    start_date: string | null;
    end_date: string | null;
  }>(db, "SELECT status, goal, point_multiplier, start_date, end_date FROM campaigns WHERE id = ?", [campaignId]);
  if (!campaign) throw new Error(`Campaign ${campaignId} vanished mid-request`);

  const tasks = await queryAll<{ name: string; pattern_name: string; points_value: number }>(
    db,
    `SELECT ct.name, tp.name AS pattern_name, ct.points_value
     FROM campaign_tasks ct JOIN task_patterns tp ON tp.id = ct.task_pattern_id
     WHERE ct.campaign_id = ? ORDER BY ct.display_order ASC`,
    [campaignId]
  );

  const rewards = await queryAll<{ name: string; threshold_points: number }>(
    db,
    "SELECT name, threshold_points FROM campaign_rewards WHERE campaign_id = ? ORDER BY threshold_points ASC",
    [campaignId]
  );

  return {
    status: campaign.status as "active" | "draft" | "ended",
    goal: campaign.goal as "acquisition" | "retention",
    pointMultiplier: campaign.point_multiplier,
    startDate: campaign.start_date ?? "",
    endDate: campaign.end_date ?? "",
    tasks: tasks.map((t) => ({ name: t.name, pattern: t.pattern_name, points: t.points_value })),
    rewards: rewards.map((r) => ({ name: r.name, threshold: r.threshold_points })),
  };
}

businessRouter.get("/campaign", async (c) => {
  const db = c.env.DB;
  const campaignId = await ensureCampaign(db, c.get("auth").sub);
  return c.json(await serializeCampaign(db, campaignId));
});

businessRouter.put("/campaign", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").sub;
  const campaignId = await ensureCampaign(db, businessId);
  const body = await c.req.json<
    Partial<{
      status: string;
      goal: string;
      pointMultiplier: number;
      startDate: string;
      endDate: string;
      tasks: { name: string; pattern: string; points: number }[];
      rewards: { name: string; threshold: number }[];
    }>
  >();

  if (body.status !== undefined) {
    if (!["active", "draft", "ended"].includes(body.status)) {
      return c.json({ error: "Invalid status" }, 400);
    }
    await execute(db, "UPDATE campaigns SET status = ? WHERE id = ?", [body.status, campaignId]);
  }
  if (body.goal !== undefined) {
    if (!["acquisition", "retention"].includes(body.goal)) {
      return c.json({ error: "Invalid goal" }, 400);
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
    await execute(db, "DELETE FROM campaign_tasks WHERE campaign_id = ?", [campaignId]);
    for (let i = 0; i < body.tasks.length; i++) {
      const t = body.tasks[i];
      const patternId = patternIdByName.get(t.pattern);
      if (!patternId) return c.json({ error: `Unknown task pattern: ${t.pattern}` }, 400);
      await execute(
        db,
        `INSERT INTO campaign_tasks (id, campaign_id, task_pattern_id, points_value, display_order, name)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [generateId(), campaignId, patternId, t.points, i, t.name]
      );
    }
  }

  if (body.rewards !== undefined) {
    // NOTE (flagging, not blocking): CampaignReward on the frontend has no
    // `pattern` field the way CampaignTask does, so there's no signal here
    // for which reward_pattern_id a given reward should link to.
    // Defaulting to the first seeded reward pattern (percentage_discount)
    // until product defines a `pattern` field for rewards too, or a
    // different resolution rule -- worth a decision like the task/reward
    // `name` one, same shape as gap #1.
    const defaultPattern = await queryFirst<{ id: string }>(
      db,
      "SELECT id FROM reward_patterns ORDER BY id ASC LIMIT 1"
    );
    if (!defaultPattern) return c.json({ error: "No reward_patterns seeded" }, 500);

    await execute(db, "DELETE FROM campaign_rewards WHERE campaign_id = ?", [campaignId]);
    for (const r of body.rewards) {
      await execute(
        db,
        `INSERT INTO campaign_rewards (id, campaign_id, reward_pattern_id, threshold_points, name)
         VALUES (?, ?, ?, ?, ?)`,
        [generateId(), campaignId, defaultPattern.id, r.threshold, r.name]
      );
    }
  }

  return c.json(await serializeCampaign(db, campaignId));
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
  return queryFirst<{ id: string; risk_tier: string; change_type: string; rationale: string | null; status: string }>(
    db,
    `SELECT sc.id, sc.risk_tier, sc.change_type, sc.rationale, sc.status
     FROM suggested_changes sc JOIN campaigns cp ON cp.id = sc.campaign_id
     WHERE sc.id = ? AND cp.business_id = ?`,
    [suggestionId, businessId]
  );
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

async function ensureMicrosite(db: D1Database, businessId: string): Promise<string> {
  const existing = await queryFirst<{ id: string }>(db, "SELECT id FROM business_microsites WHERE business_id = ?", [
    businessId,
  ]);
  if (existing) return existing.id;

  const template = await queryFirst<{ id: string }>(db, "SELECT id FROM website_templates LIMIT 1");
  if (!template) throw new Error("No website_templates seeded -- run migration 0005");

  const id = generateId();
  const slug = `biz-${businessId.slice(0, 8)}`;
  await execute(
    db,
    `INSERT INTO business_microsites (id, business_id, website_template_id, subdomain_slug, published, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
    [id, businessId, template.id, slug, nowIso(), nowIso()]
  );

  // category_module_defaults is deliberately unseeded (see 0002's header
  // comment), so there's no per-category default to read yet -- every
  // module starts enabled and the owner toggles off what they don't want.
  const modules = await queryAll<{ id: string }>(db, "SELECT id FROM website_modules");
  let order = 0;
  for (const m of modules) {
    await execute(
      db,
      `INSERT INTO business_microsite_modules (id, business_microsite_id, website_module_id, enabled, display_order)
       VALUES (?, ?, ?, 1, ?)`,
      [generateId(), id, m.id, order++]
    );
  }
  return id;
}

async function serializeMicrosite(db: D1Database, micrositeId: string) {
  const site = await queryFirst<{ published: number; subdomain_slug: string; template_name: string }>(
    db,
    `SELECT bm.published, bm.subdomain_slug, wt.name AS template_name
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
    modules: modules.map((m) => ({ key: m.key, labelFa: m.name_fa, enabled: !!m.enabled })),
  };
}

businessRouter.get("/microsite", async (c) => {
  const db = c.env.DB;
  const micrositeId = await ensureMicrosite(db, c.get("auth").sub);
  return c.json(await serializeMicrosite(db, micrositeId));
});

businessRouter.put("/microsite", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").sub;
  const micrositeId = await ensureMicrosite(db, businessId);
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
    const clash = await queryFirst<{ id: string }>(
      db,
      "SELECT id FROM business_microsites WHERE subdomain_slug = ? AND id != ?",
      [body.subdomainSlug, micrositeId]
    );
    if (clash) return c.json({ error: "Subdomain slug already taken" }, 409);
    await execute(db, "UPDATE business_microsites SET subdomain_slug = ?, updated_at = ? WHERE id = ?", [
      body.subdomainSlug,
      nowIso(),
      micrositeId,
    ]);
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

export { businessRouter };
