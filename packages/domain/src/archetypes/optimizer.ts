/**
 * Optimizer archetype contract per V3 §8.2
 * Purpose: Analyzes for inefficiency, produces metrics, recommendations, optional remediation.
 * Jobs: Yes
 */

import type { Result } from "@forge/shared";
import type { Metric } from "../primitives/metric.js";
import type { Recommendation } from "../primitives/recommendation.js";
import type { Remediation } from "../primitives/remediation.js";
import type { ReportSummary } from "../primitives/report-summary.js";

export interface OptimizerResult {
  readonly metrics: readonly Metric[];
  readonly recommendations: readonly Recommendation[];
  readonly estimatedSavings: {
    readonly time?: string;
    readonly cost?: string;
  };
  readonly remediations?: readonly Remediation[];
  readonly summary: ReportSummary;
  readonly metadata?: Record<string, unknown>;
}

export interface OptimizerEngine<TInput = unknown, TConfig = unknown> {
  execute(
    input: TInput,
    config: TConfig,
    onProgress: (percent: number) => void
  ): Promise<Result<OptimizerResult, string>>;
}
