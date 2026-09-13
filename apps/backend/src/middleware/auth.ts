import type { Context, Next } from "hono";
import { getJwtSecret } from "../lib/jwt-config";

export interface JWTPayload {
  sub: string;
  role: "business_owner" | "customer" | "review_team" | "staff" | "review_admin";
  // Only set for role: "staff" -- scopes the staff member to a single
  // business, since staff (unlike business_owner) can't imply their own
  // business from the identity row alone in the same way.
  businessId?: string;
  // Only set for role: "customer" (Open Item 13, Step A). Scopes the
  // customer's session to a single campaign, resolved once at OTP-verify
  // time from the join link's public_join_slug (or, for a returning
  // customer with no fresh join link, their most-recently-joined campaign --
  // see auth.ts's verify-otp and customer.ts's resolveCode). Replaces the
  // previous "always join whichever campaign was created first in the whole
  // DB" single-tenant guess -- see plan.md Open Item 13 for the full bug
  // history. A customer JWT issued before this field existed simply won't
  // have it; downstream code falls back to the same most-recent-campaign
  // lookup in that case rather than treating a missing claim as an error.
  campaignId?: string;
  // Only set for role: "review_admin". Distinguishes the env-configured root
  // admin (no review_admins row, sub is the env-configured username itself)
  // from a persisted review_admins row -- see plan.md "Admin JWT shape" and
  // "Root admin password mutability" decisions. Downstream code (the
  // self-service password-change endpoint) checks this to refuse root.
  isRoot?: boolean;
  iat: number;
  exp: number;
  [key: string]: unknown;
}

function base64UrlEncode(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return atob(base64);
}

async function getCryptoKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage
  );
}

export async function signJWT(payload: { sub: string; role: JWTPayload["role"]; businessId?: string; campaignId?: string; isRoot?: boolean }, secret: string, expiresInSeconds = 86400 * 7): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = {
    sub: payload.sub,
    role: payload.role,
    ...(payload.businessId ? { businessId: payload.businessId } : {}),
    ...(payload.campaignId ? { campaignId: payload.campaignId } : {}),
    ...(payload.isRoot !== undefined ? { isRoot: payload.isRoot } : {}),
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const key = await getCryptoKey(secret, ["sign"]);
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );

  const signature = base64UrlEncode(
    String.fromCharCode(...new Uint8Array(signatureBuffer))
  );

  return `${data}.${signature}`;
}

export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;

    const key = await getCryptoKey(secret, ["verify"]);
    
    // Decode signature
    let decodedSignature: Uint8Array<ArrayBuffer>;
    try {
      const binStr = base64UrlDecode(signature);
      decodedSignature = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        decodedSignature[i] = binStr.charCodeAt(i);
      }
    } catch {
      return null;
    }

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      decodedSignature,
      new TextEncoder().encode(data)
    );

    if (!isValid) return null;

    const payload: JWTPayload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function requireAuth(c: Context<{ Bindings: { JWT_SECRET?: string }; Variables: { auth: JWTPayload } }>, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized: Missing or malformed Authorization header" }, 401);
  }

  const token = authHeader.substring(7);
  const secret = getJwtSecret(c.env);

  const payload = await verifyJWT(token, secret);
  if (!payload) {
    return c.json({ error: "Unauthorized: Invalid or expired token" }, 401);
  }

  c.set("auth", payload);
  await next();
}
