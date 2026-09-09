import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

// UNLIKE the sibling apps' plain `reactRouter()`-only Vite config, this app
// needs the Cloudflare plugin too: it's a real SSR Worker (see wrangler.toml
// and workers/app.ts), not a static SPA build. The Cloudflare plugin gives
// `npm run dev` a dev-time Workers runtime (so `context.cloudflare.env`
// behaves like it will in production) instead of a plain Node dev server.
export default defineConfig({
  // viteEnvironment.name controls the Cloudflare plugin's per-environment
  // build output folder (dist/<name>). react-router.config.ts sets
  // buildDirectory: "dist", and @react-router/dev's own convention expects
  // the server bundle at dist/server — so this must be "server", not the
  // plugin's own default "ssr", or the two build steps write/read from
  // different folders and the SSR step fails to find its manifest.
  plugins: [cloudflare({ viteEnvironment: { name: "server" } }), reactRouter()],
});
