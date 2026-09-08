import { createRequestHandler } from "react-router";

// No D1/backend bindings yet (see wrangler.toml and app/lib/mock-data.ts) —
// this stays an empty shape until real bindings are wired up.
interface Env {
  ASSETS: Fetcher;
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
