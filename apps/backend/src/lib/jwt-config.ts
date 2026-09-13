import type { Env } from "../types";

/**
 * Resolves the JWT signing/verification secret from the Worker's env
 * bindings. Throws if JWT_SECRET is unset rather than falling back to a
 * hardcoded default -- see this file's git history / commit message for
 * why a silent fallback here is unacceptable once JWT_SECRET is ever
 * genuinely missing.
 *
 * A real deploy should never hit the throw path: .github/workflows/deploy.yml's
 * "backend" job fails the deploy before it starts if BACKEND_JWT_SECRET
 * isn't configured as a repo secret, and pushes it to the Worker as
 * JWT_SECRET via `wrangler secret put` immediately after every successful
 * deploy. This function only matters for anything that bypasses that path
 * (local `wrangler dev` with no .dev.vars, a misconfigured environment,
 * a future deploy path that skips the CI check).
 */
export function getJwtSecret(env: Pick<Env, "JWT_SECRET">): string {
  if (!env.JWT_SECRET) {
    throw new Error(
      "JWT_SECRET is not set. For local dev, add it to apps/backend/.dev.vars. " +
        "For a real deploy, set it via `wrangler secret put JWT_SECRET` (or the " +
        "BACKEND_JWT_SECRET repo secret + .github/workflows/deploy.yml's automated " +
        "push, if deploying through CI). Refusing to fall back to a hardcoded secret."
    );
  }
  return env.JWT_SECRET;
}
