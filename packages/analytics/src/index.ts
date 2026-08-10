/**
 * @forge/analytics — analytics and feature flag ports.
 * Provider-neutral contracts only. Depends on @forge/shared and nothing else.
 * V3 §3.2, §4.1, §5.2.
 */

export type {
  AnalyticsPortErrorOptions,
  AnalyticsProperties,
  AnalyticsTraits,
  FeatureFlagKey,
} from "./types.js";
export { AnalyticsErrorCode, AnalyticsPortError } from "./types.js";

export type { AnalyticsPort } from "./port.js";

export type { FeatureFlagPort } from "./flags-port.js";
