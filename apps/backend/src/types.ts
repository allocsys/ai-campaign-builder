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

  // Vision scoring adapter (lib/vision.ts, Open Item 1) -- populates
  // task_submissions.ai_confidence_score, never auto-approve/reject (Item 5
  // stays blocked). Cascade order + which models to use live in
  // vision-cascade.config.ts, NOT in an env var (2026-09-11 change) -- these
  // vars just supply credentials per provider. A provider with no keys set
  // here is skipped by the cascade, not treated as an error (submission
  // still lands in the manual-hold queue with a null score either way).
  // Each *_API_KEYS var is a COMMA-SEPARATED LIST -- one key is picked at
  // random per call, spreading load/quota across multiple keys for the same
  // provider (no shared counter/KV exists for strict round-robin yet).
  VISION_OPENAI_API_KEYS?: string;
  VISION_ANTHROPIC_API_KEYS?: string;
  VISION_GOOGLE_API_KEYS?: string;
}
