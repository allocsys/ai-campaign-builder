# @ai-campaign-builder/backend

API-first Cloudflare Workers backend for the AI Campaign Builder platform. Built with Hono and Cloudflare D1.

Companion to `architecture.md` and `plan.md` at the repository root, which serve as the full specification of the data model, task/reward patterns, and business logic.

## Architecture & Integration

This backend is designed as a headless API consumed by the 5 frontend/persona Cloudflare Worker apps in this monorepo:
1. **Business Owner App** (`apps/business-owner`)
2. **Customer App** (`apps/customer`)
3. **Staff POS App** (`apps/staff-pos`)
4. **Review Console App** (`apps/review-console`)
5. **Microsite Renderer** (`apps/microsite`)

## Local Development Commands

```bash
# Install dependencies
npm install

# Run local Workers dev server
npm run dev

# Apply local D1 database migrations
npm run db:migrate:local

# Typecheck TypeScript files
npm run typecheck
```

## Infrastructure & Secrets Note

- **Database ID:** The `database_id` in `wrangler.json` / configuration is set to a placeholder (`REPLACE_WITH_REAL_D1_DATABASE_ID`) pending real D1 database provisioning on Cloudflare.
- **Secrets:** Sensitive environment variables such as `JWT_SECRET` and SMS/OTP provider credentials are not committed to source control and must be provisioned via `wrangler secret put` prior to production deployment.
