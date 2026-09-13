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
  // lib/ai-models.config.ts (shared with campaign-generator.ts, consolidated
  // 2026-09-12), NOT in an env var (2026-09-11 change) -- these vars just
  // supply credentials per provider. A provider with no keys set
  // here is skipped by the cascade, not treated as an error (submission
  // still lands in the manual-hold queue with a null score either way).
  // Each *_API_KEYS var is a COMMA-SEPARATED LIST -- one key is picked at
  // random per call, spreading load/quota across multiple keys for the same
  // provider (no shared counter/KV exists for strict round-robin yet).
  VISION_OPENAI_API_KEYS?: string;
  VISION_ANTHROPIC_API_KEYS?: string;
  VISION_GOOGLE_API_KEYS?: string;

  // Evidence storage (lib/storage.ts) -- backs task_submissions.evidence_url
  // with a real uploaded file, per plan.md's "Evidence storage provider"
  // decision (Backblaze B2). All four required together for uploads to
  // work; if any is unset, POST /api/customer/evidence-upload returns 503
  // rather than a silent no-op (unlike VISION_*, an evidence upload is a
  // user-initiated action expecting a direct success/failure response, not
  // a background best-effort call). B2_BUCKET_ID/B2_BUCKET_NAME are two
  // separate identifiers B2 itself requires (the API takes the id, public
  // download URLs are built from the name) -- both come from the B2
  // dashboard when the bucket is created. The bucket must be created with
  // public-read access so vision.ts and Review Console can fetch/display
  // the resulting URLs with no auth.
  B2_KEY_ID?: string;
  B2_APPLICATION_KEY?: string;
  B2_BUCKET_ID?: string;
  B2_BUCKET_NAME?: string;

  // Chat-history storage for lib/campaign-agent.ts's multi-turn NL
  // campaign-editing flow (plan.md Open Item 20 Part A/B). Workers KV,
  // decided over Durable Objects/a new D1 table -- see plan.md's "Chat
  // history storage" decision. Keyed `chat:{campaignId}:{sessionId}`, short
  // TTL (CHAT_HISTORY_TTL_SECONDS in routes/business.ts) so old sessions
  // self-clean with no manual cleanup job. Not optional/skippable the way
  // VISION_*/B2_* are -- routes/business.ts's POST /campaign/chat can't
  // hold a multi-turn conversation without it.
  CHAT_HISTORY: KVNamespace;
}
