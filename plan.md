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
2. هدفت چیه؟ (acquisition / retention / acquisition_retention — گزینه ترکیبی اضافه شد 2026-09-11، منطق وزن‌دهی جداگانه در campaign-generator.ts)
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
Each central-team member authenticates with their own phone + SMS OTP (`review_team` role), invite-only via `review_team_members` (mirrors `staff`'s invite gate). A separate `review_admin` role (own username+password login route, env-configured root bootstrap via `REVIEW_ADMIN_USERNAME`/`REVIEW_ADMIN_PASSWORD_HASH`, persisted `review_admins` table for additional admins, self-service password change, standard `signJWT` shape plus an `isRoot` claim) manages both rosters from a page inside `apps/review-console`. Full decision trail (now historical) has been trimmed here since it fully duplicated the closure summary — see **Open Item 6** (closed) for the complete final shape and PR/deploy details.

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
**Original design (superseded 2026-09-12, kept for history):** no dedicated onboarding question -- hybrid signal of (1) follower/existing-customer count if a connector is linked, else (2) inferred from the Q4 offer/budget answer, higher tier wins on disagreement. This predates the wizard build; Item 8 (2026-09-11) instead gave this a dedicated Step 3 question asking for follower/customer count directly, alongside an "offer/reward budget" figure reused from the same wording as Step 4's actual offer question.

**Signal changed from "offer budget" to "monthly revenue" -- decided 2026-09-12:** the wizard's Step 3 "offer/reward budget (تومان)" field looked like the same question as Step 4's real offer/reward description, and confused owners into thinking they were being asked about their offer twice. Replaced with a direct **approximate monthly revenue** question -- a standalone business-size signal with no overlap with Step 4's content. This is a real change to the tier thresholds below, not just a relabel: monthly revenue runs roughly 1000x larger in scale than an individual offer's budget. Follower/customer count and monthly revenue still independently estimate a tier; if they disagree, use the higher tier (rule unchanged).

| Tier | Followers/customers | Monthly revenue (تومان) | Point multiplier | Suggested duration |
|---|---|---|---|---|
| Micro | < 500 | < 50,000,000 | 0.7x | 10 days |
| Small | 500–2,000 | 50,000,000–200,000,000 | 1x | 14 days |
| Medium | 2,000–20,000 | 200,000,000–1,000,000,000 | 1.5x | 21 days |
| Large | > 20,000 | > 1,000,000,000 | 2x | 30 days |

Multiplier scales each task pattern's base points; duration is an editable AI default. **Built 2026-09-12 -- see Open Item 11 for the full implementation/deploy detail.**

**Signal model revised again -- decided 2026-09-12 (supersedes the single ambiguous "followers/customers" field above, fixes a real bug, not just a rename):** the Step 3 field labeled "تعداد فالوورها یا مشتریان موجود" forced an owner to report only ONE of two genuinely independent numbers -- a business can have many walk-in customers and zero Instagram followers, or the reverse -- so whichever one they picked, the other real signal was silently discarded. Replaced with three separate inputs:
- **Daily customer count** (always asked): a **range slider** (owner drags a floor and ceiling, e.g. "10 to 50 customers/day") instead of a single exact number, since most owners think in rough bands, not exact daily figures. **The average of the selected range (floor+ceiling)/2 is what feeds the existing tier-threshold table** -- chosen over feeding the ceiling (rejected: needlessly bumps borderline businesses to a higher tier) or building a parallel range-bucket threshold table (rejected: unnecessary complexity when the existing single-number table already works once fed an average).
- **Monthly revenue** (always asked): same treatment -- range slider, average fed to the threshold table. (Was a single exact-number input as of Item 11 above; now a range, for the same "owners estimate in bands" reason.)
- **Follower count** (optional, hidden by default): a checkbox ("پیج اینستاگرام دارم") reveals a single exact-number follower-count input only once checked -- businesses with no Instagram presence never see a follower question at all, rather than a field they'd have to actively skip or zero out.

All signals actually provided (customer count and revenue always; follower count only if the Instagram checkbox is checked) are checked independently against the threshold table, **highest tier wins** -- same disagreement rule as before, now extended from 2 signals to up to 3.

**New threshold column needed:** daily-customer-count bounds don't exist yet in `SIZE_TIERS` (only follower-count and monthly-revenue bounds do). Initial estimates (micro ≤ 15/day, small ≤ 50/day, medium ≤ 150/day, large > 150/day) are a first guess, not benchmarked data -- flagged for revisiting once real businesses are on the platform, same caveat Phase 2's benchmark-data strategy already carries for other numbers.

**UI component gap -- CLOSED.** `packages/ui-kit/src/RangeSlider.tsx` (dual-handle) was built as part of this work, closing the third instance of the "ui-kit is missing a basic form primitive" gap (after Select's `selectClassName()` workaround and the still-unbuilt Textarea).

**Built and merged 2026-09-11 -- PR #48 (commit `b215541`):** the 3-signal size-tier model landed in `CampaignWizardTab.tsx` Step 3 (daily-customer-count and monthly-revenue range sliders + optional Instagram-follower checkbox/field) alongside the Step 4 reward-checkbox reorder described above. `campaign-generator.ts`'s `SIZE_TIERS`/`resolveSizeTier` updated to take all 3 independent signals (highest tier wins). Two follow-up fixes shipped the same day: PR #49 (`c53456e`) + a direct commit (`ccf69ac`) fixed RTL fill/thumb/value-label mirroring on `RangeSlider`; PR #50 (`2bd0a6e`) added manual کف/سقف number inputs as a fallback to dragging. No further work planned for this item.

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

1. ~~**`ai_confidence_score` on `task_submissions` was read by Review Console but nothing populated it.**~~ **CLOSED 2026-09-11.** Real vision-scoring pipeline built (`lib/vision.ts`, Google→OpenAI cascade, PRs #39-41), wired into the submit route via `waitUntil`. Evidence storage on Backblaze B2, private bucket + server-side proxied downloads (PR #42). Confirmed live in production -- all `B2_*` secrets and `VISION_GOOGLE_API_KEYS` set; `VISION_OPENAI_API_KEYS` intentionally unset (cascade skips absent providers). Threshold bands for auto-approve/auto-reject remain open -- see Item 5.
2. ~~**Per-reviewer/resolver identity not persisted in the audit trail.**~~ **CLOSED 2026-09-11.** Added `reviewed_by_user_id`/`resolved_by_user_id` FKs on `task_submissions`/`referral_flags` (migration 0009), PR #38 (commit `5dc1747`), live on `main`.
3. **Business domain name** still undecided — `workers.dev` interim naming works fine, not blocking. Target shape (one domain, all subdomains): `app.` (business-owner), `staff.` (staff-pos), `review.` (review-console) are the three persona prefixes already named in Phase 5's deployment note; `{slug}.` (wildcard, one per business) is microsite's, with the bare apex serving as the platform landing page once `deploy-index` is retired. **Still undecided:** the prefixes for `customer` and `backend` (`api.` is the obvious convention for the latter, just not written down anywhere before now). Whatever gets picked for these two, plus the eventual real value of `MICROSITE_DOMAIN` (`packages/shared-config`), needs to avoid colliding with any business-chosen slug from Item 17 below -- see that item's reserved-word note.
4. ~~Stale branch `step9-bundle-optimization`~~ — **CLOSED 2026-09-12.** Branch (superseded by PR #18) has been deleted.
5. Auto-approve/auto-reject tiers of the 3-tier AI review system (Phase 0.5) aren't implemented — only manual-hold (Review Console) is live. **Now unblocked** (Item 1's scoring pipeline is live, so real `ai_confidence_score` distributions exist to threshold against), but no threshold bands have been defined yet and no auto-approve/auto-reject logic has been built — still not started.
6. ~~**`review_team` OTP verification had no roster/invite check.**~~ **CLOSED 2026-09-11.** Added invite-only `review_team_members` (mirrors `staff`'s gate). Added a separate `review_admin` role (username+password, env-configured root bootstrap, `review_admins` table for additional admins) managing both rosters from `apps/review-console`'s `/admin` page. Migration 0009, PR #38 (commit `5dc1747`), live in production with `REVIEW_ADMIN_USERNAME`/`REVIEW_ADMIN_PASSWORD_HASH` set as repo secrets.
7. ~~**`apps/business-owner` had no public landing page.**~~ **CLOSED 2026-09-11.** Built `LandingPage.tsx` at `/`; authenticated app moved to `/dashboard`; already-authenticated visitors bounce straight there. PR #43 (commit `b8ccba2`).

8. ~~**`apps/business-owner` had no onboarding wizard / AI campaign-generation flow.**~~ **CLOSED 2026-09-11.** Built end-to-end: migration 0010 seeds `category_pattern_weights`; `campaign-generator.ts`'s `generateCampaignProposal()` does deterministic pattern/points/threshold/size-tier math (money-consequence values are never LLM-derived) with LLM-generated names/copy (same Google→OpenAI cascade/keys as Item 1's vision pipeline, falls back to deterministic Persian defaults if generation fails); `POST /campaign/generate` live on `routes/business.ts`; `CampaignWizardTab.tsx` implements the 5-step wizard (business-name field added to Step 1, explicit reward-type selector added to Step 4). Clamps rewards against `business_ai_constraints` if already set; refuses regeneration (409) while a campaign is already `active`; goal overrides the First Action/Conversion pattern weight (3 for acquisition, 1 for retention) at generation time only. PR #44 (commit `6d666f5`).

9. ~~**Business address was collected nowhere and used nowhere.**~~ **CLOSED 2026-09-11.** Added `businesses.address` (migration 0012), collected in both the wizard's Step 1 and the Settings profile form; auto-fills the microsite Contact module. `{{business_address}}` documented as an available notification-template placeholder (not yet wired to any actual send, since no send logic exists yet). PR #47 (commit `1c5c5c9`).

10. **AI review scoring is not load-isolated from the main API** — flagged 2026-09-12. The original architecture.md decision (2026-09-07) called for AI screenshot review to run as a separate microservice with a job queue, specifically so a burst of review load couldn't degrade the main API's other traffic. What actually got built for Item 1 (PR #39–41) is inline in `apps/backend` — `routes/customer.ts`'s `POST /tasks/:id/submit` fires the vision call via `c.executionCtx.waitUntil(...)`. That solves *not blocking the customer's response* and (via `lib/vision.ts`'s provider cascade) *isolating AI-provider changes*, but not the original **load-balancing** goal — `waitUntil` work still competes for the same Worker's CPU/invocation budget as every other backend route. This wasn't flagged as a dropped goal at the time; plan.md's Item 1 entry reads as a clean implementation note rather than a tradeoff. **Decided 2026-09-12: defer.** Not urgent at current volume. Revisit by actually splitting review-scoring into a separate Worker (with a real queue, e.g. Cloudflare Queues) once load justifies it. See architecture.md's "Open implementation questions" for the technical detail.

11. ~~**Wizard's Step 3 size-tier signal renamed from "offer budget" to "monthly revenue".**~~ **CLOSED 2026-09-12.** Threshold table + field/type names updated end-to-end (backend, api-client, wizard UI); request/response rename only, no schema migration. **Incident:** a few of these commits were accidentally pushed directly to `main` mid-rename, briefly leaving `main` inconsistent -- self-resolved same day. No branch-protection change was requested; flagged here since direct-to-main pushes aren't currently blocked.

---

12. ~~**`apps/business-owner` had no real navigation -- everything lived in one 9-panel accordion.**~~ **CLOSED 2026-09-12.** Full redesign shipped same-day per `design.md` (superseded the deleted `Mockup.md`): new `AppHeader`/`Drawer`/`BottomNav` primitives in `ui-kit`, 8 real nested routes under `/dashboard/*`, `InsightsTab`+`SuggestionsTab` merged into one page, old `Accordion.tsx`/`BusinessOwnerHome.tsx` deleted -- no accordion-based navigation remains anywhere. PRs #51-53 area, backend/other 4 apps untouched (frontend shell rewrite only).

---

13. **Customer signup is hardcoded single-tenant -- always joins whichever campaign was created first in the entire database, regardless of which business the customer actually meant to join.** Found 2026-09-12 while testing کافه تایم's live customer flow: a fresh customer OTP login landed on an empty profile (0 points, no tasks) despite کافه تایم's campaign having 4 real tasks and 6 rewards live. Root cause, traced through the code:
    - `apps/backend/src/routes/customer.ts`'s `ensureCustomerCampaignCode()` resolves the campaign to join via `SELECT id FROM campaigns ORDER BY created_at ASC LIMIT 1` -- literally "the oldest campaign that exists anywhere," not anything derived from which business the customer is trying to reach. This is called both at OTP-verify signup time (`auth.ts`) and on every subsequent `resolveCode()` call in `customer.ts` (profile/tasks/rewards/retro-claims/notifications), so there's no path anywhere in the customer backend that scopes to a specific business.
    - `apps/microsite/app/routes/join.$slug.tsx` (the only place a customer's join intent is actually captured, since it validates the campaign's `public_join_slug` against a specific business) hands off to a hardcoded `CUSTOMER_APP_URL` with **zero query params** -- the business/campaign context it just resolved is thrown away at the exact handoff point where it matters most.
    - `apps/customer/src/routes/AuthScreen.tsx` hardcodes `const businessName = 'کافه نارون'` directly in the component, with a comment acknowledging "no public/unauthenticated backend endpoint exists to fetch the business name before login (single-tenant simplification)."
    
    Net effect: today, literally every customer who completes OTP joins the same one business's campaign (whichever has the globally-oldest campaign row), no matter which business's join link/QR they actually used. کافه تایم's campaign happens not to be that oldest row (three older placeholder/demo campaigns precede it, two of them empty leftover test data), so no real customer traffic through کافه تایم's own join link can ever reach it today.

    **Decided 2026-09-12: this is real, scoped work (not a quick patch) and will be built as a sequential chain of independently-shippable steps, each its own branch/PR, in this order.** No step should start until the previous one is merged and verified, since later steps depend on earlier ones' plumbing (JWT shape, query-param contract) existing.

    - **Step A -- backend: replace the "oldest campaign in DB" guess with an explicit campaign to join.** `ensureCustomerCampaignCode(db, customerId, campaignId?, referralCode?)` takes an explicit `campaignId` instead of querying for one. Add a `resolveCampaignByJoinSlug(db, slug)` helper (`SELECT id FROM campaigns WHERE public_join_slug = ?`). `auth.ts`'s `verify-otp` accepts an optional `joinSlug` in the request body for `role: 'customer'`, resolves it to a `campaignId` via the new helper (400 with a clear error if the slug doesn't resolve -- a stale/bad link should fail loudly, not silently fall back to some other business), and passes that `campaignId` through. The resolved `campaignId` is embedded as a new claim on the customer's JWT (mirrors the existing `businessId` claim already used for `role: 'staff'` in `middleware/auth.ts`'s `JWTPayload`), so every later authenticated request already knows its business/campaign scope without re-deriving it. `customer.ts`'s `resolveCode()` and every route that calls it (profile/tasks/submit/rewards/retro-claims/notifications) reads `campaignId` off `c.get("auth")` instead of the old no-args global lookup. **Backward compat:** a customer JWT issued before this change (no `campaignId` claim) falls back to that customer's most-recently-created `customer_campaign_codes` row rather than a hard 401/404 -- avoids force-logging-out anyone already mid-session ahead of the JWT's natural 7-day expiry. **Built 2026-09-12** (commits `03ae461`, `7c10b05`, `afbdf0b`, `9ee75bb`) on branch `feature/customer-multitenant-step-a`. **Merged 2026-09-12 via PR #62 (squash commit `1753ed2`)**, together with Steps B, C, and D.
    - **Step B -- microsite-to-customer-app handoff: actually carry business identity across the origin boundary.** `join.$slug.tsx` changes its `CUSTOMER_APP_URL` link to `${CUSTOMER_APP_URL}/?join=${campaign.public_join_slug}`. The customer app captures `?join=` on first load -- **before** `ProtectedRoute`'s redirect-to-`/login` swallows it for an unauthenticated visitor -- and persists it (sessionStorage, since it only needs to survive the phone->OTP step, not future sessions) so it's still available once the customer reaches the OTP form. `apps/customer/src/lib/auth.tsx`'s `verifyOtp()` and `packages/api-client/src/resources/auth.ts`'s `verifyOtp()` both gain an optional `joinSlug` param, threaded through to the backend call added in Step A. **Built and merged 2026-09-12** (commits `dc8672f`, `19c7dcf`+`4c0d0cb`, `d3b017a`, `08abd9e`) via PR #62, squash commit `1753ed2`.
    - **Step C -- remove the remaining hardcoded single-tenant UI assumptions.** `AuthScreen.tsx`'s hardcoded `businessName = 'کافه نارون'` needs a real decision: either drop business-specific copy from the pre-login screen entirely (generic welcome text, simplest, no new endpoint needed), or add a small public unauthenticated `GET` endpoint (mirrors the existing public microsite endpoint's unauthenticated pattern) that resolves a business's display name from a `joinSlug`, so the pre-login greeting matches whichever business's link the customer actually used. **Decided 2026-09-12: generic copy for now.** A personalized pre-login greeting needs a new public unauthenticated endpoint purely for pre-login cosmetics -- real backend surface for a nice-to-have. Going generic unblocks this item today with no new attack surface, and doesn't foreclose adding the personalized lookup later; it's additive, not a rework. Revisit only if a personalized pre-login greeting becomes an actual product priority. Confirmed `CustomerHome.tsx` needs no change, since post-login it already reads `businessName` dynamically from `GET /api/customer/profile`. **Built and merged 2026-09-12** (commit `f98f947`, generic "به باشگاه مشتریان خوش آمدید!" copy) via PR #62, squash commit `1753ed2`.
    - **Step D -- decide and build the no-join-link fallback path.** A customer who opens the bare customer-app URL with no `?join=` at all (bookmarked, direct nav, old QR code without the new param) has no way to resolve a campaign on first-ever signup once Step A removes the global-oldest-campaign fallback. Two options, needs a real decision before building: **(i)** a "pick your business" screen backed by a new endpoint listing businesses with a published microsite (heavier, genuinely supports a browse-first customer experience), or **(ii)** require a join link for first-ever signup (matches how most loyalty-club apps actually work -- you always arrive via a specific business's link/QR) and only allow bare-URL login for a *returning* customer who already has at least one `customer_campaign_codes` row (Step A's backward-compat lookup already covers this case for free). **Decided 2026-09-12: option (ii).** The microsite/join-slug split is already this product's discovery mechanism -- each business's microsite is its public front door. A browse-businesses directory doesn't exist anywhere today (not even at the microsite level), so option (i) would mean building a new cross-business marketplace feature, not just an endpoint -- a much bigger product decision than this bug-fix item should absorb. Ship the simple link-first version now; a real directory is additive later if actual demand shows up, not a rework. **Built and merged 2026-09-12** (commits `2eadecb`, `398c99d`, `5564924`, `0f33cfd`) via PR #62, squash commit `1753ed2`. Implementation: `auth.ts`'s `verify-otp` now returns 400 ("برای عضویت، لطفاً از لینک مخصوص عضویت کسب‌وکار خود استفاده کنید.") instead of issuing a dead-end JWT when a customer resolves to no campaign at all (no joinSlug, no existing `customer_campaign_codes` row) -- a returning customer with an existing row is unaffected. `apps/customer`'s `auth.tsx`/`AuthScreen.tsx` rethrow and surface that specific 400 message distinctly from the generic wrong-OTP error, rather than collapsing every verify-otp failure into "کد وارد شده اشتباه است".
    - **Step E -- cleanup + end-to-end re-verification.** **Steps A-D merged 2026-09-12 (PR #62, squash commit `1753ed2`)** -- Step E's dependency is now satisfied. **Part 1 (delete empty placeholder businesses) done 2026-09-12:** investigation found this doc's list was stale -- 7 empty businesses existed in production with 0 campaigns each, not the 2 originally named (`کسب‌وکار جدید`, `کافه نارون`, `باشگاه تایتان`, plus previously-undocumented `بوتیک ولورا`, `رستوران سیمرغ`, `فروشگاه اینترنتی نوین`, `کلینیک زیبایی آوا`). User decided: delete all 7. Verified none had any campaigns/contacts/SMS history before deleting; one (`کسب‌وکار جدید`) had a trialing `business_subscriptions` row and one test `staff` row, both confirmed test/placeholder data. Deleted directly against production D1 (`ai-campaign-builder-db`) in FK-safe order: `business_microsite_modules` (56 rows) -> `business_microsites` (7 rows) -> `business_subscriptions` (1 row) -> `staff` (1 row) -> `businesses` (7 rows). کافه تایم is now the only business in the database. **Part 2 (live end-to-end OTP verification) still not started** -- needs a human to actually open کافه تایم's microsite join link (`/join/cafetime01?business=biz-5bf8e0b2`), go through the flow, and confirm the resulting profile/tasks/rewards show real data (4 tasks, 6 rewards), since this requires phone/browser access nothing in this session has.

    **Blocker partially reduced 2026-09-12, PR #63 (squash commit `fab14b6`):** since no real SMS provider is wired in anywhere yet (every OTP is already a fixed `DEV_OTPS` stub -- business_owner=7712, customer=5432, review_team=9911, staff=3321 -- previously only visible via a backend `console.log`), `POST /request-otp` now echoes `devOtp` in its response and all 4 apps' `AuthScreen.tsx` show it as an on-screen toast right after phone submit. This doesn't remove any real verification step (there wasn't one to remove) -- it just means a human tester no longer needs server/log access to know the code, only a browser. Every change is comment-marked TEMPORARY, meant to be deleted once a real SMS provider replaces `DEV_OTPS` entirely. **Still not done:** the actual live click-through itself -- this is a human-doable task now, not a machine-verifiable one from within a session.

    Not in scope for this item: anything about how a business itself is discovered/created (onboarding wizard, Item 8) -- this is purely about a *customer* correctly landing in the *right already-existing* business's campaign.

---

14. ~~**Customer-side referral link generation didn't actually exist -- the "کپی لینک دعوت" button was a non-functional stub.**~~ **CLOSED 2026-09-12,** built as 4 sequential steps: (A) `GET /api/customer/profile` now also returns `micrositeSlug`/`joinSlug`; (B) microsite's join handoff forwards an optional `?ref=` param to the customer app; (C) customer app captures/pre-fills it into the existing manual referral-code field; (D) wires the real copy-link button (`https://{micrositeSlug}.{MICROSITE_DOMAIN}/join/{joinSlug}?ref={personalCode}`, using a placeholder domain constant pending Open Item 3). PRs #64-66.

---

15. ~~**`POST /tasks/:id/simulate-ai-approve` was a live production endpoint that force-approved any pending task submission with zero real AI review.**~~ **CLOSED 2026-09-13.** A leftover dev/demo endpoint from the original mockup -- callable by any authenticated customer, a real exploit path (fake/no evidence, still get paid). Removed entirely (route, api-client method, customer-app button), not gated behind a flag; only path to `approved` for a `screenshot_ai` task is now Review Console's real manual-hold resolution. Same PR added a "remember me" checkbox to all 4 dashboard logins (checked = localStorage/7-day persistence as before, unchecked = sessionStorage, cleared on tab close; both storages cleared on login to avoid stale duplicates). PR #67 (commit `99a34d6`).

---

16. ~~**`review_admin` had account-administration access only (manage `review_team_members`/`review_admins`) but no campaign access at all.**~~ **CLOSED 2026-09-13.** Business owners were the only role that could view/edit a campaign; user wanted `review_admin` **full parity** (no partial/read-only subset), plus a redesigned review-console admin UI reusing business.ts's exact existing side-effect logic (join-slug generation, microsite featuring, highlight defaults) -- no audit trail added.

    Built as a 7-step sequential chain, each its own branch/PR:
    - **A** -- exported/refactored `business.ts`'s campaign logic (`ensureCampaign`, `serializeCampaign`, `applyCampaignUpdate`, `generateCampaignForBusiness`) for reuse, no behavior change. PR #76.
    - **B** -- new `reviewAdminRouter` routes: `GET /businesses` (picker, every business, no per-business scoping), `GET/PUT /businesses/:businessId/campaign`, `POST /businesses/:businessId/campaign/generate`, delegating straight to Step A. PR #77.
    - **C** -- matching `packages/api-client` resource methods + `AdminBusinessListItem` type. PR #78.
    - **D** -- investigation (no PR): found no manual field-level campaign editor existed anywhere to copy (owners only ever regenerate-and-launch via the wizard). Scope expanded by explicit user decision into building **one shared manual campaign editor** for both roles: owner access gated behind a self-serve "حالت حرفه‌ای" (Professional Mode) toggle, admin access unconditional (full-access model); gate flag settable by either the owner or admin.
    - **E** -- backend: `businesses.manual_editor_enabled` flag + stable `id` fields returned on tasks/rewards (already real PKs, just not previously selected/returned). `PUT /campaign` stays whole-array replace, no new granular per-item endpoints. Migration 0013. PR #79.
    - **F** -- business-owner frontend: Settings toggle + `CampaignEditorTab.tsx` manual editor at `/dashboard/campaign/edit`, gated by the flag. PR #80.
    - **G** -- extracted the editor into a shared `@ai-campaign-builder/campaign-editor` package (option B per user decision, over copy/adapting per-app) and built review-console's admin business-picker + campaign view + the same shared editor + admin's flag-toggle control at `/admin/campaigns`. PR #81 (squash `b90334f`).

---

17. ~~**Microsite subdomain slugs are auto-generated and not human-readable -- `business_microsites.subdomain_slug` is always `biz-<first 8 chars of businessId>` (e.g. `biz-5bf8e0b2`), never something clean like `cafetime`.**~~ **CLOSED 2026-09-13,** built on branch `feat/microsite-slug-editable` as the 3 sub-steps below (all in scope, no further chain needed -- small enough not to warrant Item 16/13's step-A/B/C branch-per-step treatment).
    - **Server-side validation + one-time lock (backend).** `packages/shared-config`'s `validateMicrositeSlug()`/`RESERVED_MICROSITE_SLUGS`/`MICROSITE_SLUG_PATTERN` (new, shared with the frontend so the rule sets can't drift) enforce a DNS-label-safe charset/length (lowercase letters/digits/hyphens, 3-63 chars, no leading/trailing hyphen) and a reserved-word list (`app`, `staff`, `review`, `www`, `api`, `customer`, `backend` -- the last three reserved pre-emptively even though Item 3 hasn't picked final prefixes for `customer`/`backend`, so a future decision there can never collide with an already-claimed business slug). `routes/business.ts`'s `PUT /microsite` runs this validation before the existing uniqueness check. Migration 0014 adds `business_microsites.subdomain_slug_set_by_owner` (default 0) -- once a slug change is saved this flips to 1, and the endpoint then rejects (409) any further attempt to change it.
    - **Owner-editable field (frontend).** `MicrositeBuilderTab.tsx` shows an editable slug input (with a two-step "ذخیره" → "تأیید نهایی" confirm, since the choice is permanent) whenever `subdomainSlugEditable` is true, and falls back to the old locked read-only display once it's false. Decided **not** to also add this to the onboarding wizard for now -- one entry point (Settings) is enough for v1; revisit only if owners actually want to set it during onboarding itself.
    - **Migration path + link-change handling, both resolved by the same mechanism.** Every pre-existing row (currently just کافه تایم, `biz-5bf8e0b2`) defaults to `subdomain_slug_set_by_owner = 0` from migration 0014, so it's automatically treated as still-editable/promptable by the frontend above -- no separate backfill script needed. For the old-link-breaking question: **decided one-time-only choice** (over keeping old slugs reserved-but-redirecting) -- since no real domain exists yet (Item 3 still undecided) there's no live redirect infrastructure to build against anyway, and locking the slug after its first real save is what actually prevents an already-shared/printed link from later 404ing, with no extra infra required.

---

18. **Revisiting Item 17's "not in the wizard for now" call -- owners want a site-address suggestion during onboarding, not only in Settings afterward.** Decided 2026-09-14: rather than a separate suggestion flow (a dedicated live-as-you-type endpoint was considered and rejected), the suggested slug rides along in the **existing** campaign-generation LLM call -- no new/separate LLM call needed.
    - **Opt-in, not forced.** Wizard Step 1 gets a new checkbox ("می‌خوای یک آدرس/صفحه اختصاصی برای کسب‌وکارت داشته باشی؟", default checked) -- some owners won't want a microsite at all, so the suggestion flow is skippable up front rather than assumed.
    - **Folded into `campaign-generator.ts`'s existing copy prompt.** When the owner opted in, `buildCopyPrompt` asks the same Google->OpenAI cascade call (Item 8's pipeline) to also return `suggestedSiteSlug` in its one JSON response, alongside the existing proposal/task/reward copy -- not a second model call.
    - **Server-side sanity pass reuses Item 17's rules exactly**, not a parallel rule set: the LLM's raw suggestion is run through `validateMicrositeSlug` (slugify-and-retry on shape failure) and the same uniqueness query `PUT /microsite` already uses (numbered-suffix retries on collision, matching `generateUniqueJoinSlug`'s existing retry pattern). If opted out, or the LLM omits the field, or every retry still collides, `suggestedSiteSlug` is simply absent from the response -- no site-address step shown.
    - **Shown after generation, not live in Step 1** -- alongside the campaign proposal result, with the same two-step "ذخیره" -> "تأیید نهایی" permanent-choice confirm Item 17 already built for `MicrositeBuilderTab.tsx`, plus a "بعداً تنظیم می‌کنم" skip (microsite keeps its auto-generated `biz-xxxx` placeholder slug either way, still editable later from Settings exactly as Item 17 left it).
    - **Status: design agreed, not yet built** -- implementation to follow on its own branch.

---

## Architecture reference
Full DB schema (35 tables) lives in `architecture.md`, not duplicated here.
