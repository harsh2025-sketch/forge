/**
 * Analyzer archetype contract per V3 §8.2
 * Purpose: Accepts structured input, executes analysis, produces findings.
 * Jobs: Yes — analysis runs are background jobs (requiresWorker).
 * Reporting: Yes (findings → report formats) when capability 'reporting' declared.
 */

import type { Result } from "@forge/shared";
import type { BaseFinding } from "../primitives/finding.js";
import type { ReportSummary } from "../primitives/report-summary.js";

export interface AnalyzerResult<TFinding extends BaseFinding = BaseFinding> {
  readonly findings: readonly TFinding[];
  readonly summary: ReportSummary;
  readonly artifacts?: unknown;
  readonly metadata: Record<string, unknown>;
}

export interface AnalyzerEngine<
  TInput = unknown,
  TConfig = unknown,
  TFinding extends BaseFinding = BaseFinding,
> {
  execute(
    input: TInput,
    config: TConfig,
    onProgress: (percent: number) => void
  ): Promise<Result<AnalyzerResult<TFinding>, string>>;
}
