/**
 * Auth test data factories — deterministic builders for @forge/auth types.
 * V3 §3.2 (packages/testing/src/factories/), Day 5.
 *
 * Every factory returns a fresh, valid value each call. Identifiers are
 * sequence-based so repeated calls never collide. Overrides win over defaults.
 */

import type { AuthOrganization, AuthUser } from "@forge/auth";

let userSequence = 0;

/** Builds a valid AuthUser with a unique id/email per call. */
export function makeAuthUser(overrides?: Partial<AuthUser>): AuthUser {
  userSequence += 1;
  const n = userSequence;
  return {
    id: `user_${String(n).padStart(4, "0")}`,
    email: `user-${n}@example.test`,
    name: `Test User ${n}`,
    ...overrides,
  };
}

let organizationSequence = 0;

/** Builds a valid AuthOrganization with a unique id/slug per call. */
export function makeAuthOrganization(overrides?: Partial<AuthOrganization>): AuthOrganization {
  organizationSequence += 1;
  const n = organizationSequence;
  return {
    id: `org_${String(n).padStart(4, "0")}`,
    name: `Test Organization ${n}`,
    slug: `test-organization-${n}`,
    ...overrides,
  };
}
