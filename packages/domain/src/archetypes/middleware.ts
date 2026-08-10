/**
 * Runtime Middleware archetype contract per V3 §8.2
 * Purpose: Intercepts requests, evaluates policy, returns decision.
 * Jobs: No — inline on every request.
 */

import type { Result } from "@forge/shared";
import type { PolicyDecision } from "../primitives/policy-decision.js";

export interface MiddlewareEngine<TRequest = unknown, TContext = unknown, TDecision = unknown> {
  evaluate(
    request: TRequest,
    context: TContext
  ): Promise<Result<PolicyDecision<TDecision>, string>>;
}
