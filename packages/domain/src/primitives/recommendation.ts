/**
 * Recommendation — optional shared primitive per V3 §9 + Change 7
 * Who: Analyzer (as string field in BaseFinding), Optimizer (standalone typed object).
 * Note per V3 §9.3 Change 7:
 *   When used as a field in BaseFinding, it is a string.
 *   When standalone (Optimizer), it is a typed object with priority and effort fields.
 * This module exports the standalone typed object. BaseFinding.recommendation stays string.
 */

export interface Recommendation {
  readonly description: string;
  readonly code?: string;
  readonly effort?: "low" | "medium" | "high";
  readonly priority?: number;
  readonly automated?: boolean;
}
