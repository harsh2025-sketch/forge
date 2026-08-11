/**
 * providers.ts — JWT Scanner composition root (frozen V3 rule 2.4 / P5 / P12).
 *
 * This is the ONLY file in the application allowed to import adapter packages
 * (packages/adapters/*). Every other module consumes the wired ports from
 * here, for example:
 *
 *   import { authPort } from "@/providers";
 *
 * Day 13 wires the capabilities the product actually uses:
 *
 *   - Authentication:  AuthPort   ← @forge/adapter-clerk (Clerk)
 *   - Billing:         BillingPort + BillingWebhookHandler
 *                                   ← @forge/adapter-stripe (Stripe)
 *   - Persistence:     ScanPersistence / SubscriptionPersistence — PostgreSQL
 *                      via @forge/db (P7: the connection string is the
 *                      replacement boundary; there is no database adapter)
 *
 * Provider-neutrality is the point (P12, P21): swapping Clerk → another
 * AuthPort adapter or Stripe → another BillingPort adapter changes ONLY this
 * file (and adapter configuration) — never domain, feature, database or
 * report code.
 *
 * Runtime modes (documented in docs/PROVIDERS.md and docs/SETUP.md):
 *
 *   AUTH_MODE=live     default — Clerk adapter; requires CLERK_SECRET_KEY.
 *   AUTH_MODE=test     deterministic AuthPort seam (src/dev-mode/auth.ts) —
 *                      no credentials required; used by E2E/local test runs.
 *   BILLING_MODE=live  default — Stripe adapter; requires STRIPE_SECRET_KEY.
 *   BILLING_MODE=test  deterministic BillingPort seam (src/dev-mode/billing.ts).
 *   DATA_MODE=postgres default — Drizzle over DATABASE_URL.
 *   DATA_MODE=memory   deterministic in-memory persistence for tests/E2E.
 *
 * The dev-mode seams exist so the whole application can be exercised without
 * live provider credentials; they implement the frozen port contracts (they
 * are not new abstractions) and are never activated implicitly. In live mode
 * without the required secrets, ports fail with a clear configuration error
 * at first use (never at import time), so builds and tests without
 * credentials keep working.
 */

import {
  clerkAuthAdapter,
  createClerkBackendClient,
  createClerkTokenVerifier,
} from "@forge/adapter-clerk";
import {
  createStripeClient,
  stripeBillingAdapter,
  stripeBillingWebhookHandler,
} from "@forge/adapter-stripe";
import { AuthErrorCode, AuthPortError } from "@forge/auth";
import type { AuthPort } from "@forge/auth";
import { BillingErrorCode, BillingPortError } from "@forge/billing";
import type { BillingPort } from "@forge/billing";
import type { BillingWebhookHandler } from "@forge/billing";
import { defineString, loadConfig } from "@forge/config";
import { createCookieSessionResolver } from "@/features/auth/session-resolver";
import { createDevAuthPort, defaultDevAuthState } from "@/dev-mode/auth";
import {
  createDevBillingPort,
  createDevBillingStore,
  createDevBillingWebhookHandler,
} from "@/dev-mode/billing";
import type { DevBillingStore } from "@/dev-mode/billing";
import { createDrizzleScanPersistence } from "@/features/scans/drizzle-persistence";
import { createMemoryScanPersistence } from "@/features/scans/memory-persistence";
import type { ScanPersistence } from "@/features/scans/persistence";
import { createDrizzleSubscriptionPersistence } from "@/features/billing/drizzle-subscription-persistence";
import { createMemorySubscriptionPersistence } from "@/features/billing/memory-subscription-persistence";
import type { SubscriptionPersistence } from "@/features/billing/subscription-persistence";
import { getDb } from "@/db/client";

// ---------------------------------------------------------------------------
// Runtime modes
// ---------------------------------------------------------------------------

export type AuthMode = "live" | "test";
export type BillingMode = "live" | "test";
export type DataMode = "postgres" | "memory";

function modeOf(raw: string | undefined, fallback: string): string {
  return raw === undefined || raw === "" ? fallback : raw;
}

export const authMode: AuthMode = modeOf(process.env.AUTH_MODE, "live") === "test" ? "test" : "live";
export const billingMode: BillingMode =
  modeOf(process.env.BILLING_MODE, "live") === "test" ? "test" : "live";
export const dataMode: DataMode =
  modeOf(process.env.DATA_MODE, "postgres") === "memory" ? "memory" : "postgres";

/** Parsed, provider-neutral application configuration (never logs secrets). */
export const appConfig = (() => {
  const config = loadConfig({
    CLERK_SECRET_KEY: defineString({ required: false, secret: true }),
    STRIPE_SECRET_KEY: defineString({ required: false, secret: true }),
    STRIPE_WEBHOOK_SECRET: defineString({ required: false, secret: true }),
    APP_URL: defineString({ required: false }),
    AUTH_SIGN_IN_URL: defineString({ required: false }),
  });
  return {
    clerkSecretKey: config.ok ? config.value.CLERK_SECRET_KEY : undefined,
    stripeSecretKey: config.ok ? config.value.STRIPE_SECRET_KEY : undefined,
    stripeWebhookSecret: config.ok ? config.value.STRIPE_WEBHOOK_SECRET : undefined,
    baseUrl: config.ok ? config.value.APP_URL : undefined,
    signInUrl: config.ok ? config.value.AUTH_SIGN_IN_URL : undefined,
  };
})();

// ---------------------------------------------------------------------------
// Authentication — Clerk (via AuthPort)
// ---------------------------------------------------------------------------

/** AuthPort that fails with a clear configuration error (live mode, no key). */
function unconfiguredAuthPort(missing: string): AuthPort {
  function fail(): never {
    throw new AuthPortError(
      `Authentication is not configured: ${missing} is required in live mode (or run with AUTH_MODE=test)`,
      { code: AuthErrorCode.PROVIDER_FAILURE },
    );
  }
  return {
    getCurrentUser: async () => fail(),
    requireUser: async () => fail(),
    getOrganization: async () => fail(),
    requireOrganization: async () => fail(),
    getUserOrganizations: async () => fail(),
  };
}

function buildAuthPort(mode: AuthMode): AuthPort {
  if (mode === "test") {
    // Deterministic seam: a fixed authenticated principal with one
    // organization. No credentials required. E2E and local runs only.
    return createDevAuthPort(defaultDevAuthState());
  }
  const secretKey = appConfig.clerkSecretKey;
  if (secretKey === undefined || secretKey === "") {
    return unconfiguredAuthPort("CLERK_SECRET_KEY");
  }
  const verifySessionToken = createClerkTokenVerifier({ secretKey });
  return clerkAuthAdapter({
    client: createClerkBackendClient({ secretKey }),
    session: createCookieSessionResolver({ verifySessionToken }),
  });
}

export const authPort: AuthPort = buildAuthPort(authMode);

// ---------------------------------------------------------------------------
// Billing — Stripe (via BillingPort + BillingWebhookHandler)
// ---------------------------------------------------------------------------

/** BillingPort that fails with a clear configuration error (live mode, no key). */
function unconfiguredBillingPort(missing: string): BillingPort {
  function fail(): never {
    throw new BillingPortError(
      `Billing is not configured: ${missing} is required in live mode (or run with BILLING_MODE=test)`,
      { code: BillingErrorCode.PROVIDER_FAILURE },
    );
  }
  return {
    createCustomer: async () => fail(),
    createCheckoutSession: async () => fail(),
    createBillingPortalSession: async () => fail(),
    getActiveSubscription: async () => fail(),
    cancelSubscription: async () => fail(),
    reportUsage: async () => fail(),
  };
}

function buildBillingPort(mode: BillingMode): BillingPort {
  if (mode === "test") {
    return createDevBillingPort(devBillingStore);
  }
  const secretKey = appConfig.stripeSecretKey;
  if (secretKey === undefined || secretKey === "") {
    return unconfiguredBillingPort("STRIPE_SECRET_KEY");
  }
  return stripeBillingAdapter({ client: createStripeClient(secretKey) });
}

/** Shared in-memory store for the dev-mode billing port + webhook handler. */
const devBillingStore: DevBillingStore = createDevBillingStore();

export const billingPort: BillingPort = buildBillingPort(billingMode);

/**
 * Returns the wired BillingWebhookHandler. Live mode requires
 * STRIPE_WEBHOOK_SECRET; test mode uses the dev-mode handler (signature:
 * `x-dev-signature: dev_billing_secret`).
 */
export function getBillingWebhookHandler(): BillingWebhookHandler {
  if (billingMode === "test") {
    return createDevBillingWebhookHandler(devBillingStore, {
      secret: process.env.DEV_BILLING_WEBHOOK_SECRET ?? "dev_billing_secret",
    });
  }
  const webhookSecret = appConfig.stripeWebhookSecret;
  if (webhookSecret === undefined || webhookSecret === "") {
    throw new BillingPortError(
      "Billing webhook is not configured: STRIPE_WEBHOOK_SECRET is required in live mode",
      { code: BillingErrorCode.PROVIDER_FAILURE },
    );
  }
  return stripeBillingWebhookHandler({
    client: createStripeClient(appConfig.stripeSecretKey ?? ""),
    webhookSecret,
  });
}

// ---------------------------------------------------------------------------
// Persistence — PostgreSQL (Drizzle) or deterministic in-memory (tests)
// ---------------------------------------------------------------------------

const memoryScanPersistence: ScanPersistence = createMemoryScanPersistence();
const memorySubscriptionPersistence: SubscriptionPersistence =
  createMemorySubscriptionPersistence();

/** Returns the scan persistence for the current data mode. */
export function getScanPersistence(): ScanPersistence {
  if (dataMode === "memory") {
    return memoryScanPersistence;
  }
  return createDrizzleScanPersistence(getDb());
}

/** Returns the subscription persistence for the current data mode. */
export function getSubscriptionPersistence(): SubscriptionPersistence {
  if (dataMode === "memory") {
    return memorySubscriptionPersistence;
  }
  return createDrizzleSubscriptionPersistence(getDb());
}
