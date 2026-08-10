/**
 * Gateway archetype contract per V3 §8.2
 * Purpose: Manages endpoint configurations, protocol translation, traffic routing.
 * Jobs: No — config changes are synchronous.
 */

import type { Result } from "@forge/shared";
import type { Diagnostic } from "../primitives/diagnostic.js";

export interface GatewayResult {
  readonly forwardedRequest: unknown;
  readonly transformedResponse?: unknown;
  readonly diagnostics?: readonly Diagnostic[];
  readonly metadata: Record<string, unknown>;
}

export interface GatewayEngine<TRequest = unknown, TRoutingConfig = unknown> {
  process(
    request: TRequest,
    routingConfig: TRoutingConfig
  ): Promise<Result<GatewayResult, string>>;
}
