import { Hono } from "hono";
import type { Env } from "../types";
import { generateId, queryFirst, execute } from "../lib/db";
import { signJWT } from "../middleware/auth";
import { ensureCustomerCampaignCode } from "./customer";

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

    return c.json({ ok: true, message: "OTP sent (dev mode stub)" });
  } catch (err) {
    return c.json({ error: "Invalid request body" }, 400);
  }
});

authRouter.post("/verify-otp", async (c) => {
  try {
    const body = await c.req.json<{ phone?: string; otp?: string; role?: string; referralCode?: string }>();
    const { phone, otp, role, referralCode } = body;

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

      // Fold referral-code-at-signup handling into the OTP flow: creates the
      // customer's campaign code (if not already created) and links it to the
      // referrer's code when a valid, uncapped referralCode was supplied. Safe
      // to call on every login, not just first signup -- ensureCustomerCampaignCode
      // is a no-op past the first call for a given customer+campaign (existing
      // code short-circuits before the referral linking logic runs). No campaign
      // existing yet is not an error here; it's retried lazily on first profile
      // fetch (see ensureCustomerCampaignCode's docstring).
      await ensureCustomerCampaignCode(db, userId, referralCode?.trim() || undefined);
    } else if (role === "review_team") {
      // For review team, sub is phone or team member identifier
      userId = phone;
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
