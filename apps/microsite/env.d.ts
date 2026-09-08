/// <reference types="vite/client" />
/// <reference types="@cloudflare/workers-types" />

// React Router v7's build output is consumed by workers/app.ts through this
// virtual module — declared here so `tsc` doesn't complain about the import.
declare module "virtual:react-router/server-build" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const build: any;
  export = build;
}
