/**
 * Diagnostic — optional shared primitive per V3 §9
 * Who: Generator, Transformer, Gateway (not findings — no severity, no remediation implied).
 */

export type DiagnosticLevel = "info" | "warning" | "error";

export interface Diagnostic {
  readonly level: DiagnosticLevel;
  readonly message: string;
  readonly code?: string;
  readonly context?: unknown;
}
