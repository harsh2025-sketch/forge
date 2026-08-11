/**
 * Analytics test data factories — deterministic builders for @forge/analytics types.
 * V3 §3.2 (packages/testing/src/factories/), Day 5.
 */

import type { AnalyticsProperties, AnalyticsTraits } from "@forge/analytics";

let propertiesSequence = 0;

/** Builds deterministic, serializable analytics properties. */
export function makeAnalyticsProperties(overrides?: AnalyticsProperties): AnalyticsProperties {
  propertiesSequence += 1;
  return {
    sequence: propertiesSequence,
    source: "forge-testing",
    ...overrides,
  };
}

let traitsSequence = 0;

/** Builds deterministic, serializable identity traits. */
export function makeAnalyticsTraits(overrides?: AnalyticsTraits): AnalyticsTraits {
  traitsSequence += 1;
  return {
    sequence: traitsSequence,
    plan: "test-plan",
    ...overrides,
  };
}
