/**
 * @forge/adapter-clerk — Clerk → AuthPort/AuthMiddleware/AuthWebhookHandler.
 * V3 §3.2 (packages/adapters/clerk), §5.2, Day 5.
 *
 * The only package allowed to contain the Clerk vendor SDK (P5). Adapters
 * are instantiated exclusively in `apps/[product]/src/providers.ts`
 * (Rule Set 2.4).
 * Exports follow .ai/boundaries.md: clerkAuthAdapter, clerkAuthMiddleware,
 * clerkAuthWebhookHandler — each a dependency-injected factory so no
 * credentials are read at import time and no Clerk type leaks through the
 * @forge/auth port.
 */

export { clerkAuthAdapter, createClerkBackendClient } from "./adapter.js";
export type {
  ClerkBackendClient,
  ClerkOrganizationLike,
  ClerkOrganizationMembershipLike,
  ClerkSessionResolver,
  ClerkUserLike,
  CreateClerkAuthAdapterOptions,
} from "./adapter.js";

export { clerkAuthMiddleware, createClerkTokenVerifier } from "./middleware.js";
export type {
  ClerkSessionClaims,
  ClerkTokenVerifier,
  ClerkUnauthorizedResponse,
  CreateClerkAuthMiddlewareOptions,
} from "./middleware.js";

export { clerkAuthWebhookHandler } from "./webhook.js";
export type {
  ClerkOrganizationEvent,
  ClerkUserEvent,
  CreateClerkAuthWebhookHandlerOptions,
} from "./webhook.js";
