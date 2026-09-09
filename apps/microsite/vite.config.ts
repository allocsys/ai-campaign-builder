import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

// UNLIKE the sibling apps' plain `reactRouter()`-only Vite config, this app
// needs the Cloudflare plugin too: it's a real SSR Worker (see wrangler.toml
// and workers/app.ts), not a static SPA build. The Cloudflare plugin gives
// `npm run dev` a dev-time Workers runtime (so `context.cloudflare.env`
// behaves like it will in production) instead of a plain Node dev server.
export default defineConfig({
  // viteEnvironment.name MUST be the literal string "ssr" — this is not an
  // arbitrary label. React Router's Vite plugin hardcodes its SSR build to
  // a Vite environment named "ssr" (see @react-router/dev/dist/vite.js).
  // The Cloudflare plugin only writes its .wrangler/deploy/config.json
  // build->deploy redirect for whichever environment name is configured
  // here as the "entry worker" environment. Any other value — including no
  // override at all, which falls back to a sanitized version of the
  // wrangler.toml `name` field — creates a *second*, disconnected Vite
  // environment that never receives React Router's actual SSR build, so
  // the redirect is never written and `wrangler deploy` falls back to
  // wrangler.toml's `main`, which still points at unresolved source
  // containing the Vite-only "virtual:react-router/server-build" import.
  // Confirmed against Cloudflare's own docs: developers.cloudflare.com/workers/vite-plugin/reference/vite-environments/
  plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), reactRouter()],
});
