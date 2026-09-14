// Tiny pub/sub so lib/api-client.ts (which has no React context) can notify
// lib/auth.tsx (which owns auth state and the logout() primitive) that the
// backend just reported this business account no longer exists --
// business.ts's exists-check guard, added in commit 7080146, now returns a
// distinct { code: "business_account_deleted" } (403) for this instead of
// the same generic 401 used for an expired/invalid token.
//
// A plain module-level bus, not a React context, on purpose: api-client.ts
// is imported by auth.tsx already (readStoredAuth/getToken), so having
// api-client.ts import *back* from auth.tsx to call a context setter would
// be circular. Neither this file nor api-client.ts imports auth.tsx, and
// auth.tsx is the only subscriber, so there's no ordering issue.
type Listener = () => void;

let listeners: Listener[] = [];

export function notifyAccountDeleted() {
  for (const listener of listeners) listener();
}

export function subscribeAccountDeleted(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}
