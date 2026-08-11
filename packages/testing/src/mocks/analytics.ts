/**
 * Mock analytics adapters — real behavioral in-memory implementations of
 * AnalyticsPort and FeatureFlagPort. Analytics calls are recorded; flag
 * evaluation resolves from a configurable flag table. V3 §3.2
 * (packages/testing/src/mocks/), Day 5.
 */

import {
  AnalyticsErrorCode,
  AnalyticsPortError,
  type AnalyticsPort,
  type AnalyticsProperties,
  type AnalyticsTraits,
  type FeatureFlagPort,
} from "@forge/analytics";

/** A recorded identify call. */
export interface MockIdentifyCall {
  readonly userId: string;
  readonly traits: AnalyticsTraits;
}

/** A recorded track call. */
export interface MockTrackCall {
  readonly event: string;
  readonly properties?: AnalyticsProperties;
}

/** A recorded page call. */
export interface MockPageCall {
  readonly name: string;
  readonly properties?: AnalyticsProperties;
}

/** An AnalyticsPort plus inspection of recorded calls. */
export type MockAnalyticsPort = AnalyticsPort & {
  readonly identified: readonly MockIdentifyCall[];
  readonly tracked: readonly MockTrackCall[];
  readonly pages: readonly MockPageCall[];
};

/** Creates an in-memory AnalyticsPort that records every call. */
export function createMockAnalyticsPort(): MockAnalyticsPort {
  const identified: MockIdentifyCall[] = [];
  const tracked: MockTrackCall[] = [];
  const pages: MockPageCall[] = [];

  return {
    identify(userId, traits) {
      identified.push({ userId, traits });
    },
    track(event, properties) {
      tracked.push({ event, properties });
    },
    page(name, properties) {
      pages.push({ name, properties });
    },
    identified,
    tracked,
    pages,
  };
}

/** Declaration of a flag for the mock feature flag port. */
export interface MockFeatureFlag {
  readonly enabled?: boolean;
  readonly variant?: string | null;
}

/** Options for the mock feature flag port. */
export interface MockFeatureFlagPortOptions {
  /** Flag table. Unknown flags evaluate to disabled / no variant. */
  readonly flags?: Readonly<Record<string, MockFeatureFlag>>;
  /** When true, evaluation fails with ANALYTICS_FLAG_EVALUATION_FAILED. */
  readonly failEvaluation?: boolean;
}

/** Creates an in-memory FeatureFlagPort over the given flag table. */
export function createMockFeatureFlagPort(options?: MockFeatureFlagPortOptions): FeatureFlagPort {
  const flags = options?.flags ?? {};
  const failEvaluation = options?.failEvaluation ?? false;

  function evaluate(flag: string): MockFeatureFlag {
    if (failEvaluation) {
      throw new AnalyticsPortError(`Flag evaluation failed: ${flag}`, {
        code: AnalyticsErrorCode.FLAG_EVALUATION_FAILED,
        details: { flag },
      });
    }
    return flags[flag] ?? {};
  }

  return {
    async isEnabled(flag) {
      return evaluate(flag).enabled ?? false;
    },
    async getVariant(flag) {
      return evaluate(flag).variant ?? null;
    },
  };
}
