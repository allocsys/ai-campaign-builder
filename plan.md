# AI Campaign Builder — Plan

## Positioning
> Tell us your goal. AI builds the campaign.
> (فارسی: هدفت رو بگو؛ کمپینت رو بساز.)

No separate MVP — going straight to the full/main version.

---

## Current Status (as of 2026-09-10)

**All 5 apps + backend are built, deployed, and wired end-to-end.** Full frontend↔backend integration (Phase 5's "Frontend-to-backend wiring" effort) is complete for all four dashboard personas:

| Persona | Backend routes | Frontend wired | Auth | Live-verified |
|---|---|---|---|---|
| Business Owner | `apps/backend/src/routes/business.ts` (PR #27) | PR #28 | phone+OTP | ✅ per user |
| Customer | `routes/customer.ts` (PR #29) | PR #29, PR #35 | phone+OTP (+referral code, consumed server-side at signup since PR #35) | ✅ per user |
| Staff POS | `routes/staff-pos.ts` (PR #30) | PR #30 | phone+OTP, `role: 'staff'` — **supersedes** the earlier shared-device-PIN decision (see Phase 0.5) | ✅ per user |
| Review Console | `routes/review.ts` (PR #32) | PR #32 | phone+OTP per team member | ✅ confirmed 2026-09-11 (browser screenshot: login, empty review queue, referral-detection batch run) |

Business Owner also gained a **Staff management tab** (PR #31) to register/toggle staff phone numbers against the staff-pos auth backend, and an **editable profile form** (PR #33 — name + SMS wallet monthly cap) replacing the old read-only Settings view.

Referral code at signup (PR #35) is now fully wired end-to-end: the customer app's `verifyOtp` sends the entered referral code to the backend, which links `customer_campaign_codes.referred_by_code_id` via the existing `ensureCustomerCampaignCode` helper — closing the gap flagged in PR #29.

Microsite (`apps/microsite`) is a separate SSR app — **now backend-backed** (PR #36, merged 2026-09-11): real per-template content for all 6 v1 businesses is seeded in D1 and served via a new unauthenticated `GET /api/public/microsites/:slug` route on `apps/backend`, reached over a Cloudflare service binding (no owner/customer auth applies to the microsite itself, matching its public nature). `campaigns.goal` now reaches the CTA as goal-driven badge copy. All 6 v1 business-category templates + platform landing page are live. `/join/:slug` is a real route (PR #23) handing off to the customer app.

`apps/deploy-index` is a temporary static directory page linking all deployed Workers, pending a real domain purchase.

Dev-only auth-bypass buttons (PR #22) were added to all 4 dashboard apps during the mock-data phase; **all have since been removed** — review-console in PR #32, business-owner + customer in PR #34, and staff-pos never carried it forward (PR #30 replaced its whole auth flow). All 4 dashboard apps are now real-OTP-only with no shortcut login path in code.

Full build history (mockup phase → monorepo restructure → per-persona scaffolds → a11y/perf pass → backend scaffold → per-persona backend wiring) is preserved in git history / PR descriptions (#2 through #32) rather than narrated here — this doc previously carried a long inline changelog that duplicated that history and had gone stale; trimmed 2026-09-11.

---

## Phase 0 — Onboarding & Campaign Generation

### Core questions (universal)
1. کسب‌وکارت چیه؟
2. هدفت چیه؟ (acquisition / retention)
3. مخاطبت کیه؟
4. چه چیزی می‌تونی به مشتری بدی؟

### Conditional question (per business category, deterministic — not AI-generated)
| Business type | Conditional question |
|---|---|
| Coffee shop / cafe | مشتری بیشتر حضوریه یا آنلاین/دلیوری؟ |
| Clothing store | فروش فصلی داری یا کالای همیشگی؟ |
| Restaurant | تمرکز روی سفارش مجدد یا تجربه حضوری؟ |
| Online store | چرخه خرید تکراریه یا یک‌بار مصرف؟ |
| Gym / fitness | هدف نگه‌داشتن مشتری قدیمیه یا جذب جدید؟ |
| Beauty clinic | خدمات یک‌باره یا پکیج/دوره‌ای؟ |

**v1 business categories (6):** کافی‌شاپ/کافه، فروشگاه لباس/پوشاک، رستوران/فست‌فود، فروشگاه آنلاین (غیر پوشاک)، باشگاه/سالن ورزشی، کلینیک زیبایی.

### Output: AI Campaign proposal
Goal/duration/audience (auto-filled) + weighted tasks + weighted rewards + one Challenge. Two actions: **Launch** / **Edit**.

### Post-launch guidance (decided 2026-09-08)
"Next Steps" checklist card on Dashboard (auto-hides once complete; per-business, not per-campaign), 2 auto-detected items: AI constraints saved (Settings), ≥1 contact imported. Empty-state copy (not blank grids) in Insights/Suggestions tabs until real data exists. No guided tour. See architecture.md `onboarding_checklist_items` / `business_checklist_progress`.

---

## Phase 0.5 — Attribution & Tracking Mechanism

### Personal customer code
Every joined customer gets a unique personal code/QR, reused across all tracking below.

### Verification per task type
| Task type | Verification method |
|---|---|
| Follow | Screenshot → AI vision review |
| Share/Story | Personal code embedded in post + screenshot → AI checks both |
| Referral | Personal code/link at signup → auto-linked, no manual check |
| Purchase | Staff scans/enters code at POS |

### Retroactive purchase claim (fallback for missed POS scan)
Customer uploads receipt photo/screenshot afterward. Rules: 48–72hr submission window, receipt-hash duplicate detection, rate-limited per customer, stricter/more cautious AI confidence threshold than a live POS scan. **Implemented server-side** in `routes/customer.ts`'s `POST /retro-claims` (PR #29) — the three rejection reasons (`outside_time_window`/`duplicate_receipt`/`rate_limited`) come back in the API response, not re-derived client-side.

### Point expiry & carryover
2-day grace period after campaign end (full balance access). After grace: 70% forfeited, 30% carried over as a credit tied to customer+business, auto-applied as a starting bonus when they join that business's next campaign. Carryover itself has no separate expiry once granted.

### Referral abuse prevention
1. OTP phone verification at signup (all customers, not referral-specific).
2. Referral points stay Pending until the referred customer's first purchase (not just signup).
3. Cap: max 10 referrals counted per referrer per campaign.
4. Anomaly detection (rule-based, advisory-only, daily batch job → `referral_flags`): velocity rule (>5 new referred signups/24h) and dead-referral-ratio rule (≥5 referred customers, >7 days old, 0 purchases). Flags never auto-block — human review only. **Implemented** in `routes/review.ts` (PR #32): live-computed aggregates + persisted flags with dedup, reviewed via the Review Console.

### Reward redemption fulfillment
Separate one-time, short-lived (5–10 min) redemption code/QR generated on Redeem tap — distinct from the standing personal code, scanned via a dedicated "Fulfill Reward" POS action. **Note (PR #30):** points are deducted at redeem-time in the customer app, not at fulfill-time in staff-pos — fulfill only flips `reward_redemptions.status`.

### POS-side UX
Staff device: web app (PWA), the only client for v1 (no native app) — backend built API-first so a native client can be added later without backend rework. Code entry: QR primary, short numeric backup code always shown as fallback.

**Staff authentication — REVISED (2026-09-10, supersedes the 2026-09-09 decision below):** implemented as **per-staff phone + SMS OTP** (`role: 'staff'`, same OTP mechanism as the other 3 personas), not a shared device PIN. This was a build-time change from the original decision — it gives per-staff audit identity for free (the exact thing the original PIN decision flagged as a future revisit) and lets Business Owner manage individual staff phone numbers (PR #31) rather than a single device-level secret. The original PIN rationale is kept below for history but is **no longer accurate to the implementation**.

<details>
<summary>Original 2026-09-09 decision (superseded)</summary>

Shared device PIN, not per-staff phone+OTP. One PIN unlocks the whole POS device for a shift; whoever is at the counter uses the same PIN — simpler for a shop counter tablet than individual staff logins. Chosen over per-staff phone+OTP (unnecessary friction for a shared counter device) and over no-auth-at-all. PIN would have been device/business-scoped, not tied to an individual staff identity.
</details>

### AI review decision system
Three-tier outcome per AI-reviewed submission: auto-approve (high confidence) / auto-reject (low confidence, resubmit allowed) / manual hold (uncertain). Central team reviews uncertain cases initially (move to per-business review later). Points stay **Pending** until final approval. Offline: staff-side queue stores locally, final verification/dedup happens server-side once synced. **Note:** `ai_confidence_score` is read by Review Console but nothing currently populates it — no real AI scoring pipeline exists yet; auto-approve/auto-reject tiers are not yet implemented, only the manual-hold path (Review Console) is live.

**Scoring approach — decided 2026-09-11 (addresses Open Item 1):** a real **vision API call** (multimodal model call per submission, e.g. "does this screenshot show X") populates `ai_confidence_score`, over the two alternatives considered — rule-based/heuristic scoring (image hash + metadata checks: free and fast but too weak a signal to safely gate auto-approve/auto-reject) and staying manual-only for v1 (honest about current state but leaves Open Item 5 permanently blocked). Chosen for accuracy given that a wrong auto-approve/auto-reject has direct point/money consequences for the business.

**Pipeline built 2026-09-11, PR #39 (merged, commit `bc8040d`):** `apps/backend/src/lib/vision.ts` — a **provider adapter**, per a side-note request to support both swapping providers and rotating keys within one provider: `VISION_PROVIDER` env var picks `openai` / `anthropic` / `google` (all three implement one `VisionProvider` interface — fetch evidence image → base64 → multimodal call → parse `{confidence, reasoning}` JSON from the response); each provider's `*_API_KEYS` env var is a **comma-separated list**, with one key chosen at random per call to spread load/quota (random rather than round-robin since Workers have no cheap shared per-request counter — no KV/DO binding exists for this). Wired into `routes/customer.ts`'s `POST /tasks/:id/submit`: fires via `c.executionCtx.waitUntil(...)` after the submission row is inserted (so the multimodal call doesn't hold up the customer's response), only for `screenshot_ai`-verified tasks with a real `evidenceUrl`. On any failure (provider unconfigured, fetch error, malformed model response) the error is logged and `ai_confidence_score` simply stays null — identical to today's behavior, never a hard failure of the submit request. `types.ts`/`wrangler.toml`/`deploy.yml` updated to match the `REVIEW_ADMIN_*` secret-handling convention exactly (optional, pushed independently if set, guard inside `run:` never a step `if:`).

**Not yet done:** no `VISION_*` repo secrets have actually been generated/set — the pipeline exists but is not yet enabled in production, so every submission today still gets `ai_confidence_score = NULL` exactly as before, until a provider + key(s) are chosen and configured. Cost-per-call/latency budget still not evaluated. No threshold bands defined for auto-approve/auto-reject/hold (that design is Open Item 5, and stays blocked until this pipeline has real score distributions to threshold against). File upload/storage for `evidence_url` also remains a pre-existing gap (`TaskSubmitModal.tsx` is still filename-placeholder-only) — scoring silently no-ops without a real evidence URL to fetch.

**Evidence storage provider — decided 2026-09-11 (addresses the `evidence_url` gap above, independently of the `VISION_*` key question):** **Backblaze B2** (S3-compatible object storage) will back customer-submitted task evidence photos/screenshots. Considered against two alternatives: **Cloudflare R2** (rejected — despite being the most natural fit for an already-all-Cloudflare stack, activating R2 requires adding a payment method to the Cloudflare account first, even to stay within its free tier, and that's not available here) and **Neon Object Storage** (rejected — still in beta with GA pricing not yet published, and using it would mean standing up a new Neon project with no other relationship to this app, which runs its actual database on Cloudflare D1, not Neon). B2 was chosen for its permanent, stable-pricing free tier (10 GB storage, no credit card required to sign up) and its S3-compatible API, which keeps the upload code roughly the same shape it would have been for R2.

**Built and merged 2026-09-11, PR #41 (squash commit `01be526`):** `apps/backend/src/lib/b2.ts` — native B2 API adapter (no SigV4 needed). `POST /api/customer/evidence-upload` (new route, backed by B2) accepts raw file bytes and returns a real `evidence_url`. Client-side: `uploadEvidence()` posts to the new endpoint, `TaskSubmitModal.tsx` is wired to the real upload (no longer filename-placeholder-only), and the real `evidenceUrl` now flows through to `submitTask`. `wrangler.toml`/`deploy.yml` updated to match the `REVIEW_ADMIN_*`/`VISION_*` secret-handling convention exactly (optional post-deploy step pushing `B2_*` secrets, no-ops via bash `-z` check if unset). CI green on the PR (all per-app typecheck/test jobs passed, `backend-migrate` correctly skipped — no migration files touched).

**Design revised 2026-09-11 — public bucket swapped for private bucket + server-side proxy:** attempting to actually create the B2 bucket in the dashboard as *public* hit a requirement to add a payment method first. Rather than pay to unblock a public bucket, the design changed to a **private bucket with server-side proxied downloads** — no public URL is ever exposed. `lib/storage.ts`'s `UploadedEvidence` now returns `{ key }` (not `{ url, fileName }`), and a new `downloadEvidenceImage(env, key)` re-authorizes against B2 and does an authenticated GET for any server-side caller. `vision.ts`'s `scoreTaskSubmission` now takes `evidenceKey` and fetches bytes via `downloadEvidenceImage` instead of a raw public `fetch`. `customer.ts`'s `/evidence-upload` still returns a field named `evidenceUrl` (unchanged downstream contract/DB column name), but the value is now an opaque storage key, not a URL. A new authenticated `GET /submissions/:id/evidence` route on `routes/review.ts` proxies the private download back to the Review Console (prep plumbing only — the frontend doesn't call it yet, still shows the raw key as plain text). **Built on branch `feature/b2-private-bucket-proxy`, opened as PR #42, CI green — not yet merged.**

**Not yet done:** no `B2_*` repo secrets (bucket/application key) actually set, so the endpoint exists but every real upload will fail until those are configured — same status as the `VISION_*` keys. PR #42 also still needs to be merged.

### Review Console authentication (decided 2026-09-09, implemented as designed)
Each central-team member authenticates with their own phone + SMS OTP, giving the audit log (`reviewed_by` on submissions, resolver identity referenced conceptually) a per-person identity. **Note:** in the current implementation `reviewed_by`/`resolved_by` are still written as fixed strings (`'central_team'`) rather than the authenticated member's own identity — the OTP login is real, but per-person attribution in the audit trail itself is not yet wired through. Would need a schema change or audit-log table (see architecture.md open items).

**Resolution approach — decided 2026-09-11 (addresses Open Item 2, decision only, not yet implemented):** add a real **foreign key** — `task_submissions.reviewed_by_user_id` / `referral_flags.resolved_by_user_id` — referencing whichever identity table backs OTP logins for central-team members, replacing the fixed `'central_team'`/`'business_owner'`/`'staff'` strings entirely. Chosen over a separate append-only audit-log table (rejected: would leave two sources of truth for "who reviewed this") and over leaving it as-is (rejected: real per-person accountability matters once more than one central-team member is active, not just once it becomes a scaling problem). Not yet built: no migration written, and it's not yet decided which existing table the FK should point at — central-team members currently only exist as OTP-verified phone numbers (`role: 'central_team'` on the auth subject), with no dedicated roster/identity table of their own yet; that table (or a repurposing of an existing one) would need to exist before the FK can be added.

**Identity table — decided 2026-09-11:** a new **`review_team_members` roster table** (id, name, phone, phone_verified, active, created_at), modeled directly on the existing `staff` table (same shape, same invite-only pattern) — chosen over a more general `platform_users`/permissions table, since nothing in this plan calls for tiers or granular permissions within the central team (it's one flat `review_team` role, no lead/reviewer distinction). This becomes the FK target for the `reviewed_by_user_id`/`resolved_by_user_id` columns above.

**Security finding surfaced while scoping this (2026-09-11, not yet fixed):** unlike `staff`'s OTP verification in `apps/backend/src/routes/auth.ts` (invite-only — a business owner must register the phone first via `POST /api/business/staff`, and unknown/deactivated phones are rejected with 403), `review_team`'s OTP verification currently has **no roster check at all** — `verify-otp` sets `userId = phone` directly with no row lookup, so any phone number that completes OTP with `role: 'review_team'` is granted access, with no accountability *or* access control today. **Decided 2026-09-11: `review_team_members` will be invite-only**, mirroring `staff` exactly (a business owner or admin registers the phone first; unknown/deactivated phones are rejected at OTP verification) — not just a plain audit-only lookup table, since the access-control gap is real and closing it costs no extra migration/route effort beyond what Item 2 already requires. Flagged as a separate Open Item (6) rather than folded into Item 2, since it's an access-control fix, not just an audit-trail one.

**Who registers a new review-team phone — decided 2026-09-11:** a **minimal admin role on top of `review_team`** — some review-team members can register/deactivate others, self-service within the team — over a hardcoded/seeded phone list (rejected: every new hire needs a manual migration) or leaving it to direct DB access only (rejected: doesn't scale past one operator, and isn't really "invite-only" without an in-product way to invite).

**Admin storage + bootstrap — decided 2026-09-11:** a **separate `review_admin` role with its own login route**, not a boolean flag on `review_team_members` — keeps the regular `review_team` OTP path (and the `review_team_members` invite-only check) completely untouched by admin logic. The root admin's credentials are **env-configured**, not a seeded `review_team_members` row — this is what actually solves the bootstrap problem: the very first admin can't be invited by anyone (there's no one to invite them), so checking against env config sidesteps the roster table entirely for that one identity, rather than needing a special hardcoded first-row hack inside the same table meant to be invite-only for everyone else.

**Admin login mechanism — decided 2026-09-11:** **username + password**, not phone+OTP — a deliberate departure from every other persona's auth (business_owner/customer/staff/review_team all use phone+SMS OTP). The root admin's username/password are env-configured secrets (e.g. `ADMIN_USERNAME`/`ADMIN_PASSWORD` or a hash thereof), checked directly by the new admin login route rather than against any DB table. Not yet decided: exact env var names, whether the password is stored as a plaintext env value or a hash the route compares against (hashing is the safer default and should be assumed unless there's a reason not to), and whether this login issues the same JWT shape (`signJWT`) the other personas use or something admin-specific.

**Admin scope + UI — decided 2026-09-11, supersedes the earlier "v1 assumes a single main admin" note:** a **dedicated new UI on a new route** (see "Where it lives" below), giving the admin **full access** to (a) register/deactivate `review_team_members` rows (the reviewer roster) and (b) **add/remove other admins** — meaning multiple admins are now in scope, not just the one root env-configured admin. This implies a persisted admins table beyond the single env-configured identity (working name: `review_admins` — id, username, password_hash, created_at, created_by), where the env-configured root admin is the bootstrap identity and can create further rows in that table through the new UI. The one confirmed user of this UI for now is the person making these decisions. **Where it lives — decided 2026-09-11:** a new page/route inside the existing `apps/review-console` app, gated by the `review_admin` role — not a separate app/Worker, since review-console is already the managerial surface for this persona (a separate app was considered, for the isolation benefit of a review-queue bug never being able to touch admin routes, but rejected as more app-sprawl than warranted here).

**Non-root admin login — decided 2026-09-11:** admins created via the UI (beyond the root env-configured one) get their **own username+password issued at creation time**, stored in `review_admins`, over the alternative of reusing the shared env-configured root credentials — a shared credential can't be individually revoked or attributed once more than one admin exists, which defeats the point of having a `created_by` column at all. This confirms `review_admins.password_hash` is a real, populated column for every row (not just a schema placeholder for the root identity).

**Password change — decided 2026-09-11:** admins can change their own password after login via **self-service, optional, any time** — not forced on first login. Chosen over a mandatory-rotation gate (rejected: adds a forced-flow/interstitial for a low-stakes internal tool with one confirmed user today) since nothing about the issuance process (creator sets/generates it, delivery channel TBD) was judged risky enough to require immediate rotation. Implies a `PATCH`-style self-service password-change endpoint (current password + new password, authenticated as self) is in scope alongside the admin-management endpoints — not yet built.

**Root admin password mutability — decided 2026-09-11:** the root admin's password **stays permanently fixed to the env vars** — no self-service change, no persisted override row — over letting root use the same change-password endpoint (rejected: would need a persisted row just for that one identity, undermining the whole point of keeping root env-config-only and outside the DB; a stray override row would also create two competing sources of truth for "what is root's password" if the env var were ever updated separately). Rotating root's password is a deploy-time operation (update the env var/secret and redeploy), not an in-product one. The self-service change-password endpoint above therefore only applies to `review_admins` rows, never to the root identity.

**Root admin password storage — decided 2026-09-11:** the env var holds a **pre-computed hash** (e.g. `ADMIN_PASSWORD_HASH`), not a plaintext password — the login route hashes the incoming attempt and compares against it, over storing the plaintext password directly in the env var. Chosen for consistency with `review_admins.password_hash` (one comparison code path shared by root and non-root, not two), even though a Cloudflare Workers secret is already encrypted at rest and a plaintext value would have been an acceptable, simpler alternative for this single low-traffic identity. Tradeoff accepted: the hash must be generated once, out-of-band, before deploying (can't just type a password into the dashboard), and rotation means regenerating a hash rather than typing a new value.

**Admin JWT shape — decided 2026-09-11:** admin login reuses the **same `signJWT` shape** as the other personas (`{ userId, role }`), with `role: 'review_admin'`, plus one added claim, **`isRoot: boolean`**, over a wholly admin-specific token shape/verification path. Chosen for consistency with this design's overall pattern of reusing existing surfaces rather than building parallel machinery (same reasoning as putting the admin UI inside the existing `apps/review-console` app rather than a new one) — existing role-gating middleware just needs `'review_admin'` added as an accepted role, no new JWT verification code path. `isRoot` is needed because root has no `review_admins` row to distinguish itself by: it's what downstream code (e.g. the password-change endpoint) checks to enforce "root can't self-serve a password change." For root, `userId` is a synthetic value (working assumption: the env-configured username itself, e.g. `'admin'`) rather than a DB row id, since no DB row exists for root; non-root admin tokens use the `review_admins` row's real id, consistent with how other personas' tokens work.

**Root admin env var names — decided 2026-09-11:** `REVIEW_ADMIN_USERNAME` / `REVIEW_ADMIN_PASSWORD_HASH`, namespaced with a `REVIEW_` prefix rather than a bare `ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH` — `apps/backend` is a single Worker with one shared env today so collision risk is low, but the prefix keeps this legible as review-console-specific if the backend's env ever grows to serve an admin concept for another persona later.

**Item 6 is now fully decided end-to-end, zero open unknowns.** Full chain: `review_team_members` (invite-only roster) + `review_admins` (id, username, password_hash, created_at, created_by) tables → `review_admin` role gates registration → root bootstraps via `REVIEW_ADMIN_USERNAME`/`REVIEW_ADMIN_PASSWORD_HASH` env vars (hash-based comparison) → non-root admins get individually issued username+password at creation, changeable via self-service optional endpoint (root excluded, permanently fixed to env) → admin login issues the standard `signJWT` shape (`role: 'review_admin'`, plus `isRoot` claim) → admin UI lives inside `apps/review-console`, gated by the `review_admin` role, with full access to manage both `review_team_members` and `review_admins`. Nothing built yet — this is the complete build spec.

---

## Phase 0.75 — Notifications (SMS + Telegram)

### Channels
SMS: always on, no opt-in. Telegram: opt-in via bot Start (additive only, never a replacement). Both fire independently per event.

### Architecture
Config-driven `notification_templates` (trigger × channel → template) — no per-event hardcoded logic.

### Triggers (6, v1)
1. **Campaign invite** — at launch + on every new contact added while campaign is active (see dedup below).
2. **Ending soon** — ~2 days before campaign end, for unfinished customers.
3. **Reward threshold reached**.
4. **Submission reviewed** — task/purchase moves out of pending.
5. **Mid-campaign reminder** — 50% duration elapsed, customer has completed 0 tasks.
6. **Referral joined** — immediate ping to referrer when someone signs up on their code.

### Campaign invite dedup & confirmation (decided 2026-09-08)
Dedup key: one invite per `business_contact` per active campaign (applies equally to manual_upload and self_joined sources). Confirmation: dedicated **"لاگ ارسال‌ها" (Sends Log)** view for the business owner (contact, channel, trigger, status, timestamp) — not just a launch toast. See architecture.md `notifications_log` (nullable `business_contact_id`/`campaign_id` for pre-join sends).

### Initial audience acquisition
Hybrid: (1) manual CSV/Excel upload of existing contacts, (2) public join link/QR for self-join (keeps growing the list post-launch too). Instagram follower-list import ruled out (no API access to phone numbers/DMs) — only the follower *count* is usable as a size signal.

### Business microsite (optional add-on)
Curated template gallery, filtered by business category. Owner picks template + toggles content modules on/off; no reordering, no free-form HTML, no multi-page CMS. Deployed to a hosted subdomain (interim: path-based `/{slug}` on `workers.dev`, see Deployment section), embeds the campaign join link/QR. Fully optional/additive. **All 6 v1 category templates are built and live** (`apps/microsite`, PR #21): minimal_cafe, bold_retail, energetic_gym, serene_beauty, fine_dining, sleek_shop.

**Backend-wiring scope decision (decided 2026-09-11, addresses Open Item 3 — DONE, merged in PR #36 2026-09-11):** investigation surfaced that this gap is bigger than just `campaigns.goal` reaching the CTA — `business_microsite_modules.content` (and `business_microsites.content`) are real TEXT/JSON columns in the schema, but `apps/backend/src/routes/business.ts`'s `ensureMicrosite()`/`serializeMicrosite()` never write or read them; every module row is created with `content = NULL` and the business-owner microsite builder only ever toggles `enabled`. So none of the rich Persian marketing copy currently rendered by `apps/microsite/app/lib/mock-data.ts` (hero titles, about text, product menus, testimonials, etc.) has ever existed as real seed/generated data — it's fixture-only. Two options were considered: (a) narrow — wire only `campaigns.goal` through to the CTA, leave `content` null with runtime fallback defaults; (b) broad — also seed real per-template content into the DB so the microsite stops being mock-data-backed in substance, not just in wiring. **Chosen: (b), broad scope.** This PR will: seed real `business_microsite_modules.content` JSON for all 6 v1 templates (ported from `mock-data.ts`'s existing Persian copy) via a new migration, add a public (unauthenticated) backend endpoint serving a business's microsite by `subdomain_slug` including its `featuredCampaign.goal`, and wire the microsite's `mock-data.ts` seam to call that endpoint instead of returning fixtures. Goal-driven CTA copy (acquisition vs. retention messaging) is layered on top of the real featured campaign's `goal` field client-side rather than stored per-module, since it needs to react to whichever campaign is currently live.

**Microsite↔backend transport (decided 2026-09-11):** Cloudflare **service binding** (`apps/microsite`'s Worker binds directly to the `ai-campaign-builder-backend` Worker), not a plain HTTPS fetch to a public URL — both are Workers in the same Cloudflare account already, so a service binding avoids the public-internet hop, CORS, and extra auth-plumbing that a URL-based call would need for what is otherwise an internal server-to-server call.

---

## Phase 0.9 — Pricing & Revenue Model

- Monthly subscription, priced by size tier.
- SMS billed separately by volume (Telegram stays bundled/free).
- Business microsite = separate optional add-on fee.
- Exact price points/rates: left for a later business decision — shape is fixed, not the numbers.

### SMS prepaid wallet
Business tops up in advance; each SMS deducts its cost at send time; insufficient balance → that SMS is skipped (not sent/charged), rest of the platform unaffected; low-balance alert to owner. Optional hard monthly spending cap on top of the wallet (Telegram unaffected either way).

### Business owner authentication
Phone number + SMS OTP only — no email/password, matches the customer-facing flow. **Implemented as designed.**

---

## Phase 1 — Abstraction Layer (Task & Reward Patterns)

Reusable behavioral patterns weighted per business category, not hardcoded per business type.

### Task patterns
Social Proof, Referral, Repeat Purchase/Order Again, Milestone/Streak, Specific Product Push, Review/UGC, First Action/Conversion (Goal-driven — weight boosts toward 3 for acquisition, drops toward 0–1 for retention), Off-Peak/Time-based Visit, Anniversary/Birthday. (Rejected for v1: Bundle/Cross-sell, Geolocation Check-in.)

### Reward patterns
Percentage Discount, Free Item/Upgrade, Free Shipping, VIP/Membership Tier, Promotional Item, Early Access.

### Weighting table (v1 draft, 0–3 scale)
| Pattern | کافی‌شاپ | لباس | رستوران | آنلاین | باشگاه | زیبایی |
|---|---|---|---|---|---|---|
| Social Proof | 3 | 2 | 2 | 1 | 1 | 3 |
| Referral | 2 | 2 | 2 | 2 | 2 | 2 |
| Repeat Purchase | 2 | 2 | 3 | 2 | 0 | 1 |
| Milestone/Streak | 1 | 0 | 0 | 0 | 3 | 1 |
| Specific Product Push | 3 | 1 | 2 | 1 | 0 | 0 |
| Review/UGC | 1 | 1 | 2 | 3 | 1 | 2 |
| First Action/Conversion* | 2 | 2 | 2 | 3 | 2 | 2 |
| Off-Peak/Time-based | 2 | 0 | 2 | 0 | 2 | 1 |
| Anniversary/Birthday | 1 | 2 | 1 | 1 | 2 | 2 |

*Assumes Goal = acquisition; dynamically overridden per campaign's actual Goal at implementation time, not hardcoded.

Config-driven (JSON/table), not hardcoded logic.

### Business size-tier scaling
No dedicated onboarding question. Hybrid signal: (1) follower/existing-customer count if a connector is linked, else (2) inferred from the Q4 offer/budget answer. If the two signals disagree, use the higher tier.

| Tier | Followers/customers | Offer budget (تومان) | Point multiplier | Suggested duration |
|---|---|---|---|---|
| Micro | < 500 | < 30,000 | 0.7x | 10 days |
| Small | 500–2,000 | 30,000–100,000 | 1x | 14 days |
| Medium | 2,000–20,000 | 100,000–500,000 | 1.5x | 21 days |
| Large | > 20,000 | > 500,000 | 2x | 30 days |

Multiplier scales each task pattern's base points; duration is an editable AI default.

---

## Phase 2 — Post-Launch Insights (read-only, no autopilot)

Dashboard surfaces AI-generated insight cards (completion-rate flags, correlation callouts, suggested actions) — nothing auto-applies yet.

**"Low completion" scoring:** average of two deviation checks — vs. cross-campaign benchmark for that task pattern+category, and vs. the campaign's own other tasks — combined into one low/normal/high flag.

**Cadence (3 tiers):** daily one-line digest, weekly fuller report (comparisons + correlations), anomaly-triggered immediate alert.

### Benchmark data strategy
Phase A (launch): generic industry/marketing data as placeholder defaults. Phase B (parallel, post-MVP): onboard ~6–12 free early-adopter businesses (1–2 per category), with hands-on campaign-design help in exchange for real usage data; progressively replaces Phase A benchmarks per category as real data accumulates. No pre-product manual-tracking phase.

---

## Phase 3 — Suggested Changes (Human-in-the-Loop)

**Inputs:** Phase 2 insights, live campaign_tasks/rewards state, benchmark_stats, campaign Goal/tier, this business's suggestion history (applied/dismissed+reason), owner's `business_ai_constraints` (max discount %, budget ceiling).

**Owner signal:** implicit only — Apply or Dismiss (dismiss captures a reason).

**Two risk tiers** (both shown to owner, manual Apply required for either):
- Low-risk: `points_value`, `threshold_points`, add/remove a task, extend/shorten duration.
- High-risk (warning label): reward depth/type change — checked against constraints before being shown at all.

**Apply mechanism:** `suggested_changes` row (risk tier, change type, current/suggested value, rationale, status) — Apply writes the value live and marks `applied`; the row itself is the audit log (revert = apply the inverse row).

## Phase 4 — Opt-in Autopilot (not default)

**Eligibility:** toggle only appears after 3 manual Applies in Phase 3.

**Scope:** auto-applies only `task_points`, `reward_threshold`, `campaign_duration`. `add_task`/`remove_task` and high-risk changes always stay manual. Still respects `business_ai_constraints`.

**Mechanism:** `businesses.autopilot_enabled` toggle (default off). Eligible-scope suggestions auto-apply with `applied_by=autopilot`. Every auto-apply fires an `autopilot_change_applied` notification with an **Undo** action (creates+applies the inverse row).

---

## Phase 5 — Production Build

**Stack:** React + Vite, Tailwind CSS, Framer Motion (chosen 2026-09-08 for build speed, glassmorphism via Tailwind utilities, performant animation without hand-rolled CSS). Backend: Hono on Cloudflare Workers, Cloudflare D1 (switched from Postgres 2026-09-08 — avoids Hyperdrive/connection-pooling for expected SMB write volume; see architecture.md Stack section for the type-mapping tradeoffs).

**Repo structure — monorepo**, modeled on `allocsys/raffle-app`:
```
apps/
  business-owner/    — dashboard SPA (Cloudflare Worker, static assets)
  customer/          — dashboard SPA
  staff-pos/         — installable PWA (own manifest/service worker scope)
  review-console/    — dashboard SPA, internal team only
  microsite/         — SSR (React Router v7 framework mode), public/multi-tenant
  deploy-index/       — temporary static directory page (interim, no domain yet)
  backend/            — Hono API, D1-bound, own migrations/ folder
packages/
  ui-kit/            — shared component library (Button, Card, Badge, Modal, Accordion, Input, ToastProvider) + animation-tokens
  api-client/        — shared typed fetch wrapper + per-persona resource modules (auth, business, customer, staff-pos, review)
```

**Deployment (interim naming, no custom domain purchased yet):** every app is its own Cloudflare Worker under `ai-campaign-builder-<app>.pachoolai24.workers.dev`. Target production naming (once a domain exists): dedicated subdomains per dashboard persona (`app.`/`staff.`/`review.` etc., prefixes TBD), microsite takes over per-business routing (`{slug}.yourdomain.com` or the interim `/{slug}` path scheme), `deploy-index` retired in favor of the domain's own root page.

**CI/CD:** one `.github/workflows/deploy.yml`, path-filtered per app (`dorny/paths-filter`) — each app's job only runs if its own folder (or a shared `packages/**`/root `package.json`) changed. `pull_request` = typecheck/test only (CI gate, no deploy); `push` to `main` / manual `workflow_dispatch` = full deploy. Backend has two extra jobs: `backend-migrate` (`wrangler d1 migrations apply --remote`, gated on `apps/backend/migrations/**`) and `backend` (waits on migrate succeeding-or-skipped, fails fast if `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`/`BACKEND_JWT_SECRET` secrets are missing). `.github/actions/ensure-d1-database` idempotently looks up-or-creates the D1 database by name in every run — the repo's `wrangler.toml` `database_id` stays a placeholder forever. The `backend` job also has an optional post-deploy step pushing `REVIEW_ADMIN_USERNAME`/`REVIEW_ADMIN_PASSWORD_HASH` to the Worker (added alongside Item 6, PR #38) — optional because it silently no-ops (bash `-z` check, `exit 0`) when either secret isn't set, rather than failing the deploy.

**CI/CD gotcha (found 2026-09-11, PR #38):** the GitHub Actions `secrets` context **cannot be referenced inside a step-level `if:` expression** — doing so doesn't fail cleanly, it silently invalidates the *entire workflow file* (every run shows 0 jobs, and the run's displayed "name" becomes the file path instead of `Deploy`). Always map a secret to an `env:` var on the step and do presence-checks with a bash `-z` test inside `run:` instead, exactly like the pre-existing `Check required secrets present` steps already do.

**Mockup's role:** `mockup/` (built 2026-09-08, PR #2, 9 functional gaps closed) was kept strictly as a **logic/behavior reference** for the production build — flow sequencing, edge cases, dedup rules — never a visual reference. Production UI has no visual inheritance from it.

---

## Open Items

1. **`ai_confidence_score`** on `task_submissions` is read by Review Console but nothing populates it in production yet. **Decided + pipeline built 2026-09-11** (see Phase 0.5 "Scoring approach"): `lib/vision.ts`'s provider adapter, now a **cascade** across Google's models then OpenAI's models (`vision-cascade.config.ts`, PR #40, merged) is wired into the submit route via `waitUntil`. Evidence storage side is now also built: **Backblaze B2** upload pipeline (`lib/b2.ts`, `POST /api/customer/evidence-upload`, `TaskSubmitModal.tsx` wired to real upload) merged via **PR #41, commit `01be526`** (see Phase 0.5 "Evidence storage provider") — `evidence_url` is no longer filename-placeholder-only. **Redesigned 2026-09-11:** attempting to actually create the B2 bucket hit a payment-method requirement for public buckets, so the design switched to a **private bucket + server-side proxied downloads** (`storage.ts`'s `downloadEvidenceImage`, `vision.ts`/`customer.ts` updated to use opaque keys instead of public URLs, new authenticated `GET /submissions/:id/evidence` proxy route on `review.ts`) — built on branch `feature/b2-private-bucket-proxy`, opened as **PR #42, CI green, not yet merged**. **Not yet enabled in production:** neither `VISION_*` nor `B2_*` provider/key repo secrets are configured yet (and the B2 bucket itself still needs to be created, now as private), so every submission still gets a null score and every real evidence upload will still fail until PR #42 is merged and both sets of secrets are set. No threshold bands for Item 5 either way.
2. ~~**Per-reviewer/resolver identity** not persisted in the audit trail~~ — **CLOSED 2026-09-11.** Resolved via a real foreign key (`reviewed_by_user_id`/`resolved_by_user_id` on `task_submissions`/`referral_flags`, referencing `review_team_members`; see Phase 0.5 "Resolution approach"), built and wired into `routes/review.ts` in the same migration (0009) as Item 6. Merged via PR #38 (commit `5dc1747`) and live on `main` — migration applied to the remote D1 database.
3. **Business domain name** still undecided — `workers.dev` interim naming works fine, not blocking.
4. Stale branch `step9-bundle-optimization` (superseded by PR #18) was never deleted — no branch-delete tool available in-session; flagged for manual cleanup. (`feature/vision-cascade-config` has since been cleaned up post-merge; only `step9-bundle-optimization` remains stale as of 2026-09-11.)
5. Auto-approve/auto-reject tiers of the 3-tier AI review system (Phase 0.5) aren't implemented — only manual-hold (Review Console) is live, since there's no real AI scoring pipeline (see item 1).
6. ~~**`review_team` OTP verification has no roster/invite check**~~ — **CLOSED 2026-09-11.** Fixed via `review_team_members`, invite-only (mirroring `staff`'s invite gate exactly). Registration is gated by a **separate `review_admin` role**, logging in with **username+password** via its own login route (`POST /api/review-admin/login`) — the root admin's credentials are env-configured (`REVIEW_ADMIN_USERNAME`/`REVIEW_ADMIN_PASSWORD_HASH`, hash-compared via `lib/password.ts`'s PBKDF2 implementation). Admin page lives inside `apps/review-console` at `/admin` (login at `/admin/login`), with full access to manage `review_team_members` *and* to add/remove `review_admins`. Non-root admins get their own issued username+password, changeable via self-service `PATCH /api/review-admin/password` (root excluded, permanently fixed to env). Admin JWT reuses the standard `signJWT` shape plus an `isRoot` claim. **Merged via PR #38 (commit `5dc1747`) and fully live in production:** migration 0009 applied to the remote D1 database, backend redeployed, and `REVIEW_ADMIN_USERNAME`/`REVIEW_ADMIN_PASSWORD_HASH` generated and pushed as repo secrets — `deploy.yml`'s `backend` job now has an optional step (mirroring the `BACKEND_JWT_SECRET` one) that pushes both to the Worker via `wrangler secret put` whenever both secrets are present, confirmed working via a real deploy run. Root admin login is live.

---

## Architecture reference
Full DB schema (35 tables) lives in `architecture.md`, not duplicated here.
