# AI Campaign Builder — Staff POS app

Stack: **React + Vite + TypeScript + Tailwind CSS + Framer Motion**, plus
**vite-plugin-pwa** for the installable manifest + service worker (see
`plan.md` Phase 5 "Deployment architecture" — this is the one persona that
needs PWA scope, which is why it's a separate deployment from the others).

## Getting started
```bash
cd apps/staff-pos
npm install
npm run dev
```

## Auth
Shared-device PIN (not phone+OTP like Business Owner/Customer) — decided
2026-09-09. One PIN unlocks the whole device for a shift; see `src/lib/auth.tsx`
for the mocked dev PIN.

## Structure
```
apps/staff-pos/
  index.html
  vite.config.ts       — includes VitePWA manifest config
  public/icon.svg       — placeholder PWA icon
  src/
    main.tsx            — entry point + service worker registration
    App.tsx             — route table (/login, /)
    lib/auth.tsx         — shared device PIN auth
    lib/mock-data.ts     — stub customer/redemption directories + offline-queue sync logic
    routes/AuthScreen.tsx
    routes/ProtectedRoute.tsx
    routes/StaffPosHome.tsx — 3 tabs: log purchase, fulfill reward, offline queue
```

## Offline queue (ports mockup Gap #9)
`src/lib/mock-data.ts`'s `syncOfflineQueue` mirrors `mockup/shared/app.js`'s
`syncStaffOfflineQueue`: duplicate detection via idempotency key, then a
customer/campaign validity check, before committing points. Toggle "حالت
آفلاین" in the app to queue actions locally, then sync to see all three
outcomes (synced / duplicate / invalid).

## Relationship to `mockup/`
Same rule as the other persona apps — `mockup/staff-pos.html` is a logic/behavior
reference only, not a visual one. See plan.md Phase 5 for the full rationale.
