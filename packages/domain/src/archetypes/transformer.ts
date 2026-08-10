/**
 * Transformer archetype contract per V3 §8.2
 * Purpose: Maps an existing artifact from one format or protocol to another.
 * Jobs: Rarely — most transformations are request-scoped, synchronous.
 */

import type { Result } from "@forge/shared";
import type { Diagnostic } from "../primitives/diagnostic.js";

export interface TransformerResult<TOutput = unknown> {
  readonly output: TOutput;
  readonly diagnostics?: readonly Diagnostic[];
  readonly warnings?: readonly string[];
  readonly metadata: Record<string, unknown>;
}

export interface TransformerEngine<TInput = unknown, TConfig = unknown, TOutput = unknown> {
  transform(input: TInput, config: TConfig): Promise<Result<TransformerResult<TOutput>, string>>;
}
