/**
 * AIModelPort — language model capability contract.
 * V3 §5.2 (for products using language models).
 * Implemented by adapters only; never by this package.
 */

import type { CompletionOptions, CompletionResult, Embedding, StructuredSchema } from "./types.js";

export interface AIModelPort {
  /** Generates text for a prompt. */
  complete(prompt: string, options?: CompletionOptions): Promise<CompletionResult>;

  /**
   * Generates a value validated against the given schema.
   * Throws `AIModelPortError` with code `AI_STRUCTURED_OUTPUT_INVALID` when the
   * generated output does not satisfy the schema.
   */
  completeStructured<T>(
    prompt: string,
    schema: StructuredSchema<T>,
    options?: CompletionOptions
  ): Promise<T>;

  /** Returns the embedding vector for an input. */
  embed(text: string): Promise<Embedding>;
}
