/**
 * Generator archetype contract per V3 §8.2
 * Purpose: Produces a new artifact from a description or input source.
 * Jobs: Conditional on execution duration.
 */

import type { Result } from "@forge/shared";
import type { Artifact } from "../primitives/artifact.js";
import type { Diagnostic } from "../primitives/diagnostic.js";

export interface GeneratorResult<TArtifact = Artifact> {
  readonly artifact: TArtifact;
  readonly validationResult?: unknown;
  readonly diagnostics?: readonly Diagnostic[];
  readonly metadata: Record<string, unknown>;
}

export interface GeneratorEngine<TInput = unknown, TConfig = unknown, TArtifact = Artifact> {
  generate(
    input: TInput,
    config: TConfig,
    onProgress?: (percent: number) => void
  ): Promise<Result<GeneratorResult<TArtifact>, string>>;
}
