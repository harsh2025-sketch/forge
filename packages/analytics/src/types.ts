/**
 * @forge/analytics types — provider-neutral analytics and feature flag types.
 * V3 §3.2 (packages/analytics), §5.2 (AnalyticsPort, FeatureFlagPort), P21.
 *
 * No provider capture/evaluation shape may appear here.
 */

import { AppError, type AppErrorOptions } from "@forge/shared";

/** Free-form, serializable attributes attached to a tracked event or page view. */
export type AnalyticsProperties = Readonly<Record<string, unknown>>;

/** Free-form, serializable attributes describing an identified principal. */
export type AnalyticsTraits = Readonly<Record<string, unknown>>;

/** Neutral key identifying a feature flag. */
export type FeatureFlagKey = string;

/** Stable, provider-neutral failure codes for analytics operations. */
export const AnalyticsErrorCode = {
  /** A feature flag could not be evaluated. */
  FLAG_EVALUATION_FAILED: "ANALYTICS_FLAG_EVALUATION_FAILED",
  /** The provider behind the port failed for any other reason. */
  PROVIDER_FAILURE: "ANALYTICS_PROVIDER_FAILURE",
} as const;

export type AnalyticsErrorCode = (typeof AnalyticsErrorCode)[keyof typeof AnalyticsErrorCode];

export interface AnalyticsPortErrorOptions extends Omit<AppErrorOptions, "code"> {
  readonly code?: AnalyticsErrorCode;
}

/**
 * Error raised by analytics and feature flag port implementations.
 *
 * Adapters translate provider failures into this type so callers never depend
 * on a provider's error shape.
 */
export class AnalyticsPortError extends AppError {
  constructor(message: string, options?: AnalyticsPortErrorOptions) {
    super(message, {
      code: options?.code ?? AnalyticsErrorCode.PROVIDER_FAILURE,
      details: options?.details,
      cause: options?.cause,
    });
  }
}
