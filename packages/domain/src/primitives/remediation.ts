/**
 * Remediation — optional shared primitive (Optimizer-oriented) per V3 §9
 * Who: Optimizer (remediation capability), Analyzer (remediation capability).
 * Fields per V3 §9.3: description, code (optional SQL/YAML/shell), effort, automated (boolean).
 */

export interface Remediation {
  readonly description: string;
  readonly code?: string;
  readonly effort?: "low" | "medium" | "high";
  readonly automated: boolean;
}
