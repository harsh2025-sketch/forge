/**
 * PolicyDecision — optional shared primitive per V3 §9
 * Who: Middleware, Gateway (policy capability).
 * Shared logging + dashboard components.
 */

export type PolicyAction = "allow" | "block" | "transform" | "rate-limit";

export interface PolicyDecision<TTransformed = unknown> {
  readonly action: PolicyAction;
  readonly reason?: string;
  readonly transformed?: TTransformed;
  readonly latencyMs?: number;
  readonly metadata?: Record<string, unknown>;
}
