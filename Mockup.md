# Mockup.md — Click-Through HTML Mockup (built & deployed)

Companion to `plan.md` / `architecture.md`. A click-through mockup demonstrating every decided flow — no real backend, no real AI/OTP/SMS/payments; everything mocked with in-memory JS and canned data.

---

## File structure (as built)
```
mockup/
  index.html               — persona picker
  business-owner.html       — persona 1 (main product)
  customer.html              — persona 2
  staff-pos.html             — persona 3
  review-console.html       — persona 4 (central team)
  microsite-preview.html    — rendered example business microsite
  shared/
    styles.css               — shared look & feel (RTL, Persian type, accordion nav, tables, badges)
    mock-data.js              — all fake seed data, loosely mirrors architecture.md entities
    app.js                    — shared helpers (toasts, formatting, wallet/carryover/anomaly logic, etc.)
```
Multi-page (plain `<a href>` navigation), no build step or framework. No persistence across reloads — in-memory JS state only; a demo artifact, not the real product's persistence layer.

---

## Personas & coverage

1. **Business Owner** — onboarding wizard → AI proposal → Launch/Edit; accordion-nav dashboard (stats, active campaign, point-carryover simulator, rewards); Phase 2 insights feed; Phase 3 suggestions (risk-tier badges, constraint filtering, Apply/Dismiss); Phase 4 autopilot (locked until 3 Applies, scope badges, Undo); Settings (SMS wallet + monthly cap, AI constraints); Microsite builder (category-filtered template gallery, module toggles); Sends Log.
2. **Customer** — join/OTP mock → personal code/QR → task list w/ verification status → points/reward progress → Redeem flow (short-lived code) → retroactive purchase claim form.
3. **Staff POS** — scan/enter code, Log Purchase, Fulfill Reward, offline queue with sync + duplicate/validity check.
4. **Review Console** (central team) — uncertain-submission queue (Approve/Reject), referral anomaly-flags queue.
5. **Microsite Preview** — renders the business's actual selected template + active modules, read live from the builder's saved state.

---

## Non-goals
No real backend/AI/SMS/OTP/payment calls. No persistence across reloads. Not pixel-perfect — priority was flow completeness over visual polish.

---

## Deployment
Live on a **Cloudflare Worker** (not Pages) at `ampaign-builder.pachoolai24.workers.dev` — static files served directly, no build step.

---

## Status: complete
All 4 personas + microsite preview built. All 9 functional gaps identified in the 2026-09-08 mockup-vs-docs comparison (business size-tier scaling, SMS wallet deduction, point carryover math, Sends Log, Phase 3/4 constraint & scope handling, microsite live sync, referral anomaly detection, retroactive purchase claims, staff POS offline validation) are implemented and merged to `main` — see plan.md "Mockup Build" for the summary and git history for detail.
