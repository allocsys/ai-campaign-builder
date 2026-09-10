export interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  // Root review_admin identity, set via `wrangler secret put` (same pattern
  // as JWT_SECRET) -- never committed. REVIEW_ADMIN_PASSWORD_HASH holds a
  // pre-computed pbkdf2$... hash (see lib/password.ts), not a plaintext
  // password, per plan.md's "Root admin password storage" decision. This
  // identity has no review_admins row; it's checked directly in
  // routes/review-admin.ts.
  REVIEW_ADMIN_USERNAME?: string;
  REVIEW_ADMIN_PASSWORD_HASH?: string;
}
