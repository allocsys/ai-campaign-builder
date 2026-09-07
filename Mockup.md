# Mockup.md — Full-Featured HTML Mockup Plan

Companion to `plan.md` / `architecture.md`. This is a plan for a **click-through visual mockup**, built *before* any real infrastructure — a single, self-contained HTML file that demonstrates every feature/flow decided so far, for demos and to sanity-check flows before committing to the real backend build.

---

## Goal

A small **static multi-page site** (plain HTML/CSS/JS, no backend, no build step, no framework). Every screen/flow from `plan.md` is represented and clickable, wired together with fake in-memory data so a reviewer can click through the whole product story end to end.

**Not a prototype of the real system** — no real AI calls, no real OTP/SMS, no real payments, no real image upload. Everything is mocked with canned data and simple JS logic that *simulates* the real behavior well enough to demo it.

---

## Why multiple files / no persistence

- **Multiple files, not one giant HTML blob (revised 2026-09-08):** since the mockup covers 4 genuinely different apps (business owner, customer, staff POS, central team) plus a microsite preview, splitting into separate pages with shared CSS/JS keeps each file readable and easier to iterate on individually, instead of one huge file with everything inlined. Still zero build step — plain files, deploy as-is.
- **No persistence across reloads (in-memory JS state only, no localStorage):** this is a demo artifact meant to be reviewed/reset cleanly each session, not a working product — avoids the complexity (and staleness risk) of fake persisted state. The real backend (architecture.md) is where actual persistence belongs. Shared mock data is defined once (`shared/mock-data.js`) and loaded fresh by whichever page is open.

---

## File structure

```
mockup/
  index.html              — landing page: pick a persona (links to the 4 apps below)
  business-owner.html      — persona 1
  customer.html             — persona 2
  staff-pos.html            — persona 3
  review-console.html      — persona 4
  microsite-preview.html   — rendered example business microsite (linked from business-owner.html)
  shared/
    styles.css             — shared look & feel (RTL, Persian type, shared components: cards, badges, buttons)
    mock-data.js           — all fake seed data (businesses, campaigns, tasks, customers, submissions, suggested_changes, etc.), loosely mirroring architecture.md entities
    app.js                 — small shared helpers (e.g. rendering a task card, a countdown timer, a toast)
```

Each persona page is a real link between pages (plain `<a href>` navigation, not client-side routing) — simplest possible multi-page static site, works out of the box on Cloudflare Pages.

## Structure: 4 persona apps + microsite preview

Since the real architecture has 4 genuinely different apps (business owner, customer, staff POS, and internal review console), the mockup gives each its own page rather than cramming all of them behind tabs in one file. `index.html` is just a simple entry point linking to each.

### 1. Business Owner App (the main product)
- **Onboarding:** the 4 core questions + 1 conditional question (per business category, plan.md Phase 0) → generates a mock **AI Campaign Proposal** (tasks + rewards + one Challenge, pulled from the Phase 1 pattern/weight tables) → **Launch** / **Edit** actions.
- **Campaign Dashboard:** live-looking stats (mock numbers), task/reward list, customer list preview.
- **Phase 2 Insights feed:** mock daily/weekly/anomaly insight cards (e.g. "Share نرخ تکمیل پایینی دارد").
- **Phase 3 Suggested Changes:** list of suggestion cards, risk-tier badge (low/high, high shown with a warning style), rationale text, **Apply** / **Dismiss** buttons (dismiss prompts a reason).
- **Phase 4 Autopilot:** toggle is **locked/hidden** until the mock state shows 3 manually-applied suggestions, then unlocks; when on, shows a mock "autopilot applied X" log entry with an **Undo** button.
- **Settings:** notification channel status (SMS always on, Telegram opt-in status), SMS wallet balance + optional monthly cap, AI constraints (max discount %, budget ceiling).
- **Microsite builder:** template gallery (filtered by the business's category, per the 2026-09-08 decision), pick a template → module toggle list (hero/about/gallery/etc., AI-recommended defaults pre-checked) → live preview.

### 2. Customer-Facing Flow
- **Public join landing page:** mock phone-number entry + OTP step → personal code/QR + short numeric backup code screen.
- **Task list:** each task shows its verification method (screenshot upload mock, referral share link, "scan at checkout" note) and current status (pending/approved/rejected).
- **Points balance + reward progress** toward each `campaign_rewards.threshold_points`.
- **Redeem flow:** tapping Redeem generates a mock short-lived redemption code/QR with a visible countdown.
- **Notifications log (mock):** a simple feed showing what SMS/Telegram messages "would have" been sent.

### 3. Staff POS (PWA-style screen)
- Big **scan/enter code** input (camera-scan is mocked — just a button that fills in a fake scanned code — plus manual numeric entry).
- **Log Purchase** action.
- **Fulfill Reward** action (separate flow, scans a redemption code specifically).
- **Offline mode toggle** — flipping it shows a mock "queued, will sync" state to demonstrate the offline-queue concept.

### 4. Central Team Review Console
- Queue of mock "uncertain" AI-reviewed submissions (screenshots/receipts) with Approve/Reject buttons.
- Referral flags queue (open/reviewed/dismissed), showing which rule triggered it (velocity / dead-referral-ratio).

### 5. Business Microsite Preview
- A rendered example public microsite using a chosen template + active modules, with the campaign's join CTA embedded — this is what a business's actual deployed site would look like.

---

## Non-goals

- No real backend calls, no real AI, no real SMS/OTP delivery, no real payment/wallet processing.
- No persistence across page reloads.
- Not production-quality code or fully responsive polish — this is a click-through demo, optimized for showing the *shape* of every feature, not for shipping.
- Not a 1:1 pixel-perfect design pass — visual polish can come later; the priority is *completeness of flows*, not fidelity.

---

## Tech

- Plain HTML + a shared `styles.css` + shared `app.js`/`mock-data.js`, no framework, no build step, no bundler.
- **RTL, Persian UI** — matches the real product's target audience and all copy already drafted in plan.md (onboarding questions, insight message examples, etc.).
- Fake data lives once in `shared/mock-data.js` (businesses, campaigns, tasks, customers, submissions, suggested_changes, etc.), shaped to mirror the real `architecture.md` entities loosely (not a strict 1:1 schema copy — just enough structure to drive the mock UI), and is `<script>`-included by every persona page.

---

## Deployment

- **Cloudflare Pages** — simplest path, this one `index.html` as the entire site, no build command needed.
- (Alternative, not preferred: a Cloudflare Worker serving the file directly, if Pages isn't wanted for some reason.)

---

## Deliverables (in order)

1. **`Mockup.md`** (this file) — plan, committed now.
2. **`mockup/` directory** (see File structure above) — the actual mockup build (next step, not built yet).
3. Cloudflare Pages deploy of the `mockup/` directory (root = `index.html`).
