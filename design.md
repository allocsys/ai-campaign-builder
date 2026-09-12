# Business Owner App — Design Overhaul Plan

**Decided 2026-09-12.** Working doc for a sequential (not big-bang) redesign of
`apps/business-owner`. Each numbered phase below should ship as its own PR,
following the project's established flow: branch → commit → PR → CI check →
explicit "merge it". Do not skip ahead or bundle phases — the whole point of
doing this sequentially is keeping each PR small enough to sanity-check.

## Problem statement (as of 2026-09-12)

The business-owner app currently has exactly **one authenticated route**
(`/dashboard` in `App.tsx`), and everything lives inside a single
`<Accordion>` in `BusinessOwnerHome.tsx` — 9 panels (Campaign Wizard,
Dashboard, Insights, Suggestions, Autopilot, Microsite Builder, Settings,
Staff, Sends Log) stacked vertically, click-to-expand, one open at a time.

Concretely, what's missing (user's own words, session 2026-09-12):
- **No real header** — `AppShell.tsx` is just a business name + phone number
  + logout button. No branding beyond a text string, no hamburger/menu
  trigger, nothing route-aware.
- **No hero** — business identity + active-campaign vitals only exist
  *inside* the Dashboard accordion panel (see `DashboardTab.tsx`'s hero
  `Card`), not as a persistent page-level hero.
- **No hamburger menu** — there is no drawer/sheet component in
  `packages/ui-kit` at all, and nothing to trigger one.
- **No bottom nav** — no persistent navigation; the only way to move between
  sections is scrolling to and clicking an accordion header.
- **"Just accordions stacked on top of each other"** — this is accurate: the
  Accordion pattern was a deliberate mockup-era decision (see
  `mockup/business-owner.html`, "Navigation Accordion (replaces horizontal
  tabs, decided 2026-09-08)") that was carried straight into the real app
  without ever being revisited for a real multi-page product.

This was a reasonable shortcut to get all 9 sections wired to the backend
fast (see `plan.md`'s Phase 5 history) but it doesn't hold up as the primary
interface for a business owner who'll open this app daily.

## Design goals

1. Turn the 9 accordion panels into **real routes** under `/dashboard/*`,
   each with its own page, not a shared scroll-and-expand list.
2. A **persistent app shell**: header (hamburger + context-aware title) +
   bottom tab bar for the primary destinations, replacing the current bare
   `AppShell.tsx`.
3. A **hero** — business identity + active-campaign vitals — shown at the
   top of the Dashboard route specifically (not globally on every page;
   Settings doesn't need a campaign progress bar).
4. Keep every existing Tab component's internal logic and backend calls
   untouched wherever possible. This is a shell/navigation rewrite, not a
   data-layer rewrite — `packages/api-client` and `apps/backend` are out of
   scope unless a phase below says otherwise.
5. RTL-correct throughout (existing convention: hamburger sits on the visual
   right, matches `dir="rtl"` already set app-wide).

## Target information architecture

**Bottom tab bar (persistent, 4 primary destinations):**
| Tab | Route | Source |
|---|---|---|
| داشبورد | `/dashboard` | `DashboardTab.tsx` (hero card becomes the route's own hero, not a card-in-a-list) |
| کمپین | `/dashboard/campaign` | `CampaignWizardTab.tsx` |
| تحلیل و پیشنهاد | `/dashboard/insights` | `InsightsTab.tsx` + `SuggestionsTab.tsx` merged into one page (two sections, not two nav destinations — they're both "AI told me something" surfaces) |
| میکروسایت | `/dashboard/microsite` | `MicrositeBuilderTab.tsx` |

Four was chosen deliberately — enough for the sections a business owner
opens often, few enough to fit a mobile-width tab bar without cramming icons.
The remaining 4 sections are lower-frequency ("set up once, revisit rarely"
or "audit trail, not a workflow") and belong in the hamburger drawer instead:

**Hamburger drawer (secondary destinations):**
| Item | Route | Source |
|---|---|---|
| خودکارسازی | `/dashboard/autopilot` | `AutopilotTab.tsx` |
| تنظیمات | `/dashboard/settings` | `SettingsTab.tsx` |
| کارکنان | `/dashboard/staff` | `StaffTab.tsx` |
| لاگ ارسال‌ها | `/dashboard/sends-log` | `SendsLogTab.tsx` |

The `OnboardingBanner` (PR #53, already shipped) keeps working as-is — it's
already outside the accordion/tab system and just needs to keep rendering
above whatever the Dashboard route's content is.

**Header:** hamburger trigger (opens the drawer above) + current page title,
replacing the static "پلتفرم کمپین‌ساز هوشمند" string. Phone number + logout
move into the drawer (account-level actions, not something needed on every
screen).

## New `packages/ui-kit` primitives needed

None of these exist yet — check `packages/ui-kit/src/index.ts` before
starting any phase below to confirm current state:
- **`Drawer`** (or `Sheet`) — slide-in panel for the hamburger menu.
- **`BottomNav`** — fixed-position tab bar, active-route highlighting.
- **`AppHeader`** — hamburger trigger + title slot, replaces the bare
  `<header>` in `AppShell.tsx`.

Reuse `Card`, `Badge`, `Button`, and `motion-tokens` for consistency with
the already-redesigned `DashboardTab.tsx` — don't invent a new visual
language for the shell.

## Sequencing

Ship in this order. Each phase is independently mergeable and leaves the app
in a working state — no phase should require a later phase to not be broken.

1. **Routing scaffold only.** Add the 8 nested routes under `/dashboard/*`
   in `App.tsx` (React Router), each initially just rendering its existing
   Tab component directly (no header/nav chrome yet). Delete nothing yet —
   the accordion can keep existing in parallel or get a temporary "old nav"
   fallback. Purely structural; verify via typecheck + build, no visual
   review needed.
2. **`AppHeader` component.** Build it in `packages/ui-kit`, wire it into
   `AppShell.tsx` with a route-aware title. Hamburger button can no-op or
   show a placeholder — this phase is about the header existing and looking
   right, not the drawer working yet.
3. **`Drawer` component + hamburger wiring.** Build the drawer, populate it
   with the 4 secondary links (Autopilot/Settings/Staff/Sends Log) plus
   phone number + logout (moved out of the header). Visual preview
   (`visualize:show_widget`) before shipping, per the project's usual
   frontend-change workflow.
4. **`BottomNav` component + primary routing.** Build it, wire the 4 primary
   destinations. Visual preview before shipping.
5. **Dashboard hero promotion.** Pull the hero `Card` out of
   `DashboardTab.tsx`'s internal list and make it the Dashboard route's own
   page-level hero (above the tasks/rewards/stats content, not one card
   among several). Merge `InsightsTab` + `SuggestionsTab` into the single
   `/dashboard/insights` page per the IA table above.
6. **Retire the accordion.** Delete `Accordion` usage from
   `BusinessOwnerHome.tsx` (and the file itself, if nothing else needs it —
   check `packages/ui-kit`'s `Accordion.tsx` isn't used elsewhere first).
   This is last on purpose: everything before this point should already work
   via real routes, so deleting the old nav is cleanup, not a cutover.
7. **Polish pass.** Active-tab styling, badge counts on nav items (e.g. a
   pending-suggestions count on "تحلیل و پیشنهاد", mirroring the mockup's
   `pending-suggestions-badge`), transition animations consistent with
   `animation-tokens.ts`.

## Non-goals (explicitly out of scope for this doc)

- No changes to `apps/backend` or `packages/api-client` — this is a
  frontend shell/navigation rewrite only.
- No changes to the *other* 4 apps (`customer`, `staff-pos`, `review-console`,
  `microsite`) — they have their own single-screen patterns and weren't part
  of this complaint. Don't let this doc's momentum drag them along.
- No redesign of any individual Tab's internal content/layout beyond what's
  needed to fit it into a real page (e.g. removing an accordion-specific
  header it no longer needs). `DashboardTab.tsx`'s internal card designs,
  `CampaignWizardTab.tsx`'s wizard flow, etc. stay as they are.
