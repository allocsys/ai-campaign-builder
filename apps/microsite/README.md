# AI Campaign Builder — Microsite SSR Renderer

Stack: **React Router v7 (SSR) + TypeScript + Tailwind CSS**, deployed as a Cloudflare Worker.

## Overview
This app is the public per-business microsite server-side rendering (SSR) service, rendering multi-tenant merchant sites (subdomain-aware: `{slug}.ourdomain.com`) with active campaign highlights, templates, and modular content. It is not an authenticated persona app.

## Getting started
```bash
cd apps/microsite
npm install
npm run dev
```

## Structure
```
apps/microsite/
  vite.config.ts
  react-router.config.ts
  wrangler.toml
  app/
    app.css
    root.tsx
    routes.ts
    lib/
      mock-data.ts
```
