/**
 * AI provider test data factories — deterministic builders for @forge/ai-provider types.
 * V3 §3.2 (packages/testing/src/factories/), Day 5.
 */

import type { CompletionOptions, CompletionResult, Embedding, TokenUsage } from "@forge/ai-provider";

/** Builds valid CompletionOptions. */
export function makeCompletionOptions(overrides?: Partial<CompletionOptions>): CompletionOptions {
  return {
    model: "mock-model",
    temperature: 0,
    maxTokens: 64,
    ...overrides,
  };
}

/** Builds valid TokenUsage. */
export function makeTokenUsage(overrides?: Partial<TokenUsage>): TokenUsage {
  return {
    promptTokens: 8,
    completionTokens: 16,
    totalTokens: 24,
    ...overrides,
  };
}

/** Builds a valid CompletionResult. */
export function makeCompletionResult(overrides?: Partial<CompletionResult>): CompletionResult {
  return {
    text: "mock completion",
    model: "mock-model",
    usage: makeTokenUsage(),
    ...overrides,
  };
}

/** Builds a deterministic embedding vector of the requested length. */
export function makeEmbedding(dimension = 8): Embedding {
  const values: number[] = [];
  for (let i = 0; i < dimension; i += 1) {
    values.push(i / dimension);
  }
  return values;
}
