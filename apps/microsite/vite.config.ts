import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

// UNLIKE the sibling apps' plain `reactRouter()`-only Vite config, this app
// needs the Cloudflare plugin too: it's a real SSR Worker (see wrangler.toml
// and workers/app.ts), not a static SPA build. The Cloudflare plugin gives
// `npm run dev` a dev-time Workers runtime (so `context.cloudflare.env`
// behaves like it will in production) instead of a plain Node dev server.
export default defineConfig({
  plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), reactRouter()],
});
