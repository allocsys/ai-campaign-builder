// PBKDF2-SHA256 password hashing via Web Crypto's crypto.subtle -- available
// natively in the Cloudflare Workers runtime (same API middleware/auth.ts
// already uses for JWT signing), so this avoids pulling in a bcrypt/argon2
// WASM dependency for what plan.md's "Admin login mechanism" section decided
// should be hashed-by-default password storage (review_admins.password_hash,
// and the root admin's REVIEW_ADMIN_PASSWORD_HASH env var, both compared via
// the same verifyPassword() below).
//
// Encoded format: "pbkdf2$<iterations>$<saltBase64>$<hashBase64>" -- a
// self-describing string so the iteration count can be bumped later without
// invalidating already-stored hashes (verifyPassword reads it back out of
// the string rather than assuming a fixed constant).

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    HASH_BYTES * 8
  );
  return new Uint8Array(bits);
}

/** Hashes a plaintext password into the self-describing pbkdf2$... format. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

/**
 * Verifies a plaintext password against a stored pbkdf2$... hash. Used both
 * for review_admins.password_hash rows and for the root admin's
 * REVIEW_ADMIN_PASSWORD_HASH env var -- same format, same comparison, per
 * plan.md's "Root admin password storage" decision (one code path, not two).
 */
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  const salt = fromBase64(parts[2]);
  const expected = fromBase64(parts[3]);
  const actual = await pbkdf2(password, salt, iterations);

  if (actual.length !== expected.length) return false;
  // Constant-time comparison to avoid leaking hash-match progress via timing.
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
