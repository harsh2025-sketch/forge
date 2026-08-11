/**
 * Shared test fixtures for the JWT Scanner feature suite.
 *
 * Uses @forge/testing mock adapters (the canonical in-memory port
 * implementations for the test suite) and the product's in-memory
 * persistence seam. Tests never require live Clerk/Stripe credentials or a
 * database.
 */

import { createMockAuthPort, makeAuthOrganization, makeAuthUser } from "@forge/testing";
import { ProductEngine } from "@/domain/engine";
import { createMemoryScanPersistence } from "@/features/scans/memory-persistence";
import type { ScanDeps } from "@/features/scans/service";
import { createMemorySubscriptionPersistence } from "@/features/billing/memory-subscription-persistence";
import type { BillingDeps } from "@/features/billing/service";
import { createDevBillingPort, createDevBillingStore } from "@/dev-mode/billing";
import type { DevBillingStore } from "@/dev-mode/billing";

/** Fixed evaluation time used by every feature test (deterministic output). */
export const EVALUATION_TIME = 2_000_000_000;

export function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

/** Builds a compact JWT from header/payload objects. */
export function makeJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown> = {},
  signature = "signature",
): string {
  return `${encodeJson(header)}.${encodeJson(payload)}.${signature}`;
}

/** A token that triggers the none_alg finding. */
export function noneAlgToken(): string {
  return makeJwt({ alg: "none", typ: "JWT" }, { sub: "1234567890", exp: EVALUATION_TIME + 60 });
}

/** A clean token (HS256, no findings without extra config). */
export function cleanToken(): string {
  return makeJwt({ alg: "HS256", typ: "JWT" }, { sub: "1234567890", exp: EVALUATION_TIME + 60 });
}

export const TEST_USER = makeAuthUser({
  id: "user_test_0001",
  email: "scanner@example.test",
  name: "Test Scanner",
});
export const TEST_ORG = makeAuthOrganization({
  id: "org_test_0001",
  name: "Test Organization",
  slug: "test-organization",
});
export const OTHER_ORG = makeAuthOrganization({
  id: "org_test_0002",
  name: "Other Organization",
  slug: "other-organization",
});

/** Auth port with one authenticated user in TEST_ORG. */
export function testAuthPort() {
  return createMockAuthPort({
    currentUser: TEST_USER,
    organizations: [TEST_ORG, OTHER_ORG],
    memberships: { [TEST_USER.id]: [TEST_ORG.id] },
  });
}

/** Auth port for a user who only belongs to OTHER_ORG (tenant isolation tests). */
export function foreignAuthPort() {
  const foreignUser = makeAuthUser({
    id: "user_test_0002",
    email: "other@example.test",
    name: "Other User",
  });
  return createMockAuthPort({
    currentUser: foreignUser,
    organizations: [TEST_ORG, OTHER_ORG],
    memberships: { [foreignUser.id]: [OTHER_ORG.id] },
  });
}

/** Auth port with no signed-in principal. */
export function anonymousAuthPort() {
  return createMockAuthPort({ currentUser: null });
}

/** Scan deps wired with mocks: deterministic, no external services. */
export function scanDeps(overrides: Partial<ScanDeps> = {}): ScanDeps {
  return {
    auth: testAuthPort(),
    persistence: createMemoryScanPersistence(),
    engine: new ProductEngine(),
    evaluationTime: EVALUATION_TIME,
    ...overrides,
  };
}

/** Scan deps authenticated as a user of OTHER_ORG (tenant isolation tests). */
export function foreignScanDeps(overrides: Partial<ScanDeps> = {}): ScanDeps {
  return {
    ...scanDeps(overrides),
    auth: foreignAuthPort(),
  };
}

/** Billing deps wired with the dev-mode in-memory billing port. */
export function billingDeps(overrides: Partial<BillingDeps> = {}): BillingDeps {
  return {
    auth: testAuthPort(),
    billing: createDevBillingPort(),
    subscriptions: createMemorySubscriptionPersistence(),
    baseUrl: "https://jwt-scanner.example.test",
    ...overrides,
  };
}

/** Creates a billing deps set sharing one dev-mode store. */
export function billingDepsWithStore(store: DevBillingStore = createDevBillingStore()): {
  deps: BillingDeps;
  store: DevBillingStore;
} {
  return {
    deps: {
      auth: testAuthPort(),
      billing: createDevBillingPort(store),
      subscriptions: createMemorySubscriptionPersistence(),
      baseUrl: "https://jwt-scanner.example.test",
    },
    store,
  };
}
