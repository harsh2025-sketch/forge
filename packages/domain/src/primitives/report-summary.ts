/**
 * ReportSummary — optional shared primitive per V3 §9
 * Who: Products with 'reporting' capability — drives shared HTML/Markdown/JSON generators (packages/reporting).
 * Not mandatory.
 */

import type { Severity } from "./severity.js";

export interface ReportSummary {
  readonly totalFindings: number;
  readonly findingsBySeverity: Record<Severity, number>;
  readonly score?: number;
  readonly generatedAt: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Helper to create a ReportSummary from findings — convenient for pure domain.
 * Not required by V3, but shared across Analyzer + Optimizer (P6: two consumers).
 */
export function createReportSummary(
  findings: readonly { severity: Severity }[],
  options?: { readonly score?: number; readonly metadata?: Record<string, unknown> }
): ReportSummary {
  const bySeverity: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const f of findings) {
    if (f.severity in bySeverity) {
      bySeverity[f.severity as Severity] += 1;
    }
  }
  return {
    totalFindings: findings.length,
    findingsBySeverity: bySeverity,
    score: options?.score,
    generatedAt: new Date().toISOString(),
    metadata: options?.metadata,
  };
}
