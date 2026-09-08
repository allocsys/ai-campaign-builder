# AI Campaign Builder — Business Owner app

Stack: **React + Vite + TypeScript + Tailwind CSS + Framer Motion** (see `plan.md` Phase 5).

One of 5 separate persona deployments in this monorepo's `apps/` layout (see `plan.md`
Phase 5 "Deployment architecture"), modeled on `allocsys/raffle-app`'s `apps/` +
path-filtered CI pattern.

## Getting started
```bash
cd apps/business-owner
npm install
npm run dev
```

## Structure (as scaffolded)
```
apps/business-owner/
  index.html
  vite.config.ts
  tailwind.config.ts
  postcss.config.js
  tsconfig.json / tsconfig.node.json
  wrangler.toml   — Cloudflare Worker config for this app specifically
  src/
    main.tsx      — entry point
    App.tsx       — root component (placeholder screen for now)
    index.css     — Tailwind directives + base design tokens (glass-panel utility, RTL, dark gradient background)
```

## Design tokens (Step 1)
- `.glass-panel` utility class in `index.css` — the base glassmorphism surface (blur + translucency + soft shadow + rounded corners), reused for cards/modals/panels going forward.
- `tailwind.config.ts` — brand color scale, glass color tokens, `shadow-glass`, `rounded-xl2`, Vazirmatn as the default sans font.
- RTL is set at the `<html>` level (`dir="rtl"` in index.html + `direction: rtl` in base CSS).

## IMPORTANT — relationship to `mockup/`
`mockup/` (plain HTML/CSS/JS) is kept as a **logic/behavior reference only** — flows, edge cases, dedup rules, state shapes. Its visual design is explicitly NOT to be copied here; this app's look (glassmorphism, animation, layout) is designed fresh. See plan.md "Phase 5 — Production Frontend Build" for the full rationale and build order.

## Modularity note (2026-09-08)
Logic/UI meant to be shared across the 5 persona apps (design tokens, UI kit, API client, shared types, auth/OTP flow) should NOT be duplicated independently in each app — see plan.md "Code modularity requirement" for where that shared code should live once it exists.

## Next steps (Phase 5, Step 2+)
Shared component library (buttons, cards, badges, modals, accordion, form inputs, toasts) before building any real persona screens. See plan.md for the full 9-step build order.
