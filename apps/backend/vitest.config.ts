import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";

export default defineConfig({
  plugins: [
    cloudflareTest({
      configPath: "./apps/backend/wrangler.toml",
      miniflare: {
        compatibilityDate: "2024-09-09",
        d1Databases: ["DB"],
      },
    }),
  ],
});
