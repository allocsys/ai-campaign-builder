# AI Campaign Builder — Plan

## Positioning
> Tell us your goal. AI builds the campaign.
> (فارسی: هدفت رو بگو؛ کمپینت رو بساز.)

No separate MVP — going straight to the full/main version.

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
Customer uploads receipt photo/screenshot afterward. Rules: 48–72hr submission window, receipt-hash duplicate detection, rate-limited per customer, stricter/more cautious AI confidence threshold than a live POS scan.

### Point expiry & carryover
2-day grace period after campaign end (full balance access). After grace: 70% forfeited, 30% carried over as a credit tied to customer+business, auto-applied as a starting bonus when they join that business's next campaign. Carryover itself has no separate expiry once granted.

### Referral abuse prevention
1. OTP phone verification at signup (all customers, not referral-specific).
2. Referral points stay Pending until the referred customer's first purchase (not just signup).
3. Cap: max 10 referrals counted per referrer per campaign.
4. Anomaly detection (rule-based, advisory-only, daily batch job → `referral_flags`): velocity rule (>5 new referred signups/24h) and dead-referral-ratio rule (≥5 referred customers, >7 days old, 0 purchases). Flags never auto-block — human review only.

### Reward redemption fulfillment
Separate one-time, short-lived (5–10 min) redemption code/QR generated on Redeem tap — distinct from the standing personal code, scanned via a dedicated "Fulfill Reward" POS action.

### POS-side UX
Staff device: web app (PWA), the only client for v1 (no native app) — backend built API-first so a native client can be added later without backend rework. Code entry: QR primary, short numeric backup code always shown as fallback.

### AI review decision system
Three-tier outcome per AI-reviewed submission: auto-approve (high confidence) / auto-reject (low confidence, resubmit allowed) / manual hold (uncertain). Central team reviews uncertain cases initially (move to per-business review later). Points stay **Pending** until final approval. Offline: staff-side queue stores locally, final verification/dedup happens server-side once synced.

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
Curated template gallery, filtered by business category. Owner picks template + toggles content modules on/off (hero/about/gallery/testimonials/booking CTA/contact/active-campaign, etc. — AI picks sensible per-category defaults); no reordering, no free-form HTML, no multi-page CMS. Deployed to a hosted subdomain, embeds the campaign join link/QR. Fully optional/additive.

---

## Phase 0.9 — Pricing & Revenue Model

- Monthly subscription, priced by size tier.
- SMS billed separately by volume (Telegram stays bundled/free).
- Business microsite = separate optional add-on fee.
- Exact price points/rates: left for a later business decision — shape is fixed, not the numbers.

### SMS prepaid wallet
Business tops up in advance; each SMS deducts its cost at send time; insufficient balance → that SMS is skipped (not sent/charged), rest of the platform unaffected; low-balance alert to owner. Optional hard monthly spending cap on top of the wallet (Telegram unaffected either way).

### Business owner authentication
Phone number + SMS OTP only — no email/password, matches the customer-facing flow.

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

## Mockup Build (2026-09-08) — status: complete

9 functional gaps found via a plan.md/architecture.md-vs-mockup comparison, prioritized and closed out on branch `mockup-gap-fixes`, merged to main via PR #2 (commit `f9d6308`):
- P0: Campaign invite Sends Log
- P1: business size-tier dynamic scaling, SMS wallet real deduction + monthly cap, point expiry/grace/carryover math
- P2: Phase 3 constraint enforcement + Phase 4 scope badges, microsite live module sync, referral anomaly detection + cap enforcement
- P3: retroactive purchase claim flow, staff POS offline queue server-side validation

All 9 are live in `mockup/` on `main`. See git history for implementation detail.

---

## Phase 5 — Production Frontend Build (decided 2026-09-08)

**Stack:** React + Vite, Tailwind CSS, Framer Motion. Chosen for build speed, easy glassmorphism (Tailwind `backdrop-blur`/opacity utilities), and performant animation without hand-rolled CSS.

**Mockup's role (decided 2026-09-08):** `mockup/` is kept strictly as a **logic/behavior reference** — flow sequencing, edge cases, dedup rules, state transitions, what-field-goes-where — NOT a visual/design reference. Its plain HTML/CSS look is explicitly not to be carried forward; production UI (glassmorphism, animation, layout, typography) is designed fresh in the new stack with no visual inheritance from the mockup.

**Steps:**
1. Scaffold: Vite + React + TypeScript project, Tailwind config (RTL + Persian font), base design tokens (glass surface, color palette, spacing) as a small shared UI kit.
2. Shared component library first: buttons, cards, badges, modals, accordion, form inputs, toasts — built glassmorphism-styled and animated once, reused across all personas (mirrors mockup's `shared/` pattern).
3. Routing/app shell + auth screens (phone+OTP) for business owner and customer personas.
4. Business Owner persona: onboarding wizard → dashboard → insights → suggestions → autopilot → microsite builder → settings → sends log, one screen at a time, wired to real API endpoints as they come online (mock/stub data until then).
5. Customer persona: join/OTP → code/QR → tasks → rewards → redemption → retroactive claim.
6. Staff POS persona (PWA): scan/enter code, log purchase, fulfill reward, offline queue+sync.
7. Review Console persona (central team): submissions queue, referral flags queue.
8. Microsite renderer (public-facing, template + modules).
9. Polish pass: animation/transition consistency, performance audit (bundle size, lazy-loading per persona route), accessibility.

Each step ships against the real backend once its endpoints exist; until then, stub with the same shape as `mock-data.js` so the frontend isn't blocked on backend sequencing.

### Deployment architecture (decided 2026-09-08)

**5 separate deployments, one per persona** — not one combined SPA:
1. **Business Owner** app (authenticated dashboard)
2. **Customer** app (public, high-traffic, mobile — kept as lean/fast as possible, Iranian mobile data costs matter)
3. **Staff POS** app (installable PWA — needs its own manifest + service worker scope, awkward to share an origin with a non-PWA app)
4. **Review Console** (internal team only — isolated for security/smaller attack surface, can sit behind extra auth later)
5. **Microsite renderer** (public, per-business subdomain via `business_microsites.subdomain_slug` → `{slug}.ourdomain.com` — structurally different from the other four: multi-tenant, SEO-facing, likely wants SSR/static generation rather than an SPA)

**Repo structure — monorepo, modeled directly on `allocsys/raffle-app`** (verified 2026-09-08, reuse this pattern rather than inventing a new one):
```
apps/
  business-owner/   — own package.json, wrangler.toml, tsconfig.json, vite.config.ts
  customer/          — same
  staff-pos/          — same (+ PWA manifest/service worker)
  review-console/    — same
  microsite/          — same (subdomain-aware routing)
  backend/            — API (once built), own migrations/ folder
```
Each app is a fully self-contained Vite project, deployed as its own Cloudflare Worker.

**CI/CD — one `deploy.yml`, path-filtered per app** (same shape as raffle-app's, adapted to 5 frontend apps + 1 backend instead of 2+1):
- `dorny/paths-filter` computes which `apps/<name>/**` folders changed in a push/PR.
- One job per app; each only runs (typecheck + test + deploy) if its own folder (or the workflow file itself) changed.
- Each job has its own `concurrency` group (`deploy-<app>-${{ github.ref }}`) so one app's in-flight deploy can't get cancelled by an unrelated push to a different app.
- `pull_request` events: typecheck/test only, no deploy (CI gate). `push` to main and manual `workflow_dispatch`: full deploy. `workflow_dispatch` force-runs all apps regardless of changed paths.
- Backend app (once it exists): migrations run gated on its own migrations/ folder changing, backend deploy waits on migrations succeeding-or-skipped, plus pre-deploy checks that required secrets (JWT secret, any bot/API tokens) actually exist before deploying — fails fast instead of shipping a broken deploy.

**NEXT STEP when resuming:** restructure the existing `frontend/` scaffold (branch `frontend-scaffold`, commit `18dba46`) into this `apps/business-owner/` layout (or decide which persona to scaffold first into the new structure), then add the path-filtered `deploy.yml`. Business domain/subdomain names and Cloudflare account/project details are not yet decided — confirm before wiring actual `wrangler.toml` routes.

---

## Status Log
- **2026-09-07** — Repo created. Core onboarding + abstraction layer agreed. All 5 initial open questions resolved (categories, weighting table, size-tier scaling, benchmark strategy, Phase 2 metrics).
- **2026-09-07** — Phase 0.5 (Attribution & Tracking) fully specified: personal code system, POS UX, offline handling, retroactive claims, 3-tier AI review.
- **2026-09-07** — Tech stack decided: Node.js/TypeScript + PostgreSQL, PWA staff client. Full schema moved to `architecture.md`.
- **2026-09-07/08** — Remaining "later/v2" items resolved and folded into the main build: PWA-only staff app (API-first backend), referral anomaly detection rules, monthly SMS cap, microsite modular sections, 2 new notification triggers, Phase 3 design, Phase 4 design.
- **2026-09-08** — Post-launch guidance (Next Steps checklist) and campaign-invite Sends Log designed and committed to docs; business-owner dashboard nav reworked from horizontal tabs to accordion (mockup-only, no schema impact).
- **2026-09-08** — Full mockup-vs-docs gap analysis (9 gaps) run, prioritized, implemented via `delegate_editor`, and merged to `main` (PR #2) — see "Mockup Build" above.
- **2026-09-08** — Sends Log table mobile rendering bug (message column collapsing to one word/character per line) fixed via `table-layout:fixed` + explicit per-column widths on that table.
