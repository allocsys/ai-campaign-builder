// ============================================================================
// Shared config constants used across more than one app (frontend/frontend
// or frontend/backend). Anything defined here was previously hardcoded
// independently in two or more places -- same bug shape as the dead Gemini
// model names (fixed in PR #72): a value silently drifts in one spot while
// staying correct in another. Add new shared values here rather than
// hardcoding the same literal in a second file.
// ============================================================================

// Microsite subdomain placeholder (plan.md Open Item 3 -- real domain still
// undecided). Used by apps/business-owner (microsite preview text in
// MicrositeBuilderTab.tsx, display-only -- not a clickable link, so it's
// left showing the intended final shape even though it doesn't resolve yet).
// TODO: once Open Item 3 is decided, update this value AND flip
// MICROSITE_DOMAIN_LIVE to true below (then the dev branch in
// buildMicrositeJoinUrl can be deleted).
export const MICROSITE_DOMAIN = 'ourdomain.com';

// TEMPORARY (added 2026-09-13): no real domain purchased yet, so
// `{slug}.${MICROSITE_DOMAIN}` links don't resolve to anything live. Until
// Open Item 3 (real domain) is decided, this is false so
// buildMicrositeJoinUrl below builds working links against the actual
// deployed microsite Worker instead, using its existing `?business=`
// query-param dev fallback (see apps/microsite/app/routes/join.$slug.tsx --
// that route already supports this exact fallback for local/demo testing;
// this just also routes the real customer-facing referral link through it).
// Flip to true (and delete the `else` branch below) once a real domain is
// live and DNS/wrangler routes are configured.
export const MICROSITE_DOMAIN_LIVE = false;

// Real deployed microsite Worker URL (apps/microsite/wrangler.toml `name`),
// used only while MICROSITE_DOMAIN_LIVE is false.
const MICROSITE_DEV_WORKER_URL = 'https://ai-campaign-builder-microsite.pachoolai24.workers.dev';

/**
 * Builds a business's customer-facing join/referral link -- single source of
 * truth so apps/customer's referral link (and any future caller) stay in
 * sync, including the temporary dev-vs-live domain branching above. Once
 * MICROSITE_DOMAIN_LIVE is true this always returns the real subdomain URL;
 * until then it returns a link that actually resolves today.
 */
export function buildMicrositeJoinUrl(params: { micrositeSlug: string; joinSlug: string; ref?: string }): string {
  const { micrositeSlug, joinSlug, ref } = params;
  if (MICROSITE_DOMAIN_LIVE) {
    return `https://${encodeURIComponent(micrositeSlug)}.${MICROSITE_DOMAIN}/join/${encodeURIComponent(joinSlug)}${
      ref ? `?ref=${encodeURIComponent(ref)}` : ''
    }`;
  }
  const refQuery = ref ? `&ref=${encodeURIComponent(ref)}` : '';
  return `${MICROSITE_DEV_WORKER_URL}/join/${encodeURIComponent(joinSlug)}?business=${encodeURIComponent(micrositeSlug)}${refQuery}`;
}

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
