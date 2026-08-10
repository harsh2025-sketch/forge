/**
 * Entitlement checks — pure, provider-neutral utilities.
 * V3 §3.2 (packages/billing/src/entitlements.ts).
 *
 * Entitlements are declared by the product's plans; these helpers answer
 * "may this plan do X?" without any provider call.
 */

import type { Entitlement } from "./types.js";

/** Returns the entitlement with the given key, or `undefined`. */
export function findEntitlement(
  entitlements: readonly Entitlement[],
  key: string
): Entitlement | undefined {
  return entitlements.find((entitlement) => entitlement.key === key);
}

/** Returns true when the entitlement is granted at all. */
export function hasEntitlement(entitlements: readonly Entitlement[], key: string): boolean {
  return findEntitlement(entitlements, key) !== undefined;
}

/** Returns the usage limit for a key: a number, or `null` when unlimited or ungranted. */
export function getEntitlementLimit(
  entitlements: readonly Entitlement[],
  key: string
): number | null {
  return findEntitlement(entitlements, key)?.limit ?? null;
}

/**
 * Returns true when the recorded usage is still inside the granted limit.
 * An ungranted entitlement is never within limit; an unlimited one always is.
 */
export function isWithinEntitlementLimit(
  entitlements: readonly Entitlement[],
  key: string,
  usage: number
): boolean {
  const entitlement = findEntitlement(entitlements, key);
  if (entitlement === undefined) {
    return false;
  }
  if (entitlement.limit === null) {
    return true;
  }
  return usage < entitlement.limit;
}
