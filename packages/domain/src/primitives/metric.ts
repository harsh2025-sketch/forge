/**
 * Metric — optional shared primitive per V3 §9
 * Who: Optimizer archetype only.
 */

export interface Metric {
  readonly name: string;
  readonly value: number;
  readonly unit: string;
  readonly baseline?: number;
  readonly target?: number;
  readonly timestamp?: string;
}
