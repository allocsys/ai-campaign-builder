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
  // stays blocked). VISION_PROVIDER picks the implementation; unset/unknown
  // -> getVisionProvider() returns null and scoring is silently skipped
  // (submission still lands in the manual-hold queue either way).
  // Each *_API_KEYS var is a COMMA-SEPARATED LIST -- one key is picked at
  // random per call, spreading load/quota across multiple keys for the same
  // provider (no shared counter/KV exists for strict round-robin yet).
  VISION_PROVIDER?: "openai" | "anthropic" | "google";
  VISION_OPENAI_API_KEYS?: string;
  VISION_OPENAI_MODEL?: string;
  VISION_ANTHROPIC_API_KEYS?: string;
  VISION_ANTHROPIC_MODEL?: string;
  VISION_GOOGLE_API_KEYS?: string;
  VISION_GOOGLE_MODEL?: string;
}
