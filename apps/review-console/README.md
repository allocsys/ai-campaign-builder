# AI Campaign Builder — Review Console app

Stack: **React + Vite + TypeScript + Tailwind CSS + Framer Motion** (see `plan.md` Phase 5).

One of 5 separate persona deployments in this monorepo's `apps/` layout (see `plan.md`
Phase 5 "Deployment architecture"). Internal-team-only persona — isolated deployment
for a smaller attack surface, per the deployment architecture rationale.

## Getting started
```bash
cd apps/review-console
npm install
npm run dev
```

## Who this is for
The central review team: uncertain AI-reviewed task submissions, retroactive purchase
claims (Gap #8 in the mockup phase), and referral-abuse anomaly flags (velocity /
dead-referral-ratio rules). Ported from `mockup/review-console.html` +
`mockup/shared/app.js`'s `resolveSubmission` / `runReferralAnomalyDetection` /
`resolveFlag` — same rules, reworked as pure functions over React state (see
`src/lib/mock-data.ts`) instead of mutating a global `window.MOCK` object.

## Auth
Phone + SMS OTP per team member (plan.md "Review Console authentication", decided
2026-09-09) — NOT a shared PIN like Staff POS. This gives the audit trail
(`reviewed_by` on submissions and flag resolutions) a real per-person identity
instead of the mockup's hardcoded `'central_team'` string. Dev OTP: `9911`
(distinct from Business Owner's `7712`, Customer's `5432`, Staff POS's `2468`,
so all four apps can be tested side by side unambiguously).

## Structure
```
apps/review-console/
  index.html
  vite.config.ts / tailwind.config.ts / postcss.config.js
  tsconfig.json / tsconfig.node.json
  wrangler.toml
  src/
    main.tsx
    App.tsx              — route table (/login public, / protected)
    index.css
    lib/
      auth.tsx            — phone+OTP per reviewer
      mock-data.ts        — stub submissions/flags data + pure resolve/detect functions
    routes/
      AuthScreen.tsx
      ProtectedRoute.tsx
      ReviewConsoleHome.tsx — submissions queue + referral flags queue
```

## IMPORTANT — relationship to `mockup/`
`mockup/` is a **logic/behavior reference only**. This app's visual design (glassmorphism,
animation, layout) is designed fresh in the new stack — no visual inheritance from the
mockup's plain HTML/CSS look. See plan.md "Phase 5 — Production Frontend Build".

## Not yet done
Not wired into `.github/workflows/deploy.yml`'s deploy secrets/routes (path-filtered CI
job exists, but Cloudflare account/project + domain are still TODOs repo-wide). Not
npm-installed/run in a real environment yet (per standing project convention, CI is
trusted to catch build issues — see plan.md Phase 5 status log).
