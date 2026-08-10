/**
 * FeatureFlagPort — feature flag evaluation capability contract.
 * V3 §3.2 (packages/analytics/src/flags-port.ts), §5.2.
 *
 * Declared separately from AnalyticsPort so a deployment can evaluate flags
 * from a different source than the one collecting analytics.
 */

import type { FeatureFlagKey } from "./types.js";

export interface FeatureFlagPort {
  /** Resolves whether a flag is enabled, optionally for a specific principal. */
  isEnabled(flag: FeatureFlagKey, userId?: string): Promise<boolean>;

  /** Resolves the assigned variant of a flag, or `null` when no variant applies. */
  getVariant(flag: FeatureFlagKey, userId?: string): Promise<string | null>;
}
