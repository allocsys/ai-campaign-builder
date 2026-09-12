import { Hono } from "hono";
import type { D1Database } from "@cloudflare/workers-types";
import type { Env } from "../types";
import type { JWTPayload } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { generateId, queryAll, queryFirst, execute } from "../lib/db";
import { generateCampaignProposal } from "../lib/campaign-generator";

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
    address: string | null;
  }>(
    db,
    `SELECT b.name, b.phone, b.size_tier, b.sms_wallet_balance_toman, b.sms_monthly_cap_toman, bc.name_fa, b.address
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
    address: row.address ?? "",
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
    }>
  >();

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

  const rewards = await queryAll<{ name: string; pattern_name: string; threshold_points: number }>(
    db,
    `SELECT cr.name, rp.name AS pattern_name, cr.threshold_points
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
    tasks: tasks.map((t) => ({ name: t.name, pattern: t.pattern_name, points: t.points_value })),
    rewards: rewards.map((r) => ({ name: r.name, pattern: r.pattern_name, threshold: r.threshold_points })),
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
      rewards: { name: string; pattern: string; threshold: number }[];
    }>
  >();

  if (body.status !== undefined) {
    if (!["active", "draft", "ended"].includes(body.status)) {
      return c.json({ error: "Invalid status" }, 400);
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
      // (see ensureCampaign's single-current-campaign model), so this is
      // always the right campaign to feature going forward.
      const micrositeId = await ensureMicrosite(db, businessId);
      await execute(db, "UPDATE business_microsites SET featured_campaign_id = ?, updated_at = ? WHERE id = ?", [
        campaignId,
        nowIso(),
        micrositeId,
      ]);
    }
  }
  if (body.goal !== undefined) {
    if (!["acquisition", "retention", "acquisition_retention"].includes(body.goal)) {
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
    // Resolves reward_pattern_id from the client-supplied `pattern` name,
    // same as campaign_tasks does for task_pattern_id above. Previously this
    // field didn't exist on the frontend shape and every reward was silently
    // linked to the first seeded reward pattern regardless of what the
    // owner actually picked -- see plan.md Open Items (CampaignReward
    // pattern-field gap, flagged in PR #27).
    const patternRows = await queryAll<{ id: string; name: string }>(db, "SELECT id, name FROM reward_patterns");
    const patternIdByName = new Map(patternRows.map((p) => [p.name, p.id]));
    await execute(db, "DELETE FROM campaign_rewards WHERE campaign_id = ?", [campaignId]);
    for (const r of body.rewards) {
      const patternId = patternIdByName.get(r.pattern);
      if (!patternId) return c.json({ error: `Unknown reward pattern: ${r.pattern}` }, 400);
      await execute(
        db,
        `INSERT INTO campaign_rewards (id, campaign_id, reward_pattern_id, threshold_points, name)
         VALUES (?, ?, ?, ?, ?)`,
        [generateId(), campaignId, patternId, r.threshold, r.name]
      );
    }
  }

  return c.json(await serializeCampaign(db, campaignId));
});

// ============================================================================
// Campaign generation (onboarding wizard, plan.md Open Item 8). Takes the
// wizard's 5 steps of answers, resolves the business's real name/category
// (fixing routes/auth.ts's placeholder-name/arbitrary-category auto-create
// gap), deterministically computes size tier + weighted tasks + reward
// thresholds via lib/campaign-generator.ts, and persists the result onto
// the business's current campaign as a fresh draft -- mirroring PUT
// /campaign's own replace-tasks/replace-rewards logic so both endpoints
// stay consistent. A separate PUT /campaign { status: 'active' } call (the
// wizard's existing "Launch" action) is what actually activates it.
// ============================================================================

businessRouter.post("/campaign/generate", async (c) => {
  const db = c.env.DB;
  const businessId = c.get("auth").sub;
  const body = await c.req.json<
    Partial<{
      businessName: string;
      businessAddress: string;
      categorySlug: string;
      goal: string;
      audienceDescription: string;
      dailyCustomerCount: number;
      monthlyRevenueToman: number;
      /** Optional -- omitted/null when the owner has no Instagram page. */
      followerCount: number | null;
      /** Optional (plan.md "Step 4 leads with AI deciding" decision) -- only ever feeds LLM copy, never the deterministic math, so it's not required. */
      offerDescription: string;
      rewardPatternNames: string[];
    }>
  >();

  if (!body.businessName?.trim() || !body.categorySlug || !body.goal || !body.rewardPatternNames?.length) {
    return c.json(
      {
        error: "Missing required fields: businessName, categorySlug, goal, rewardPatternNames (at least one)",
      },
      400
    );
  }
  if (!["acquisition", "retention", "acquisition_retention"].includes(body.goal)) {
    return c.json({ error: "Invalid goal" }, 400);
  }

  const category = await queryFirst<{ id: string; name_fa: string }>(
    db,
    "SELECT id, name_fa FROM business_categories WHERE slug = ?",
    [body.categorySlug]
  );
  if (!category) return c.json({ error: `Unknown categorySlug: ${body.categorySlug}` }, 400);

  // Multi-select reward types: validate every selected name up front and
  // build a name->id map, since each generated reward tier can now carry a
  // different pattern (previously every reward row shared one rewardPattern.id).
  const rewardPatternRows = await queryAll<{ id: string; name: string }>(db, "SELECT id, name FROM reward_patterns");
  const rewardPatternIdByName = new Map(rewardPatternRows.map((p) => [p.name, p.id]));
  for (const name of body.rewardPatternNames) {
    if (!rewardPatternIdByName.has(name)) {
      return c.json({ error: `Unknown rewardPatternName: ${name}` }, 400);
    }
  }

  // Single-active-campaign guard (plan.md decision): ensureCampaign always
  // resolves to the one "current" campaign for this business -- generation
  // must not silently clobber a live campaign's tasks/rewards/dates out from
  // under active customers. ensureCampaign's own auto-create-draft-if-none
  // path is harmless here: a brand-new business has no campaign to clobber.
  const campaignId = await ensureCampaign(db, businessId);
  const currentStatus = await queryFirst<{ status: string }>(db, "SELECT status FROM campaigns WHERE id = ?", [
    campaignId,
  ]);
  if (currentStatus?.status === "active") {
    return c.json(
      { error: "کمپین فعلی این کسب‌وکار در حال اجراست. برای ساخت کمپین جدید، ابتدا کمپین فعلی را پایان دهید." },
      409
    );
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

  const proposal = await generateCampaignProposal(db, c.env, {
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
  });

  const nowMs = Date.now();
  const startDate = new Date(nowMs).toISOString();
  const endDate = new Date(nowMs + proposal.durationDays * 24 * 60 * 60 * 1000).toISOString();

  // Always resets to 'draft' regardless of whether the prior campaign was
  // 'draft' or 'ended' -- generation always produces a fresh proposal cycle;
  // 'active' was already rejected above with a 409.
  await execute(
    db,
    `UPDATE campaigns
     SET status = 'draft', goal = ?, point_multiplier = ?, start_date = ?, end_date = ?,
         audience_description = ?, offer_description = ?
     WHERE id = ?`,
    [body.goal, proposal.sizeTier.pointMultiplier, startDate, endDate, body.audienceDescription?.trim() ?? "", body.offerDescription?.trim() ?? "", campaignId]
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
  return c.json({
    ...serialized,
    sizeTier: proposal.sizeTier,
    proposalTitle: proposal.proposalTitle,
    proposalNarrative: proposal.proposalNarrative,
    challenge: proposal.challenge,
    discountClamped: proposal.discountClamped,
    copyGeneratedByAi: proposal.copyGeneratedByAi,
  });
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
  const campaignId = await ensureCampaign(db, c.get("auth").sub);
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
