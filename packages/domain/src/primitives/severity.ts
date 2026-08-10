/**
 * Severity — optional shared primitive per V3 §9
 * Who: Analyzer, Optimizer (16 of 20 products)
 * Not mandatory — products may define own severity if this does not fit (V3 Change 2).
 * Provider-neutral: semantic only, no visual token here (tokens live in packages/ui).
 * Values are lowercase to match @forge/config archetype/capability value style
 * (keys are SCREAMING, values are lower-case capability strings).
 */

export const Severity = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  INFO: "info",
} as const;

export type Severity = (typeof Severity)[keyof typeof Severity];

export const SEVERITY_VALUES = Object.values(Severity) as readonly Severity[];

export const SEVERITY_ORDER: readonly Severity[] = [
  Severity.CRITICAL,
  Severity.HIGH,
  Severity.MEDIUM,
  Severity.LOW,
  Severity.INFO,
] as const;

/**
 * Type guard for Severity — exact, case-sensitive match (no coercion).
 */
export function isSeverity(value: unknown): value is Severity {
  return typeof value === "string" && (SEVERITY_VALUES as readonly string[]).includes(value);
}
