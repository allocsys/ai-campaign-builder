import { type RouteConfig, index } from "@react-router/dev/routes";

// v1 scope: one rendered page per business (mirrors mockup/microsite-preview.html
// — a single scrollable page composed of active modules, no sub-routes). The
// business is resolved per-request from the Host header inside the index
// route's loader, not from the URL path.
export default [index("routes/_index.tsx")] satisfies RouteConfig;
