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
  future: {
    // Without this flag, react-router hardcodes its expected server-build
    // output path to "<buildDirectory>/server" (see getServerBuildDirectory
    // in @react-router/dev), no matter what Vite environment name is
    // actually configured. @cloudflare/vite-plugin's Worker-per-environment
    // convention requires the environment to be literally named "ssr" (see
    // vite.config.ts) so it lines up with react-router's own SSR build —
    // but that means output lands in "dist/ssr", not "dist/server", which
    // causes an ENOENT on dist/server/.vite/manifest.json without this flag.
    // v8_viteEnvironmentApi makes react-router read the environment's real
    // configured outDir instead of the hardcoded "server" path, resolving
    // the mismatch. This is also required for the Cloudflare plugin's
    // build->deploy config redirect (.wrangler/deploy/config.json) to be
    // written at all, since that's keyed off the same environment name.
    v8_viteEnvironmentApi: true,
  },
} satisfies Config;
