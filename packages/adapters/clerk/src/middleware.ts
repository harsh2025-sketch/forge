/**
 * Clerk → AuthMiddleware adapter.
 * V3 §3.2 (packages/adapters/clerk), §5.2 (AuthMiddleware contract), Day 5.
 *
 * The middleware verifies a Clerk session token presented as
 * `authorization: Bearer <token>` and short-circuits requests that fail
 * authentication (or lack organization context when required). It is bound
 * to the port's structural request/response contract — no web framework is
 * imported by this package.
 */

import type {
  AuthMiddleware,
  AuthMiddlewareHandler,
  AuthMiddlewareRequest,
  AuthProtectOptions,
} from "@forge/auth";
import { verifyToken } from "@clerk/backend";

/** The claims this adapter reads from a verified Clerk session token. */
export interface ClerkSessionClaims {
  /** The authenticated principal. */
  readonly sub?: string;
  /** Active organization (classic claim). */
  readonly org_id?: string | null;
  /** Active organization (versioned claim shape). */
  readonly o?: { readonly id?: string } | null;
}

/** Verifies a bearer token and returns its claims. */
export type ClerkTokenVerifier = (token: string) => Promise<ClerkSessionClaims>;

/** Response returned when the middleware short-circuits a request. */
export interface ClerkUnauthorizedResponse {
  readonly status: 401;
  readonly body: { readonly error: string };
}

/** Options for `clerkAuthMiddleware`. */
export interface CreateClerkAuthMiddlewareOptions {
  readonly verifySessionToken: ClerkTokenVerifier;
}

/**
 * Creates a ClerkTokenVerifier backed by the Clerk SDK's token verification.
 * Application wiring passes its `CLERK_SECRET_KEY` here; this package never
 * reads environment variables itself.
 */
export function createClerkTokenVerifier(options: { secretKey: string }): ClerkTokenVerifier {
  return async (token) => {
    const payload = await verifyToken(token, { secretKey: options.secretKey });
    return payload;
  };
}

function extractBearerToken(header: string | null): string | null {
  if (header === null) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (match === null) {
    return null;
  }
  const token = match[1].trim();
  return token === "" ? null : token;
}

function unauthorized(error: string): ClerkUnauthorizedResponse {
  return { status: 401, body: { error } };
}

/** Resolves the active organization claim across both Clerk claim shapes. */
function organizationClaim(claims: ClerkSessionClaims): string | null {
  const classic = claims.org_id;
  if (typeof classic === "string" && classic !== "") {
    return classic;
  }
  const versioned = claims.o?.id;
  if (typeof versioned === "string" && versioned !== "") {
    return versioned;
  }
  return null;
}

/**
 * Builds the AuthMiddleware implementation backed by Clerk session token
 * verification. Returning a response short-circuits the request; returning
 * nothing lets it continue (@forge/auth middleware contract).
 */
export function clerkAuthMiddleware(
  options: CreateClerkAuthMiddlewareOptions
): AuthMiddleware<AuthMiddlewareRequest, ClerkUnauthorizedResponse> {
  const protect = (
    protectOptions?: AuthProtectOptions
  ): AuthMiddlewareHandler<AuthMiddlewareRequest, ClerkUnauthorizedResponse> => {
    return async (request) => {
      const token = extractBearerToken(request.headers.get("authorization"));
      if (token === null) {
        return unauthorized("Unauthenticated");
      }
      let claims: ClerkSessionClaims;
      try {
        claims = await options.verifySessionToken(token);
      } catch {
        return unauthorized("Unauthenticated");
      }
      if (protectOptions?.organizationRequired === true && organizationClaim(claims) === null) {
        return unauthorized("Organization required");
      }
      return undefined;
    };
  };

  return { protect };
}
