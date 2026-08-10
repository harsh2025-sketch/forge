/**
 * @forge/ai-provider types — provider-neutral language model types.
 * V3 §3.2 (packages/ai-provider/src/types.ts), §5.2 (AIModelPort contract), P21.
 *
 * No provider request, response, message or streaming shape may appear here.
 */

import { AppError, type AppErrorOptions } from "@forge/shared";

/** Provider-neutral model name, resolved by the adapter. */
export type ModelIdentifier = string;

/** Generation options accepted by a completion request. */
export interface CompletionOptions {
  readonly model?: ModelIdentifier;
  readonly temperature?: number;
  readonly maxTokens?: number;
  /** Instruction applied to the whole request, ahead of the prompt. */
  readonly systemPrompt?: string;
  readonly stopSequences?: readonly string[];
}

/** Token accounting reported for a completion. */
export interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

/** The result of a text completion. */
export interface CompletionResult {
  readonly text: string;
  readonly model: ModelIdentifier;
  readonly usage?: TokenUsage;
}

/** A dense vector representation of an input. */
export type Embedding = readonly number[];

/**
 * Structural validation contract used for structured generation.
 *
 * V3 §5.2 types the schema argument with a validation library type. A port may
 * not depend on one (boundaries.md: packages/[port] → packages/shared), so the
 * contract is structural: any schema exposing `parse(input): T` satisfies it.
 */
export interface StructuredSchema<T> {
  parse(input: unknown): T;
}

/** Stable, provider-neutral failure codes for model operations. */
export const AIErrorCode = {
  /** Structured generation produced output the schema rejected. */
  STRUCTURED_OUTPUT_INVALID: "AI_STRUCTURED_OUTPUT_INVALID",
  /** The provider behind the port failed for any other reason. */
  PROVIDER_FAILURE: "AI_PROVIDER_FAILURE",
} as const;

export type AIErrorCode = (typeof AIErrorCode)[keyof typeof AIErrorCode];

export interface AIModelPortErrorOptions extends Omit<AppErrorOptions, "code"> {
  readonly code?: AIErrorCode;
}

/**
 * Error raised by model port implementations.
 *
 * Adapters translate provider failures into this type so callers never depend
 * on a provider's error shape.
 */
export class AIModelPortError extends AppError {
  constructor(message: string, options?: AIModelPortErrorOptions) {
    super(message, {
      code: options?.code ?? AIErrorCode.PROVIDER_FAILURE,
      details: options?.details,
      cause: options?.cause,
    });
  }
}
