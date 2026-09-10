import { createRequestHandler } from "react-router";

// BACKEND is a Cloudflare service binding to apps/backend (see wrangler.toml's
// [[services]] entry) — app/lib/mock-data.ts's getMicrositeData() uses it to
// call the real /api/public/microsites/:slug endpoint instead of returning
// fixtures (see plan.md Phase 0.75 "Backend-wiring scope decision", 2026-09-11).
interface Env {
  ASSETS: Fetcher;
  BACKEND: Fetcher;
}

declare module "react-router" {
  interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
} satisfies ExportedHandler<Env>;
