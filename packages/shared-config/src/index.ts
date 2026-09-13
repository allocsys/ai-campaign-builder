// ============================================================================
// Shared config constants used across more than one app (frontend/frontend
// or frontend/backend). Anything defined here was previously hardcoded
// independently in two or more places -- same bug shape as the dead Gemini
// model names (fixed in PR #72): a value silently drifts in one spot while
// staying correct in another. Add new shared values here rather than
// hardcoding the same literal in a second file.
// ============================================================================

// Microsite subdomain placeholder (plan.md Open Item 3 -- real domain still
// undecided). Used by apps/customer (referral link building in
// CustomerHome.tsx) and apps/business-owner (microsite preview text in
// MicrositeBuilderTab.tsx). TODO: replace this one value once Open Item 3 is
// decided -- both call sites will pick it up automatically.
export const MICROSITE_DOMAIN = 'ourdomain.com';

// Accepted evidence upload formats -- matches what a phone camera/screenshot
// realistically produces. apps/backend/src/lib/storage.ts uses the
// mime-type -> file-extension mapping to name the uploaded B2 object;
// apps/customer/src/routes/TaskSubmitModal.tsx uses the mime-type list for
// the file input's `accept` attribute. Both are derived from this one map
// so the two stay in sync automatically.
export const EVIDENCE_MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const EVIDENCE_ACCEPTED_MIME_TYPES = Object.keys(EVIDENCE_MIME_TO_EXTENSION);

// ----------------------------------------------------------------------------
// Business-rule thresholds. These were previously redeclared independently
// in apps/backend/src/routes/customer.ts, apps/backend/src/routes/review.ts,
// and duplicated a second time as hardcoded numbers baked into Persian
// display copy in apps/customer/src/routes/RetroClaimModal.tsx -- exactly
// the "same value drifts in one spot, stays correct in another" bug shape
// this file already exists to prevent. Add new thresholds here, not as a
// new file.
// ----------------------------------------------------------------------------

// Retroactive purchase claim rules (apps/backend/src/routes/customer.ts
// POST /retro-claims). RetroClaimModal.tsx interpolates both of these into
// its rejection-reason copy instead of hardcoding "۷۲"/"۳" a second time.
export const RETRO_CLAIM_MAX_HOURS = 72;
export const RETRO_CLAIM_RATE_LIMIT = 3;

// Referral anomaly detection (apps/backend/src/routes/review.ts): velocity
// = more than this many referred signups in 24h; dead-referral = at least
// this many referred signups older than 7 days with zero approved
// task_submissions. Same thresholds are described in prose in
// architecture.md and plan.md -- those aren't code, so they're not wired up
// here, but keep them in sync by hand if either number changes.
export const REFERRAL_VELOCITY_THRESHOLD = 5;
export const DEAD_REFERRAL_THRESHOLD = 5;

// Reward redemption code validity window (apps/backend/src/routes/customer.ts
// POST /rewards/:id/redeem).
export const REDEMPTION_CODE_EXPIRY_MS = 5 * 60 * 1000;
