import { Hono } from "hono";
import type { Env } from "../types";
import { generateId, queryFirst, execute } from "../lib/db";
import { signJWT } from "../middleware/auth";
import { ensureCustomerCampaignCode, resolveCampaignByJoinSlug } from "./customer";

const authRouter = new Hono<{ Bindings: Env }>();

// ============================================================================
// DEV-MODE OTP STUBS
// Fixed dev OTP codes matching frontend mock conventions:
// - business_owner: 7712
// - customer: 5432
// - review_team: 9911
// - staff: 3321
// NOTE: This is a dev-mode stub (no real SMS delivery/verification). To be replaced
// when a real SMS/OTP provider is wired in via production configuration.
// ============================================================================

const DEV_OTPS: Record<string, string> = {
  business_owner: "7712",
  customer: "5432",
  review_team: "9911",
  staff: "3321",
};

authRouter.post("/request-otp", async (c) => {
  try {
    const body = await c.req.json<{ phone?: string; role?: string }>();
    const { phone, role } = body;

    if (!phone || !role) {
      return c.json({ error: "Missing required fields: phone and role" }, 400);
    }

    if (!["business_owner", "customer", "review_team", "staff"].includes(role)) {
      return c.json({ error: "Invalid role specified" }, 400);
    }

    // TODO: Wire real SMS provider gateway here in production
    // For now, in dev mode, the mock OTP is statically known (e.g., 7712 / 5432 / 9911).
    console.log(`[DEV OTP] Requested for phone ${phone} with role ${role}. Dev OTP is: ${DEV_OTPS[role]}`);

    // TEMPORARY (dev-mode only, remove once a real SMS provider is wired in):
    // echo the OTP back in the response so a live human tester can complete
    // OTP verification (e.g. Open Item 13, Step E part 2) without server/log
    // access -- there is no real SMS being sent today either way, so this
    // doesn't weaken anything that currently exists.
    return c.json({ ok: true, message: "OTP sent (dev mode stub)", devOtp: DEV_OTPS[role] });
  } catch (err) {
    return c.json({ error: "Invalid request body" }, 400);
  }
});

authRouter.post("/verify-otp", async (c) => {
  try {
    const body = await c.req.json<{ phone?: string; otp?: string; role?: string; referralCode?: string; joinSlug?: string }>();
    const { phone, otp, role, referralCode, joinSlug } = body;

    if (!phone || !otp || !role) {
      return c.json({ error: "Missing required fields: phone, otp, role" }, 400);
    }

    if (!["business_owner", "customer", "review_team", "staff"].includes(role)) {
      return c.json({ error: "Invalid role specified" }, 400);
    }

    const expectedOtp = DEV_OTPS[role];
    if (otp !== expectedOtp) {
      return c.json({ error: "Invalid OTP code" }, 401);
    }

    const db = c.env.DB;
    let userId = "";
    let staffBusinessId: string | undefined;
    // Only ever set for role: "customer" -- resolved below, from joinSlug if
    // present, else left undefined and customer.ts's resolveCode() falls
    // back to the customer's most-recently-joined campaign at request time
    // (see Open Item 13, Step A). Embedded in the issued JWT so subsequent
    // requests don't need to re-resolve it.
    let customerCampaignId: string | undefined;

    if (role === "business_owner") {
      // Look up or create business by phone
      let business = await queryFirst<{ id: string }>(
        db,
        "SELECT id FROM businesses WHERE phone = ?",
        [phone]
      );

      if (!business) {
        userId = generateId();
        // For default category, pick the first category from business_categories or create one if empty
        let cat = await queryFirst<{ id: string }>(db, "SELECT id FROM business_categories LIMIT 1");
        let categoryId = cat?.id;

        if (!categoryId) {
          categoryId = generateId();
          const nowIso = new Date().toISOString();
          await execute(
            db,
            "INSERT INTO business_categories (id, slug, name_fa, active, created_at) VALUES (?, ?, ?, 1, ?)",
            [categoryId, "coffee_shop", "کافی‌شاپ/کافه", nowIso]
          );
        }

        const nowIso = new Date().toISOString();
        await execute(
          db,
          `INSERT INTO businesses (id, name, category_id, phone, phone_verified, phone_verified_at, sms_wallet_balance_toman, autopilot_enabled, size_tier, created_at)
           VALUES (?, ?, ?, ?, 1, ?, 0, 0, 'small', ?)`,
          [userId, "کسب‌وکار جدید", categoryId, phone, nowIso, nowIso]
        );
      } else {
        userId = business.id;
        await execute(db, "UPDATE businesses SET phone_verified = 1, phone_verified_at = ? WHERE id = ?", [new Date().toISOString(), userId]);
      }
    } else if (role === "customer") {
      // Look up or create customer by phone_number
      let customer = await queryFirst<{ id: string }>(
        db,
        "SELECT id FROM customers WHERE phone_number = ?",
        [phone]
      );

      if (!customer) {
        userId = generateId();
        const nowIso = new Date().toISOString();
        await execute(
          db,
          "INSERT INTO customers (id, phone_number, phone_verified, phone_verified_at, telegram_opted_in, created_at) VALUES (?, ?, 1, ?, 0, ?)",
          [userId, phone, nowIso, nowIso]
        );
      } else {
        userId = customer.id;
        await execute(db, "UPDATE customers SET phone_verified = 1, phone_verified_at = ? WHERE id = ?", [new Date().toISOString(), userId]);
      }

      // Multi-tenant join (Open Item 13, Step A): a joinSlug in the request
      // body (threaded from the microsite's /join/:slug handoff, see Step B)
      // resolves to a specific campaign to join -- replaces the previous
      // "always join whichever campaign was created first in the whole DB"
      // guess. An unresolvable/stale slug fails loudly (400) rather than
      // silently landing the customer in some other business's campaign.
      const trimmedJoinSlug = joinSlug?.trim();
      if (trimmedJoinSlug) {
        const resolved = await resolveCampaignByJoinSlug(db, trimmedJoinSlug);
        if (!resolved) {
          return c.json({ error: "Invalid or expired join link" }, 400);
        }
        customerCampaignId = resolved.id;
      }

      // Fold referral-code-at-signup handling into the OTP flow: creates the
      // customer's campaign code (if not already created) and links it to the
      // referrer's code when a valid, uncapped referralCode was supplied. Safe
      // to call on every login, not just first signup -- ensureCustomerCampaignCode
      // is a no-op past the first call for a given customer+campaign (existing
      // code short-circuits before the referral linking logic runs).
      //
      // No joinSlug given (returning customer opening the app directly, or an
      // old link predating Step B): fall back to their most-recently-joined
      // campaign, same lookup customer.ts's resolveCode() uses for an
      // already-authenticated request. A genuinely brand-new customer with
      // neither a joinSlug nor any existing campaign code has no campaign to
      // resolve here -- customerCampaignId stays undefined, and per Step D
      // below this now fails the request outright (400) rather than issuing
      // a JWT that would just 404 on every later request.
      if (!customerCampaignId) {
        const mostRecent = await queryFirst<{ campaign_id: string }>(
          db,
          "SELECT campaign_id FROM customer_campaign_codes WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1",
          [userId]
        );
        customerCampaignId = mostRecent?.campaign_id;
      }

      // Open Item 13, Step D: a customer with neither a joinSlug (fresh
      // signup, no ?join= link used) nor any existing customer_campaign_codes
      // row (a genuine first-ever signup, as opposed to a returning customer
      // whose campaign code lookup above already resolved something) has no
      // campaign to land in. Decided 2026-09-12: reject loudly here rather
      // than issuing a JWT with no campaignId claim -- the previous behavior
      // let the customer "log in" successfully only to hit a wall of 404s on
      // every subsequent request, which is a worse experience than a clear
      // failure at the OTP step itself. A returning customer (existing row
      // above) is unaffected -- this only blocks a first-ever signup with no
      // join link, matching the "join link required to sign up" decision.
      if (!customerCampaignId) {
        return c.json({ error: "برای عضویت، لطفاً از لینک مخصوص عضویت کسب‌وکار خود استفاده کنید." }, 400);
      }

      await ensureCustomerCampaignCode(db, userId, customerCampaignId, referralCode?.trim() || undefined);
    } else if (role === "review_team") {
      // Review-team signup is invite-only, exactly like staff below: a
      // review_admin must have already registered this phone (via
      // POST /api/review-admin/team-members) before it can complete OTP
      // verification. Previously this branch set userId = phone directly
      // with no roster lookup at all -- any phone number could authenticate
      // as review_team, with no access control and no real per-person
      // identity for the reviewed_by/resolved_by audit trail. Fixed per
      // plan.md Open Item 6.
      const reviewer = await queryFirst<{ id: string; active: number }>(
        db,
        "SELECT id, active FROM review_team_members WHERE phone = ?",
        [phone]
      );

      if (!reviewer) {
        return c.json({ error: "This phone has not been registered as a review-team member by an admin. Ask an admin to add you first." }, 403);
      }
      if (!reviewer.active) {
        return c.json({ error: "This review-team account has been deactivated." }, 403);
      }

      userId = reviewer.id;
      await execute(db, "UPDATE review_team_members SET phone_verified = 1, phone_verified_at = ? WHERE id = ?", [new Date().toISOString(), userId]);
    } else if (role === "staff") {
      // Staff signup is invite-only: a business owner must have already
      // registered this phone against their business (via
      // POST /api/business/staff) before it can complete OTP verification.
      // Unlike business_owner/customer, we do NOT auto-create a staff row
      // here -- doing so would let anyone self-serve a staff identity for
      // an unknown/unassigned business, defeating the accountability and
      // least-privilege reasons this table exists.
      const staff = await queryFirst<{ id: string; business_id: string; active: number }>(
        db,
        "SELECT id, business_id, active FROM staff WHERE phone = ?",
        [phone]
      );

      if (!staff) {
        return c.json({ error: "This phone has not been registered as staff by a business. Ask your business owner to add you first." }, 403);
      }
      if (!staff.active) {
        return c.json({ error: "This staff account has been deactivated." }, 403);
      }

      userId = staff.id;
      staffBusinessId = staff.business_id;
      await execute(db, "UPDATE staff SET phone_verified = 1, phone_verified_at = ? WHERE id = ?", [new Date().toISOString(), userId]);
    }

    const secret = c.env.JWT_SECRET || "default-dev-secret-key-change-in-production";
    const token = await signJWT(
      {
        sub: userId,
        role: role as "business_owner" | "customer" | "review_team" | "staff",
        ...(staffBusinessId ? { businessId: staffBusinessId } : {}),
        ...(customerCampaignId ? { campaignId: customerCampaignId } : {}),
      },
      secret
    );

    return c.json({
      ok: true,
      token,
      user: {
        id: userId,
        phone,
        role,
        ...(staffBusinessId ? { businessId: staffBusinessId } : {}),
      },
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return c.json({ error: "Internal server error during verification" }, 500);
  }
});

export { authRouter };
