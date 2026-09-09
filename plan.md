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

**Staff authentication (decided 2026-09-09):** shared device PIN, not per-staff phone+OTP. One PIN unlocks the whole POS device for a shift; whoever is at the counter uses the same PIN — simpler for a shop counter tablet than individual staff logins. Chosen over per-staff phone+OTP (unnecessary friction for a shared counter device) and over no-auth-at-all (device-level access with no login screen, as the mockup currently has). PIN is device/business-scoped, not tied to an individual staff identity — revisit if per-staff audit trails become a requirement later.

### AI review decision system
Three-tier outcome per AI-reviewed submission: auto-approve (high confidence) / auto-reject (low confidence, resubmit allowed) / manual hold (uncertain). Central team reviews uncertain cases initially (move to per-business review later). Points stay **Pending** until final approval. Offline: staff-side queue stores locally, final verification/dedup happens server-side once synced.

### Review Console authentication (decided 2026-09-09)
The mockup hardcodes `reviewed_by` as a fixed `'central_team'` string, with no individual identification. For the production build, each central-team member authenticates with their **own phone + SMS OTP** (not a shared PIN like Staff POS, and not no-auth) — this gives the audit log (`reviewed_by` on submissions, resolver identity on referral flags) a real per-person identity instead of one shared label. Same OTP mechanism as the Business Owner and Customer apps, just scoped to a team member's phone number rather than a business or customer.

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
- `dorny/paths-filter` computes which `apps/<n>/**` folders changed in a push/PR.
- One job per app; each only runs (typecheck + test + deploy) if its own folder (or the workflow file itself) changed.
- Each job has its own `concurrency` group (`deploy-<app>-${{ github.ref }}`) so one app's in-flight deploy can't get cancelled by an unrelated push to a different app.
- `pull_request` events: typecheck/test only, no deploy (CI gate). `push` to main and manual `workflow_dispatch`: full deploy. `workflow_dispatch` force-runs all apps regardless of changed paths.
- Backend app (once it exists): migrations run gated on its own migrations/ folder changing, backend deploy waits on migrations succeeding-or-skipped, plus pre-deploy checks that required secrets (JWT secret, any bot/API tokens) actually exist before deploying — fails fast instead of shipping a broken deploy. **Note (2026-09-08, D1 decision):** raffle-app's migrate job connects directly to Postgres via `DATABASE_URL`/Hyperdrive; our backend job instead runs `wrangler d1 migrations apply` against the D1 binding — no separate `DATABASE_URL` secret or Hyperdrive-ID injection step needed, since D1 is bound directly in `wrangler.toml`.

**Deployment portability (clarified 2026-09-08):** the monorepo/multi-deployment pattern itself is host-agnostic — each app's Cloudflare specifics live only in that app's own `wrangler.toml`, isolated from app code. Moving one app (or all five) to a different host later is a config + CI-step change, not a repo restructure, and doesn't touch the React/Vite source. This is also why the apps are split by persona in the first place: it leaves room for a persona to live on a different host later (e.g. microsite wanting SSR/static-gen hosting) without affecting the others.

**Code modularity requirement (added 2026-09-08):** the 5 apps must not duplicate shared logic/UI independently. Common pieces (design tokens, UI kit from Phase 5 Step 2, API client, shared types, auth/OTP flow logic) live in a shared location — starting as `apps/*/src/shared` or a lightweight `packages/` workspace, promotable to a proper shared package later if duplication becomes a real problem. Decide the exact shared-code mechanism (npm workspace vs. simple relative imports) when the restructure actually happens, not before.

**Restructure done (2026-09-08), branch `monorepo-apps-restructure`:** the scaffold now lives at `apps/business-owner/` (moved from the old `frontend/` path — that path and the branch it lived on, `frontend-scaffold`, no longer exist; the commit history is preserved via commit `18dba46` if ever needed). Added `apps/business-owner/wrangler.toml` (static-assets Worker config, no D1 binding — this app talks to the backend over HTTP) and root `.github/workflows/deploy.yml`, path-filtered per app per the CI/CD pattern above — currently wires up only the `business-owner` job since it's the only app scaffolded so far; the other 4 persona jobs + backend get added the same way as those apps are scaffolded (see comments in the workflow file). Not yet merged to `main`, not yet npm-installed/run in a real environment. **Step 2 done (2026-09-08), same branch:** shared component library set up as a real npm workspace package, `packages/ui-kit` (root `package.json` added with `workspaces: ["apps/*", "packages/*"]`) — resolves the "decide the exact shared-code mechanism" question above in favor of a workspace package over `apps/*/src/shared` copy-paste, since we're at the restructure point now. Seven components shipped: `Button` (primary/secondary/ghost/danger), `Card` (promotes the old `.glass-panel` CSS class to a real component), `Badge`, `Modal`, `Accordion` (mirrors the mockup's header-click + programmatic-open split, deliberately no auto-advance per prior mockup feedback), `Input`, and `ToastProvider`/`useToast`. All glassmorphism-styled + Framer Motion animated, no visual inheritance from the mockup (per the mockup's-role-clarification above). `apps/business-owner` now depends on `@ai-campaign-builder/ui-kit` (`"*"` workspace version) and its `App.tsx` placeholder actually renders Card/Badge/Button/Toast from it, as a live check the workspace resolves through Vite correctly (not yet run/verified in a real npm install). `tailwind.config.ts` content glob extended to include `packages/ui-kit/src/**` so shared component classes aren't purged. `.github/workflows/deploy.yml` updated: with workspaces, `npm ci` and scripts now run from the repo root using `--workspace=apps/business-owner` rather than a `working-directory` cd into the app folder (raffle-app's original approach), and the path-filter now also triggers business-owner's job on any `packages/**` or root `package.json` change, since shared code affects every app that depends on it.

**Step 3 done (2026-09-08), same branch — business-owner only:** routing + phone/OTP auth shell built for `apps/business-owner`. Scope note: the step description says "business owner and customer personas" but only the customer app doesn't exist yet (Step 5 in the build order) — the customer persona's auth screens will reuse this same pattern when that app is scaffolded, not duplicated from scratch. `react-router-dom` wired via `BrowserRouter` in `main.tsx`. New: `src/lib/auth.tsx` (AuthProvider/useAuth, phone+OTP, localStorage-persisted session — mocked with a fixed dev OTP `7712`, same convention the mockup already uses, until the real backend exists), `src/routes/AuthScreen.tsx` (single two-step phone→OTP form, matches plan.md "Business owner authentication": phone+SMS OTP only, no email/password), `src/routes/ProtectedRoute.tsx` (redirects to `/login` when unauthenticated), `src/routes/AppShell.tsx` (minimal header + logout — the real accordion dashboard nav from the mockup is explicitly Step 4 scope, not built here), `src/routes/Dashboard.tsx` (placeholder landing screen). `App.tsx` is now the route table (`/login` public, `/` protected).

**Step 4 done (2026-09-08, same branch):** all 8 Business Owner tabs built against stub `mock-data.ts` and wired in — Onboarding (post-launch Next Steps checklist), Dashboard (active campaign tasks/rewards), Insights (read-only Phase 2 cards), Suggestions (Phase 3 Apply/Dismiss, low/high risk tiers), Autopilot (Phase 4 eligibility gate + toggle), Microsite Builder (module enable/disable, no reordering), Settings (business profile, SMS wallet, subscription/billing card), Sends Log (notifications_log view, carries forward the `table-layout:fixed` mobile CSS fix from the mockup phase). Assembled via `BusinessOwnerHome`, an accordion (mirrors the mockup's click-to-expand pattern, no auto-advance — deliberate, per earlier mockup feedback) that replaced `AppShell`'s placeholder body and is now the app's `/` route.

**Step 5 done (2026-09-09), branch `customer-app-scaffold` (separate branch from `monorepo-apps-restructure`, which was merged to `main` in between):** Customer persona app scaffolded at `apps/customer/`, same self-contained-Vite-project shape as `apps/business-owner/` (own `package.json`/`tsconfig.json`/`tsconfig.node.json`/`vite.config.ts`/`tailwind.config.ts`/`postcss.config.js`/`wrangler.toml`, depends on `@ai-campaign-builder/ui-kit` via workspace resolution). Reuses the Business Owner auth pattern per plan: `src/lib/auth.tsx` (phone+OTP, localStorage session, mocked `MOCK_OTP="5432"` matching `mockup/customer.html`'s convention — distinct from Business Owner's `7712`), `src/routes/AuthScreen.tsx` (two-step phone→OTP form, plus an optional referral-code field on the phone step — a customer-specific addition business-owner's auth doesn't need). Full customer flow built: `CustomerHome` (code/QR card, points balance, referral progress, carryover bonus, task list with per-verification-method UI for screenshot_ai/code_link_auto/pos_scan, reward redemption with a live 5-minute countdown ticket, notifications feed), `TaskSubmitModal` (evidence upload for AI-reviewed tasks), `RetroClaimModal` (retroactive purchase claim with the 3 rejection rules — outside 72hr window, duplicate receipt hash, 3-claim rate limit), and `mock-data.ts` (stub data + pure helper functions ported from `mockup/customer.html`+`mockup/shared/app.js`: `submitRetroactivePurchaseClaim`, `processReferralSignup` with cap-reached simulation). No `AppShell` for this persona (unlike Business Owner) — the customer flow is single-screen/linear, not multi-section, so there's no shell nav to wrap. `App.tsx` (route table: `/login` public, `/` protected → `CustomerHome`) and `main.tsx` (Router > AuthProvider > ToastProvider > App) added to complete the wiring — these two files were the only gap between what existed on the branch and a working app (index.html already referenced `src/main.tsx`, which didn't exist yet until this pass). `.github/workflows/deploy.yml` updated: added a path-filtered `customer` job (same shape as `business-owner`'s, own `concurrency` group, triggers on `apps/customer/**` or shared `packages/**`/root `package.json` changes). Not yet merged to `main`; not yet npm-installed/run in a real environment (per standing note, CI/CD will catch build issues — not blocking).

**NEXT STEP when resuming:** either (a) Step 6 — scaffold the Staff POS PWA persona app, or (b) merge `customer-app-scaffold` to `main` first (note: `monorepo-apps-restructure` was already merged to `main` separately — `customer-app-scaffold` was branched fresh off `main` for this step, not off the old restructure branch), or (c) a real npm install/build/run pass (still optional/non-blocking per standing note). Business domain/subdomain names and Cloudflare account/project details are still not decided — confirm before wiring real `wrangler.toml` routes for either app.

**Step 5 status update (2026-09-09):** `customer-app-scaffold` has since merged to `main` via PR #4 — the "NEXT STEP" note directly above is now stale on that point; see the Step 6 entry and updated next-step note below for the current picture.

**Step 6 done (2026-09-09), branch `staff-pos-scaffold` (forked from `main`, sibling to `customer-app-scaffold` — not stacked on it), merged to `main` via direct commit (GitHub's native PR merge could not complete due to an unresolved git-level conflict — see Status Log entry below):** Staff POS PWA persona scaffolded at `apps/staff-pos/`. Differs from the other two persona apps in two ways: (1) **auth is a shared device PIN**, not phone+OTP — see the "Staff authentication" decision under Phase 0.5 POS-side UX above; `src/lib/auth.tsx` mocks a single dev PIN `2468`. (2) **installable PWA**: added `vite-plugin-pwa` (manifest + Workbox-generated service worker, registered in `main.tsx` via `virtual:pwa-register`), a placeholder `public/icon.svg`, and PWA meta tags in `index.html` — this is the only persona app with PWA scope, per the Deployment architecture section's rationale for keeping it on its own origin. `StaffPosHome` ports `mockup/staff-pos.html`'s three tabs (log purchase, fulfill reward, offline queue) 1:1, including the Gap #9 offline-queue logic from `mockup/shared/app.js`'s `syncStaffOfflineQueue` — `src/lib/mock-data.ts`'s `syncOfflineQueue` reproduces the same duplicate-idempotency-key and customer/campaign-validity checks, reworked as a pure function over React state instead of mutating a global `window.MOCK` object. `.github/workflows/deploy.yml` updated with a path-filtered `staff_pos` job (own concurrency group). Not yet npm-installed/run (per standing note, not blocking).

**BRANCH CONVERGENCE NOTE:** `customer-app-scaffold`, `staff-pos-scaffold`, and `review-console-scaffold` were all forked from `main` independently (siblings, not stacked on each other), so each is missing the others' apps and `deploy.yml` jobs. `customer-app-scaffold` and `staff-pos-scaffold` have both now merged to `main` (see Steps 5 and 6 above) — `review-console-scaffold` still needs the same treatment before it merges, and given Step 6's PR required a manual-commit workaround (native GitHub merge failed on an unresolvable git-level conflict), expect the same to be needed for `review-console-scaffold` — check its PR's mergeability early and don't waste time on repeated merge attempts if it shows the same pattern.

**UPDATED NEXT STEP when resuming:** either (a) Step 7 — scaffold the Review Console persona app (if not already done — check `review-console-scaffold`), or merge it to `main` if it's already built, or (b) something else. Business domain/subdomain names and Cloudflare account/project details are still not decided — confirm before wiring real `wrangler.toml` routes for any of the scaffolded apps.

**Step 7 done (2026-09-09), branch `review-console-scaffold` (forked from `main`, sibling to `customer-app-scaffold`/`staff-pos-scaffold` — not stacked on either), merged to `main` via direct commit (same manual-merge workaround as Step 6 — see Status Log entry below):** Review Console persona app (central team) scaffolded at `apps/review-console/`. Auth decided via user choice (asked since plan.md didn't specify it and the mockup hardcodes `reviewed_by` as a fixed `'central_team'` string): **phone+OTP per team member** (dev OTP `9911`), giving the audit trail a real per-person identity instead of one shared label; see "Review Console authentication" under Phase 0.5 above. Two sections, 1:1 port of `mockup/review-console.html` + `mockup/shared/app.js`'s `resolveSubmission`/`runReferralAnomalyDetection`/`resolveFlag`, reworked as pure functions over React state in `src/lib/mock-data.ts`: (1) uncertain-AI-submissions + retroactive-purchase-claims queue with Approve/Reject, (2) referral anomaly flags queue with a "Run Batch Job" trigger and Dismiss/Mark-Reviewed actions. `runReferralAnomalyDetection` operates over a stub `referrerAggregates` array shaped like what the real backend endpoint would return (seeded to reproduce the mockup's two test cases: one referrer over the velocity threshold, one over the dead-referral-ratio threshold) — same simplification approach Step 5 used for `processReferralSignup`. `.github/workflows/deploy.yml` updated with a path-filtered `review_console` job (own concurrency group). Not yet npm-installed/run (per standing note, not blocking).

**BRANCH CONVERGENCE NOTE — resolved (2026-09-09):** all three sibling scaffold branches (`customer-app-scaffold`, `staff-pos-scaffold`, `review-console-scaffold`) are now merged into `main`. `main` has all four persona apps built so far (business-owner, customer, staff-pos, review-console) and a `deploy.yml` with all four jobs wired up.

**LATEST NEXT STEP when resuming:** (a) Step 8 — Microsite renderer (public, per-business subdomain, likely SSR/static-gen rather than SPA — see "Deployment architecture" above), or (b) a real npm install/build/run pass (optional, not blocking — user has confirmed CI/CD is trusted to catch issues). Business domain/subdomain names and Cloudflare account/project details are still not decided — confirm before wiring real `wrangler.toml` routes.

**Step 8 done (2026-09-09), branch `microsite-scaffold` (forked from `main`):** Microsite public renderer scaffolded at `apps/microsite/`. Architecturally different from the other 4 persona apps by design: real SSR (React Router v7 in framework mode) deployed as a Cloudflare Worker, not a static SPA — chosen because business content (e.g. `featured_campaign_id`) must be fresh on every request, not baked into a static build. Business resolution happens per-request via the `Host` header in the root route's loader (local dev falls back to a `?slug=` query param). Data layer is mock-backed (`app/lib/mock-data.ts`, `getMicrositeData()`), matching the same pattern the other 4 apps use, since `apps/backend`/D1 don't exist yet — that function is the single intended seam for wiring in a real D1 query or backend fetch later. Module rendering logic (active modules only, ordered by `display_order`, conditional `campaign_highlight` section) mirrors `mockup/microsite-preview.html`'s behavior — but the visuals were designed fresh from scratch (Tailwind, independent of both the mockup's styling and `packages/ui-kit`'s internal dashboard theme), per explicit instruction that the mockup is a logic/behavior reference only. `wrangler.toml` has no real route/domain yet, same pending-decision TODO as the sibling apps, plus a note that this app specifically will need a wildcard subdomain route once the domain is chosen. `.github/workflows/deploy.yml` not yet updated with a `microsite` job (handled separately, see Status Log). Not yet npm-installed/run (per standing note, not blocking).

**Microsite routing — revised decision (2026-09-09):** superseding the wildcard-subdomain (`{slug}.yourdomain.com`) approach described above and in the Deployment architecture section. Since a real domain isn't purchased yet, business resolution will switch from the `Host` header to a **path param** (`microsite.yourdomain.com/{slug}` — exact root subdomain name TBD) so the app is fully testable on the default `workers.dev` URL without waiting on domain purchase or wildcard DNS/route setup. This requires a code change in `apps/microsite`'s root route loader (Host-header lookup → path-param lookup), not yet implemented — tracked as follow-up work, to be done on its own branch (not `step9-a11y-part2`). **Future custom-domain option (noted, not yet needed):** for larger business customers who want their microsite on their own domain, a custom domain can be added later as an additional route on the same Worker, alongside the path-based route — no code change required, config-only, consistent with the deployment-portability principle above.

**Step 9 part 3 — deploy-index app + naming scheme formalized (2026-09-09):** a 6th app, `apps/deploy-index/`, was added: a static single-page directory (no framework, own `wrangler.toml` + `[assets]` block, mirrors the root mockup Worker's static-assets pattern) that links out to the other 5 deployed apps. It exists purely as a temporary, no-real-domain-yet convenience — the current stand-in for the "you're not lost, here's what's live" landing page a real domain's root would otherwise serve. Superseded once a real domain is purchased and DNS/routes are wired per-app.

**Current naming scheme (interim, `workers.dev`-only, no custom domain yet):** every app deploys as its own Cloudflare Worker under a single flat naming convention, `ai-campaign-builder-<app>`, resolving to `ai-campaign-builder-<app>.pachoolai24.workers.dev`:

| App | Worker name | URL |
|---|---|---|
| Business Owner | `ai-campaign-builder-business-owner` | `ai-campaign-builder-business-owner.pachoolai24.workers.dev` |
| Customer | `ai-campaign-builder-customer` | `ai-campaign-builder-customer.pachoolai24.workers.dev` |
| Staff POS | `ai-campaign-builder-staff-pos` | `ai-campaign-builder-staff-pos.pachoolai24.workers.dev` |
| Review Console | `ai-campaign-builder-review-console` | `ai-campaign-builder-review-console.pachoolai24.workers.dev` |
| Microsite (public) | `ai-campaign-builder-microsite` | `ai-campaign-builder-microsite.pachoolai24.workers.dev` |
| Deploy index (directory page) | `ai-campaign-builder-deploy-index` | `ai-campaign-builder-deploy-index.pachoolai24.workers.dev` |

This is a placeholder scheme, not the target production naming — once a real business domain is purchased, the intent (per the Deployment architecture section above) is roughly: business-owner/customer/staff-pos/review-console each get a dedicated subdomain of the real domain (e.g. `app.`, `staff.`, `review.` — exact prefixes TBD), and microsite takes over the per-business routing (`{slug}.yourdomain.com` or the interim `/{slug}` path scheme, per the routing decision above) since it's the multi-tenant, SEO-facing app. `deploy-index` has no role once a real domain exists — the domain's own root/marketing page replaces it, and this Worker can be decommissioned at that point.

---

## Status Log
- **2026-09-07** — Repo created. Core onboarding + abstraction layer agreed. All 5 initial open questions resolved (categories, weighting table, size-tier scaling, benchmark strategy, Phase 2 metrics).
- **2026-09-07** — Phase 0.5 (Attribution & Tracking) fully specified: personal code system, POS UX, offline handling, retroactive claims, 3-tier AI review.
- **2026-09-07** — Tech stack decided: Node.js/TypeScript + PostgreSQL, PWA staff client. Full schema moved to `architecture.md`.
- **2026-09-08** — Database switched from PostgreSQL to **Cloudflare D1** (all-Cloudflare stack, avoids Hyperdrive/connection-pooling for our expected SMB-scale write volume). See architecture.md Stack section for the tradeoffs accepted and the Postgres-type→D1-type mapping note.
- **2026-09-07/08** — Remaining "later/v2" items resolved and folded into the main build: PWA-only staff app (API-first backend), referral anomaly detection rules, monthly SMS cap, microsite modular sections, 2 new notification triggers, Phase 3 design, Phase 4 design.
- **2026-09-08** — Post-launch guidance (Next Steps checklist) and campaign-invite Sends Log designed and committed to docs; business-owner dashboard nav reworked from horizontal tabs to accordion (mockup-only, no schema impact).
- **2026-09-08** — Full mockup-vs-docs gap analysis (9 gaps) run, prioritized, implemented via `delegate_editor`, and merged to `main` (PR #2) — see "Mockup Build" above.
- **2026-09-08** — Sends Log table mobile rendering bug (message column collapsing to one word/character per line) fixed via `table-layout:fixed` + explicit per-column widths on that table.
- **2026-09-09** — Step 6 (Staff POS PWA persona) built on branch `staff-pos-scaffold`. GitHub's native PR merge (PR #5) could not complete despite the branch's plan.md/deploy.yml being confirmed as pure-additive diffs vs main at the file level (get_pr_mergeability kept reporting `dirty` / merge conflicts — the true git merge-base diverged from main in a way a two-way file diff couldn't reveal, and no git merge/rebase tool was available to resolve it directly). Resolved by manually replicating the branch's final file contents onto `main` via a direct atomic commit, then closing PR #5 as manually merged.
- **2026-09-09** — Step 7 (Review Console persona) built on branch `review-console-scaffold`. Its `plan.md` had retroactively rewritten shared Phase 5 status paragraphs in place (to summarize Steps 5+6 into its own copy) rather than purely appending, so PR #6's native GitHub merge also came back `dirty` despite a clean two-way diff — same underlying pattern as Step 6. Resolved with a real local `git merge` (using a short-lived write token) instead of a hand-reconstructed file: only `plan.md` and `.github/workflows/deploy.yml` conflicted, both resolved by keeping all content from both sides (all job blocks in deploy.yml; the fuller/more-current status narrative from `main`, with the branch's Step 7 writeup appended as new paragraphs afterward). Pushed directly to `main`, PR #6 closed referencing the merge commit.
- **2026-09-09** — Step 8 (Microsite public renderer) scaffolded on branch `microsite-scaffold`: React Router v7 SSR on Cloudflare Workers (architecturally distinct from the other 4 SPA persona apps, since business content must be fresh per request), mock-data-backed pending real backend/D1, visuals designed fresh (not inherited from the mockup or `packages/ui-kit`). `.github/workflows/deploy.yml`'s `microsite` job to be added separately.
- **2026-09-09** — Microsite routing decision revised: switching business resolution from `Host` header (wildcard subdomain) to a path param (`/{slug}`), since no real domain is purchased yet and this makes the app fully testable on the default `workers.dev` URL. Custom domains for larger business customers remain a future config-only addition (extra Worker route), not ruled out. Code change to `apps/microsite`'s root loader not yet implemented.
- **2026-09-09** — Step 9 part 1 (shared ui-kit accessibility fixes — Modal, Toast, Input, Accordion) merged to `main` via PR #8.
- **2026-09-09** — Step 9 part 2 (per-app accessibility sweep) built on branch `step9-a11y-part2`, applying decorative-emoji `aria-hidden`, `role="progressbar"` w/ `aria-valuenow`/`min`/`max`/label, and `role="img"`/`aria-label` on visual-only interactive elements, plus form-error `role="alert"` announcements where relevant, across all 5 apps: **customer** (`CustomerHome`, `TaskSubmitModal`, `RetroClaimModal`, `AuthScreen`), **business-owner** (all 8 tabs + `BusinessOwnerHome`), **staff-pos** (`StaffPosHome`), **review-console** (`ReviewConsoleHome`). Done via several small, single-app/few-file `delegate_editor` runs rather than one large multi-app run — earlier broader attempts (11 files/4 apps, then 8 files/1 app) got stuck looping or burned their step budget on path-hunting without landing any commits; ~4 files per run proved reliable. `apps/microsite` intentionally left out of this pass (lower priority, public/business-facing content) — still open if the a11y sweep is resumed later.
- **2026-09-09** — Step 9 part 2's PR (#14) hit the same GitHub native-merge `dirty` state as PRs #5/#6, despite a clean file-level diff after reconciling plan.md's divergence from main. A codespace-based real `git merge` was attempted (per the Step 7 precedent) but the `exec_in_codespace` tool itself failed with a server-side error (`spawn gh ENOENT`), so resolution fell back to Step 6's approach: manually replicating this branch's 11 changed code files + plan.md onto `main` via a single atomic `overwrite_files` commit, then closing PR #14 referencing that commit.
- **2026-09-09** — Step 9 part 2 follow-up: the 4 business-owner tabs (Dashboard/Insights/Suggestions/Autopilot) claimed as done in PR #14's description and in the entry above were verified by direct file read to have received **no a11y changes** — only Onboarding/MicrositeBuilder/Settings/SendsLog + BusinessOwnerHome actually got commits. Tracked as an open gap, not yet fixed.
- **2026-09-09** — Step 9 part 3: added `apps/deploy-index/`, a 6th app — a static directory page linking to the other 5 deployed Workers, deployed and confirmed live. Formalized the interim `ai-campaign-builder-<app>.pachoolai24.workers.dev` naming scheme into this doc (see Deployment architecture / Phase 5 Step 8 section above), including deploy-index's temporary role pending a real domain purchase.
- **2026-09-09** — Step 9 part 2's a11y gap (previous entry) closed via PR #16 on branch `step9-a11y-part3`: direct review of `DashboardTab`/`InsightsTab`/`SuggestionsTab`/`AutopilotTab` found no decorative-emoji or progress-bar patterns needing fixes (status is always shown via a `Badge` with visible text, not color alone) — the one genuine gap was `AutopilotTab`'s enable/disable button missing `aria-pressed`, now added. Merged cleanly (no native-merge `dirty`-state issue this time — single-file, single-line change).
- **2026-09-09** — Step 9 bundle-size follow-through, part 1: `apps/business-owner`'s 8 accordion tabs (previously statically imported into `BusinessOwnerHome.tsx`, all shipping in the main eager bundle even though `Accordion` only ever mounts the open panel) converted to `React.lazy` + per-item `Suspense`, on branch `step9-lazy-tabs`, merged cleanly via PR #17 (no native-merge `dirty`-state issue — single-file change). Each tab (incl. `MicrositeBuilderTab`/`AutopilotTab`) is now its own Vite chunk, fetched on first open. Remaining bundle-size item: `manualChunks` vendor splitting (react/framer-motion/ui-kit/react-router-dom) across all 5 apps' `vite.config.ts` — not yet done. Animation-token centralization / microsite-animations question also still open, unrelated to this change.
- **2026-09-09** — Step 9 bundle-size follow-through, part 2: found a pre-existing, never-merged branch `step9-bundle-optimization` (branched before PR #17 landed) that had independently started the same lazy-loading work (near-duplicate of #17, dropped as redundant) plus useful `manualChunks` vendor-splitting commits for `business-owner` and `customer`. Those two were carried forward onto a fresh branch (`step9-vendor-chunk-splitting`) and the same pattern was extended to `staff-pos` and `review-console` (identical plain-`react()`-plugin shape and dependency set) — merged via PR #18 (squash commit `d7d387a`). `apps/microsite` intentionally excluded: it's a real SSR Worker (`reactRouter()` + `cloudflare()` plugins, no plain `react()` plugin) whose Vite plugin owns its own client/SSR bundle split, so this manualChunks pattern doesn't map onto it directly — needs separate investigation if pursued. The stale `step9-bundle-optimization` branch is now fully superseded and safe to delete, but no GitHub branch-delete tool was available in this session to remove it directly — flagged for manual deletion. Vendor-splitting bundle-size item is now closed for the 4 applicable apps; microsite's treatment (if any) remains open.
- **2026-09-10** — Animation-token gap (flagged in the original Step 9 audit) closed via PR #19 on branch `step9-animation-tokens`: added `packages/ui-kit/src/animation-tokens.ts` (`motionDuration.fast/base/slow` = 0.2/0.25/0.35, `motionEasing.out` = `'easeOut'`), wired into `Accordion`/`Modal`/`Card` with their existing values preserved exactly (no visual change), and into `Toast` which previously had no explicit `transition` at all (implicit ~0.3s default) — now an explicit `base`/`out` transition, a deliberate minor visual tweak for consistency with Modal/Accordion. Investigation (via delegate_agent, confirmed by direct file reads) established all framer-motion usage in the repo lives inside these 4 ui-kit components — no app in business-owner/customer/staff-pos/review-console defines its own animation values, so this fully closes the gap for those 4 apps. Squash-merged, commit `74df601`, clean mergeability (no native-merge `dirty`-state issue). `apps/microsite`'s separate animation question (add some, or stay static-by-design) remains open and untouched.
- **2026-09-10** — Both of microsite's remaining open Step 9 questions resolved: (1) bundle-splitting was investigated and closed as **not worth pursuing** — `apps/microsite/package.json` confirms its client deps are already minimal (`react`, `react-dom`, `react-router`, `isbot` only; no animation lib, no ui-kit), and the app is a single-route (`_index.tsx`) SSR site, so there's no meaningful client bundle left to split. (2) Animation decided **in favor of adding it**, PR #20 merged (squash `cace578`): `HeroAmbient.tsx` (a plain Canvas2D drifting-gradient background behind Hero, using cached offscreen-canvas gradient sprites + a `prefers-reduced-motion` freeze, both patterns borrowed directly from `allocsys/madmcp-orchestration-viz`) and `Reveal.tsx` (an `IntersectionObserver`-based scroll-reveal wrapper around the other 7 sections, CSS-transition-only, defaults to fully visible so no-JS/crawler/reduced-motion users are never affected). Zero new dependencies — native browser APIs only, keeping the app's lean bundle intact. Both Step 9 microsite questions are now closed; Step 9 itself appears fully wrapped pending user confirmation.
- **2026-09-10** — Microsite theming system + all 6 v1 category templates (minimal_cafe/bold_retail/energetic_gym/serene_beauty/fine_dining/sleek_shop) + platform landing page (`Landing.tsx`) built on branch `microsite-templates-and-landing`, merged via PR #21 (commit `c310225`). CI verified green against current HEAD (`get_check_runs`/`list_workflow_runs`, run #77) before merging, not just `get_pr_mergeability`. See "Microsite template system" writeup above for detail.
- **2026-09-10** — Dev-only auth bypass buttons added to all 4 dashboard apps (business-owner, customer, staff-pos, review-console) on branch `dev-auth-bypass`, merged via PR #22 (commit `12757dc`), CI verified green (run #79) before merging. See "Dev-only auth bypass buttons" writeup above for detail.
- **2026-09-10** — **Step 9 confirmed done by user.** All sub-items (a11y sweep, bundle-size/lazy-loading + vendor-chunk splitting, animation tokens, microsite bundle-size/animation questions) are closed and merged. Step 9 is now officially complete.

**Microsite template system (2026-09-10), branch `microsite-templates-and-landing`, merged via PR #21 (commit `c310225`):** built out the theming layer the microsite renderer needed to actually serve different business categories, plus a real platform landing page. CSS-variable theming system added to `apps/microsite/app/app.css` (one `[data-theme="..."]` block per theme: `--surface`, `--surface-alt`, `--surface-card`, `--border`, `--text`, `--text-muted`, `--text-subtle`, `--accent-bg`, `--accent-text`, `--accent-hover`, `--gallery-tile`, `--gallery-tile-text`), applied via `data-theme={template.theme_identifier}` on the rendered `<main>` in `_index.tsx`. All 8 module components + the footer refactored off hardcoded `stone-*` Tailwind classes onto these vars (`NotFound.tsx`, `root.tsx`'s ErrorBoundary, and `HeroAmbient.tsx`'s blob palette intentionally kept on fixed `stone-*`/hex colors — system-level/brand-neutral, not theme-driven). All **6 v1 business categories** from architecture.md now have a live template + demo business in `mock-data.ts`'s `MOCK_DB`:

| Category | Theme (`theme_identifier`) | Demo slug | Demo business |
|---|---|---|---|
| Coffee shop / cafe | `minimal_cafe` | `narvan` | کافه نارون |
| Clothing store | `bold_retail` | `velora` | بوتیک ولورا |
| Gym / fitness | `energetic_gym` | `titan` | باشگاه تایتان |
| Beauty clinic | `serene_beauty` | `ava` | کلینیک زیبایی آوا |
| Restaurant | `fine_dining` | `simorgh` | رستوران سیمرغ |
| Online store | `sleek_shop` | `novin` | فروشگاه اینترنتی نوین |

Also added: `Landing.tsx`, a platform landing page shown when a request carries no resolvable business context (bare `workers.dev` root, no `?slug=`) — distinct from `NotFound.tsx`'s per-slug 404 — linking out to all 6 demo microsites; and a `<select>` template picker on `apps/deploy-index/public/index.html`'s Microsite row, kept in sync with the same 6 demo businesses. All three of these lists (MOCK_DB, Landing.tsx's `DEMO_LINKS`, deploy-index's picker) must stay in sync whenever a template is added or removed.

**Dev-only auth bypass buttons (2026-09-10), branch `dev-auth-bypass`, merged via PR #22 (commit `12757dc`):** added a "🔓 ورود آزمایشی (Dev Bypass)" button to all 4 dashboard apps' login screens (business-owner, customer, staff-pos, review-console), skipping OTP/PIN entry for quickly viewing mock data during dev/QA. Each app's change is two small, clearly delimited blocks (`// === DEV BYPASS START/END ===`) — one in `lib/auth.tsx` adding a `devBypass()` function, one in `routes/AuthScreen.tsx` adding the button — with no change to the existing OTP/PIN flow itself. Intended to be deleted alongside the mock data once a real backend/auth exists; the markers make both files' bypass code trivial to find and remove in one pass. Not wired into `apps/microsite` (that app has no auth to bypass).
