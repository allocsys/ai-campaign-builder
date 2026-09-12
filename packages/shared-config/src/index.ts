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
