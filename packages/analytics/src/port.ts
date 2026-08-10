/**
 * AnalyticsPort — product analytics capability contract.
 * V3 §5.2. Implemented by adapters only; never by this package.
 *
 * All methods are fire-and-forget: analytics must never block or fail a request.
 */

import type { AnalyticsProperties, AnalyticsTraits } from "./types.js";

export interface AnalyticsPort {
  /** Associates traits with an identified principal. */
  identify(userId: string, traits: AnalyticsTraits): void;

  /** Records that a named event occurred. */
  track(event: string, properties?: AnalyticsProperties): void;

  /** Records that a named page or screen was viewed. */
  page(name: string, properties?: AnalyticsProperties): void;
}
