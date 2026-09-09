import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  // @cloudflare/vite-plugin builds Workers assets into `dist/` (its own
  // convention), but react-router's SSR build defaults to looking for the
  // client manifest under `build/client/`. Left at the default, the SSR
  // build step fails with ENOENT on build/client/.vite/manifest.json even
  // though the client build succeeded (into dist/client instead). Pinning
  // buildDirectory here makes both halves of the build agree on where the
  // client output — and its manifest — actually live.
  buildDirectory: "dist",
} satisfies Config;
