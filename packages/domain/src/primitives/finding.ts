/**
 * BaseFinding — optional shared primitive per V3 §9
 * Who: Analyzer, Optimizer (where findings apply) — 14+ products.
 * Not mandatory — a product may define own finding shape if BaseFinding does not fit;
 * in that case it cannot use shared reporting finding-generators (V3 §9.3).
 * Fields per V3 §9.3: id, severity, category, title, description, evidence (unknown product-specific),
 * recommendation (optional string), remediationCode (optional), references (optional).
 * What remains product-specific per V3 §9.4: category taxonomy, evidence structure, scoring, remediation templates.
 */

import type { Severity } from "./severity.js";

export interface BaseFinding {
  readonly id: string;
  readonly severity: Severity;
  readonly category: string;
  readonly title: string;
  readonly description: string;
  /** Product-specific evidence (EXPLAIN output, JWT header, K8s manifest, etc.) */
  readonly evidence: unknown;
  /** Optional string recommendation — when standalone, use Recommendation typed object (see recommendation.ts) */
  readonly recommendation?: string;
  readonly remediationCode?: string;
  readonly references?: readonly string[];
}
