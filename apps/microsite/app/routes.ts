import { type RouteConfig, index, route } from "@react-router/dev/routes";

// v1 scope: one rendered page per business (mirrors mockup/microsite-preview.html
// — a single scrollable page composed of active modules, no sub-routes). The
// business is resolved per-request from the Host header inside the index
// route's loader, not from the URL path.
//
// /join/:slug is the one exception: a small standalone page a campaign CTA
// links out to (see components/CampaignHighlight.tsx and
// routes/join.$slug.tsx), still resolving its business from the same
// Host-header/dev-query-param convention as the index route.
export default [
  index("routes/_index.tsx"),
  route("join/:slug", "routes/join.$slug.tsx"),
] satisfies RouteConfig;
