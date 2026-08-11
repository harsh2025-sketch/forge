/**
 * Clerk session resolver for App Router requests (Day 13 auth wiring).
 *
 * The Clerk adapter (`clerkAuthAdapter`) is dependency-injected: it receives a
 * `ClerkSessionResolver` that answers "which principal is signed in for the
 * current request?". This module binds that seam to Next.js request state:
 * it reads the Clerk session token from the request cookies (`__session`,
 * Clerk's default session-token cookie) and verifies it with the token
 * verifier created at the composition root.
 *
 * Only this module and src/providers.ts are allowed to be Next/Clerk-aware;
 * feature code consumes the resulting AuthPort.
 */

import { cookies } from "next/headers";

/**
 * The session resolver contract consumed by the auth adapter's
 * `clerkAuthAdapter` factory. It is expressed structurally here so this
 * module never imports the adapter package (only src/providers.ts may):
 * `clerkAuthAdapter({ session })` accepts any object satisfying this shape.
 */
export interface SessionResolver {
  getCurrentUserId(): string | null | Promise<string | null>;
}

export interface CookieSessionResolverOptions {
  /**
   * Verifies a Clerk session token and returns its claims. Supplied by the
   * composition root via the adapter's `createClerkTokenVerifier`.
   */
  readonly verifySessionToken: (token: string) => Promise<{ readonly sub?: string | null }>;
  /** Cookie name holding the session token (Clerk default: `__session`). */
  readonly sessionCookieName?: string;
}

/** Creates a session resolver bound to the request cookies. */
export function createCookieSessionResolver(
  options: CookieSessionResolverOptions,
): SessionResolver {
  const cookieName = options.sessionCookieName ?? "__session";
  return {
    async getCurrentUserId() {
      const store = cookies();
      const token = store.get(cookieName)?.value;
      if (token === undefined || token === "") {
        return null;
      }
      try {
        const claims = await options.verifySessionToken(token);
        const userId = claims.sub;
        return typeof userId === "string" && userId !== "" ? userId : null;
      } catch {
        // Invalid/expired token — treat as unauthenticated. Never leak the
        // verification failure reason to callers.
        return null;
      }
    },
  };
}
