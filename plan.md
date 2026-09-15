# AI Campaign Builder — Plan

## Positioning
> Tell us your goal. AI builds the campaign.
> (فارسی: هدفت رو بگو؛ کمپینت رو بساز.)

No separate MVP — went straight to the full/main version.

---

## Current Status (as of 2026-09-15)

All 5 apps + backend are built, deployed, and wired end-to-end. Auth is real phone+OTP for all 4 dashboard personas (no dev bypass anywhere in code).

| Persona | Backend routes | Auth |
|---|---|---|
| Business Owner | `routes/business.ts` | phone+OTP |
| Customer | `routes/customer.ts` | phone+OTP (+referral code at signup) |
| Staff POS | `routes/staff-pos.ts` | phone+OTP, `role: 'staff'` |
| Review Console | `routes/review.ts` | phone+OTP per team member, plus `review_admin` (username+password) |

Microsite (`apps/microsite`) is a separate public SSR app, backend-backed via a Cloudflare service binding to `apps/backend` (no auth on the microsite itself). All 6 v1 business-category templates + platform landing page are live; `/join/:slug` hands off to the customer app.

`apps/deploy-index` is a temporary static directory page, pending a real domain purchase.

Full build history (PRs #2 onward) lives in git / PR descriptions, not narrated here — this doc stays a living spec + open-items tracker, not a changelog. (Trimmed/consolidated 2026-09-11 and again 2026-09-15 — see git history for anything older than the "Open Items" summaries below.)

**In flight:** PR #116 (`fix-draft-campaign-launch-orphan`) — fixes a campaign getting stuck in `draft` if the owner refreshes/navigates away between wizard generation and hitting Launch, plus a related read-only-UI cleanup in the shared `CampaignEditor`. Pushed, CI pending, not merged.

---

## Phase 0 — Onboarding & Campaign Generation

4 core questions: business type, goal (acquisition / retention / both), audience, offer. Plus a deterministic per-category conditional question (see `CampaignWizardTab.tsx`'s `CATEGORY_OPTIONS`). v1 categories (6): کافی‌شاپ/کافه، فروشگاه لباس/پوشاک، رستوران/فست‌فود، فروشگاه آنلاین، باشگاه/سالن ورزشی، کلینیک زیبایی.

**Output:** goal/duration/audience (auto-filled) + weighted tasks + weighted rewards + one Challenge. Two actions on the review screen: **Launch** / **Edit** — Launch is a one-time action; see PR #116 above for the bug where losing that in-memory state orphaned a campaign in `draft`.

**Post-launch guidance:** "Next Steps" checklist card on Dashboard (auto-hides once complete, per-business), 2 auto-detected items (AI constraints saved, ≥1 contact imported). No guided tour. See architecture.md `onboarding_checklist_items`.

---

## Phase 0.5 — Attribution & Tracking

- Every joined customer gets a unique personal code/QR, reused across all tracking.
- Verification per task type: Follow/Share → screenshot + AI vision review; Referral → auto-linked via code at signup; Purchase → staff scans/enters code at POS, with a retroactive receipt-upload fallback (48–72hr window, dedup, rate-limited).
- Point expiry: 2-day grace period after campaign end, then 70% forfeited / 30% carried over as a starting bonus on that customer's next campaign with the same business.
- Referral abuse prevention: OTP-verified signups, referral points Pending until first purchase, max 10 referrals/referrer/campaign, rule-based anomaly flags (velocity, dead-referral-ratio) reviewed manually in Review Console — never auto-blocked.
- Reward redemption: separate short-lived (5–10 min) redemption code, distinct from the standing personal code; points deduct at redeem-time in the customer app, fulfill only flips status.
- Staff auth: per-staff phone+OTP (`role: 'staff'`) — gives per-staff audit identity, not a shared device PIN (an earlier design considered a shared PIN; superseded before build).
- **AI review:** three-tier design (auto-approve / auto-reject / manual hold), but only manual-hold is actually built — see Open Item 5. Vision scoring (`lib/vision.ts`, provider-adapter cascade: OpenAI/Anthropic/Google, key rotation via comma-separated `*_API_KEYS`) populates `ai_confidence_score` via `waitUntil` after each submission — live in code, but no `VISION_*` provider keys are actually configured yet, so every score is still `NULL` in practice. Evidence photos store in a **private Backblaze B2 bucket** (chosen over R2/Neon — no payment method required for B2's free tier), served back only via an authenticated server-side proxy, never a public URL — but no `B2_*` secrets are configured yet either, so real uploads still fail.

---

## Phase 0.75 — Notifications (SMS + Telegram)

SMS always-on, no opt-in; Telegram opt-in via bot Start, additive only. Config-driven templates (trigger × channel). 6 triggers: campaign invite (+ dedup: one per contact per active campaign), ending-soon (~2 days out), reward-threshold-reached, submission-reviewed, mid-campaign reminder (50% elapsed, 0 tasks done), referral-joined. Owner-facing "لاگ ارسال‌ها" (Sends Log) confirms sends.

Audience acquisition: manual CSV/Excel upload + public join link/QR self-join. No Instagram follower-list import (no API access to phone numbers).

Business microsite: optional add-on, curated templates by category, toggle content modules on/off (no reordering/free-form HTML/multi-page CMS). All 6 v1 templates are live and backend-seeded with real per-template Persian copy (not fixture-only).

---

## Phase 0.9 — Pricing & Revenue Model

Monthly subscription priced by size tier; SMS billed separately by volume (Telegram bundled/free); microsite is a separate optional add-on fee. Exact price points are a later business decision — shape is fixed, numbers aren't.

SMS is a prepaid wallet: top up in advance, each send deducts cost, insufficient balance skips that send (rest of platform unaffected), low-balance alert to owner, optional hard monthly cap.

---

## Phase 1 — Abstraction Layer (Task & Reward Patterns)

Reusable behavioral patterns weighted per business category (config-driven table, not hardcoded logic).

**Task patterns:** Social Proof, Referral, Repeat Purchase, Milestone/Streak, Specific Product Push, Review/UGC, First Action/Conversion (goal-weighted), Off-Peak Visit, Anniversary/Birthday.
**Reward patterns:** Percentage Discount, Free Item/Upgrade, Free Shipping, VIP Tier, Promotional Item, Early Access.

Weighting table (0–3 scale, per category) lives in `category_pattern_weights` (migration 0010) — not duplicated here.

**Business size-tier scaling** — 3 independent signals, highest tier wins on disagreement:
| Tier | Followers/customers | Monthly revenue (تومان) | Point multiplier | Suggested duration |
|---|---|---|---|---|
| Micro | < 500 | < 50,000,000 | 0.7x | 10 days |
| Small | 500–2,000 | 50,000,000–200,000,000 | 1x | 14 days |
| Medium | 2,000–20,000 | 200,000,000–1,000,000,000 | 1.5x | 21 days |
| Large | > 20,000 | > 1,000,000,000 | 2x | 30 days |

Daily-customer-count and monthly-revenue are owner-estimated as a range (dual-handle `RangeSlider`), average feeds the table; follower count is optional (only asked if the owner has Instagram). Daily-customer-count thresholds (micro ≤15/day, small ≤50, medium ≤150, large >150) are a first guess, not benchmarked — revisit once real businesses are on the platform.

---

## Phase 2 — Post-Launch Insights (read-only, no autopilot)

Dashboard surfaces AI-generated insight cards (completion-rate flags, correlation callouts, suggested actions) — nothing auto-applies. "Low completion" = average of two deviation checks (vs. cross-campaign benchmark for that pattern+category, vs. the campaign's own other tasks). Cadence: daily digest, weekly report, anomaly-triggered alert.

Benchmark data: generic industry placeholders at launch, progressively replaced per-category as real early-adopter usage data accumulates (no pre-product manual-tracking phase).

## Phase 3 — Suggested Changes (Human-in-the-Loop)

Inputs: Phase 2 insights, live campaign state, benchmarks, goal/tier, this business's suggestion history, `business_ai_constraints`. Owner signal is implicit only: Apply or Dismiss (with reason). Two risk tiers, manual Apply required for either — low-risk (points/thresholds/tasks/duration) and high-risk (reward depth/type, checked against constraints before even being shown). Each suggestion is a `suggested_changes` row; Apply writes live and marks `applied`; the row itself is the audit log (revert = apply the inverse).

## Phase 4 — Opt-in Autopilot (not default)

Eligibility: toggle appears only after 3 manual Applies. Scope: auto-applies only `task_points`/`reward_threshold`/`campaign_duration` — add/remove-task and high-risk changes always stay manual, and constraints are still respected. `businesses.autopilot_enabled` (default off); every auto-apply fires a notification with an Undo action.

---

## Phase 5 — Production Build

**Stack:** React + Vite + Tailwind + Framer Motion. Backend: Hono on Cloudflare Workers + D1 (chosen over Postgres — avoids connection-pooling overhead for expected SMB write volume).

**Monorepo** (`apps/*`, `packages/*`, modeled on `allocsys/raffle-app`): `business-owner`/`customer`/`review-console` (dashboard SPAs), `staff-pos` (installable PWA), `microsite` (SSR, public/multi-tenant), `deploy-index` (temporary), `backend` (Hono API + migrations). Shared packages: `ui-kit` (components), `api-client` (typed fetch + per-persona resources), `campaign-editor` (shared manual editor, used by both business-owner and review-console).

**Deployment:** each app is its own Cloudflare Worker (`ai-campaign-builder-<app>.pachoolai24.workers.dev`, interim naming — no domain purchased yet). Target subdomain shape once a domain exists: `app.`/`staff.`/`review.`/`{slug}.` (wildcard, per-business microsite)/`customer.`/`api.`/bare apex (landing page).

**CI/CD:** one path-filtered `deploy.yml` — PR = typecheck/test only, push-to-`main`/manual dispatch = full deploy. Backend has extra `backend-migrate` (D1 migrations) + `backend` jobs. `.github/actions/ensure-d1-database` and `ensure-kv-namespace` idempotently look up-or-create infra by name every run. **Gotcha:** GitHub Actions `secrets` context cannot be referenced in a step-level `if:` — it silently invalidates the whole workflow file. Always gate via an `env:`-mapped bash `-z` check inside `run:` instead.

`mockup/` (PR #2) is kept only as a logic/behavior reference (flow sequencing, edge cases) — no visual inheritance in production UI.

---

## Standing rules (apply regardless of which item is being worked)

- **No incremental migrations pre-launch.** Edit `0001_init.sql`/`0002_seed_config.sql` directly, then apply by hand to live D1.
- **Only one campaign can be `active` per business at a time** (multiple `draft`/`ended` allowed). Starting a new one requires the previous active one to end first.
- Explicit `branch` param on every create/edit/delete call — never the default branch. `main` is always the base for new work.
- Don't merge PRs without asking.
- No `exec_in_codespace` — clone via bash instead (public repo, no token needed for read; a write token can be minted per-push).
- No `delegate_agent`/`delegate_designer`/`delegate_editor` until told otherwise — direct tools only.

---

## Open Items

Closed items are one-liners; only items with real remaining work keep detail. Full decision trails for closed items live in git/PR history, not here.

1–4, 6–9, 11, 12, 14–18, 20 — **all CLOSED.** Vision scoring + B2 storage (1); reviewer audit trail (2); domain-naming decision (3); stale branch deleted (4); `review_admin`/`review_team` roster + auth (6); public landing page (7); onboarding wizard build (8); business address field (9); real nav/routing replacing the old accordion (12); referral copy-link (14); removed a live force-approve exploit endpoint (15); `review_admin` campaign parity + shared `CampaignEditor` package (16); human-readable microsite slugs (17); wizard site-slug suggestion (18); natural-language campaign chat editing + wizard "thinking" transition, all 3 parts (20, PRs #98–100).

5. **Auto-approve/auto-reject tiers not implemented** — only manual-hold (Review Console) is live. Unblocked (real `ai_confidence_score` scoring pipeline exists — see Phase 0.5) but no threshold bands defined and no auto-approve/reject logic built. **Not started.**

10. **AI review scoring is not load-isolated from the main API.** Runs inline via `waitUntil` in `apps/backend`, not as a separate microservice+queue as originally speced — doesn't block the customer's response, but still competes for the same Worker's CPU budget under load. **Decided: defer** — not urgent at current volume; revisit (e.g. Cloudflare Queues) once load justifies it.

13. **Customer multi-tenant signup — mostly closed.** Steps A–D (explicit `campaignId` resolution via join-slug, replacing a "join whichever campaign is oldest in the DB" bug) are built and merged (PR #62). **Step E, Part 2 still open:** an actual human click-through of کافه تایم's live join link, to confirm real tasks/rewards show up end-to-end — not machine-verifiable from within a session.

19. **Wizard staff quick-add** — built (PR #96), logged here for reference only, not a tracked open item.

21. **Multi-campaign per business — mostly closed.** Steps A (backend: `campaignId`-scoped routes, single-active-campaign enforcement) and B (frontend: campaign list page, scoped wizard/editor routes) are merged. **Still open:** delete the legacy single-campaign routes/helpers (`ensureCampaign`'s active-then-newest fallback, `GET/PUT /campaign`, `POST /campaign/generate`, `GET /stats`) once `DashboardTab.tsx`'s overview card no longer depends on them — verify with a repo-wide search before deleting.

22. **Future idea, not scoped/started:** use a completed campaign's real participation/revenue data to refine size-tier accuracy for the business's *next* campaign, instead of only self-reported slider values. Real gaps to solve first: no revenue is captured anywhere today (purchase verification has no amount field); campaign participation ≠ total foot traffic; feeding tier N's performance into tier N+1 risks compounding an early mis-tier rather than correcting it. Would also turn Phase 2 from read-only insights into a real feedback loop into onboarding — an architectural expansion, not a small addition.

23. **`businesses` table conflation (account fields + business-profile fields in one row) — CLOSED 2026-09-15.** Split into `business_owners` (auth/account) + a slimmed `businesses` (profile, child via `owner_id`, 1-to-1 for now). PR #115 merged to `main` (commit `4733627`), CI green. Live D1 matches merged main. **Remaining housekeeping only:** branch `refactor-business-owner-entity` can be deleted manually (no delete-branch tool available) — same as `defer-business-provisioning` after PR #114.

---

## Architecture reference
Full DB schema (35 tables) lives in `architecture.md`, not duplicated here.
