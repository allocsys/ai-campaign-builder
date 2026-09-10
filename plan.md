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
| Customer | `routes/customer.ts` (PR #29) | PR #29 | phone+OTP (+referral code, not yet consumed server-side) | ✅ per user |
| Staff POS | `routes/staff-pos.ts` (PR #30) | PR #30 | phone+OTP, `role: 'staff'` — **supersedes** the earlier shared-device-PIN decision (see Phase 0.5) | ✅ per user |
| Review Console | `routes/review.ts` (PR #32) | PR #32 | phone+OTP per team member | ✅ confirmed 2026-09-11 (browser screenshot: login, empty review queue, referral-detection batch run) |

Business Owner also gained a **Staff management tab** (PR #31) to register/toggle staff phone numbers against the staff-pos auth backend, and an **editable profile form** (PR #33 — name + SMS wallet monthly cap) replacing the old read-only Settings view.

Microsite (`apps/microsite`) is a separate SSR app, still mock-data-backed (not wired to `apps/backend` — no owner/customer auth applies to it). All 6 v1 business-category templates + platform landing page are live. `/join/:slug` is now a real route (PR #23) handing off to the customer app.

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

### Review Console authentication (decided 2026-09-09, implemented as designed)
Each central-team member authenticates with their own phone + SMS OTP, giving the audit log (`reviewed_by` on submissions, resolver identity referenced conceptually) a per-person identity. **Note:** in the current implementation `reviewed_by`/`resolved_by` are still written as fixed strings (`'central_team'`) rather than the authenticated member's own identity — the OTP login is real, but per-person attribution in the audit trail itself is not yet wired through. Would need a schema change or audit-log table (see architecture.md open items).

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

**CI/CD:** one `.github/workflows/deploy.yml`, path-filtered per app (`dorny/paths-filter`) — each app's job only runs if its own folder (or a shared `packages/**`/root `package.json`) changed. `pull_request` = typecheck/test only (CI gate, no deploy); `push` to `main` / manual `workflow_dispatch` = full deploy. Backend has two extra jobs: `backend-migrate` (`wrangler d1 migrations apply --remote`, gated on `apps/backend/migrations/**`) and `backend` (waits on migrate succeeding-or-skipped, fails fast if `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`/`BACKEND_JWT_SECRET` secrets are missing). `.github/actions/ensure-d1-database` idempotently looks up-or-creates the D1 database by name in every run — the repo's `wrangler.toml` `database_id` stays a placeholder forever.

**Mockup's role:** `mockup/` (built 2026-09-08, PR #2, 9 functional gaps closed) was kept strictly as a **logic/behavior reference** for the production build — flow sequencing, edge cases, dedup rules — never a visual reference. Production UI has no visual inheritance from it.

---

## Open Items

1. **`ai_confidence_score`** on `task_submissions` is read by Review Console but nothing populates it — no real AI scoring/vision-review pipeline exists yet. Everything currently routes to the manual-hold queue.
2. **Per-reviewer/resolver identity** not persisted in the audit trail — `task_submissions.reviewed_by` and `referral_flags.resolved_by` are fixed strings (`'central_team'`/`'business_owner'`/`'staff'` conventions), not tied to the authenticated individual, despite OTP login now giving each person a real identity. Needs a schema change or separate audit-log table.
3. **`campaigns.goal`** isn't wired into the microsite's CTA copy yet (flagged in PR #23) — needs the campaign backend relationship the microsite doesn't have (microsite is still mock-data-backed).
4. **Referral code at signup** — `verifyOtp` accepts and stores a `referralCode` client-side (customer app) but the backend `verify-otp` endpoint doesn't consume it yet (flagged in PR #29). `customer_campaign_codes.referred_by_code_id` linking is not yet wired end-to-end.
5. **Business domain name** still undecided — `workers.dev` interim naming works fine, not blocking.
6. **`CampaignReward` pattern-field gap** (flagged in PR #27) — still not blocking.
7. Stale branch `step9-bundle-optimization` (superseded by PR #18) was never deleted — no branch-delete tool available in-session; flagged for manual cleanup.
8. Auto-approve/auto-reject tiers of the 3-tier AI review system (Phase 0.5) aren't implemented — only manual-hold (Review Console) is live, since there's no real AI scoring pipeline (see item 1).

---

## Architecture reference
Full DB schema (35 tables) lives in `architecture.md`, not duplicated here.
