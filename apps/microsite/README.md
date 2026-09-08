# AI Campaign Builder — Microsite SSR Renderer

Stack: **React Router v7 (SSR framework mode) + TypeScript + Tailwind CSS**, deployed as a **Cloudflare Worker** (not a static SPA).

## Overview
This app is the public, per-business microsite renderer — multi-tenant, SEO-facing, subdomain-aware (`{slug}.ourdomain.com`). Unlike the other 4 persona apps (authenticated SPAs), this one server-renders on every request so business content (active campaign, modules) is always fresh. It is not an authenticated persona app, and its visuals are intentionally independent from `packages/ui-kit`'s internal dashboard theme.

Subdomain → business resolution happens in `app/routes/_index.tsx`'s loader by reading the request's `Host` header. For local dev, pass `?slug=narvan` instead (no real subdomain available on localhost).

Data is currently mock-backed via `app/lib/mock-data.ts` (`apps/backend` doesn't exist yet — same pattern the other 4 apps use). That file's `getMicrositeData()` is the single seam to swap for a real D1 query or backend fetch later.

## Getting started
```bash
cd apps/microsite
npm install
npm run dev
```

## Structure
```
apps/microsite/
  wrangler.toml          # Cloudflare Worker config (SSR, not [assets]-only)
  workers/app.ts          # Worker entry point
  vite.config.ts
  react-router.config.ts
  app/
    root.tsx
    routes.ts
    routes/
      _index.tsx           # loader resolves subdomain -> microsite data
    components/            # one component per content module (Hero, About, ...)
    lib/
      mock-data.ts          # swappable data-access layer
    app.css
```
