/**
 * Artifact — optional shared primitive per V3 §9
 * Who: Generator, Transformer, Gateway (when outputting transformed payloads).
 * Enables shared storage handling via StoragePort (provider-neutral key).
 */

export interface Artifact {
  readonly key: string;
  readonly contentType: string;
  readonly size?: number;
  readonly metadata?: Record<string, unknown>;
}
