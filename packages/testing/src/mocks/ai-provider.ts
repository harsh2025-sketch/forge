/**
 * Mock AI model adapter — real behavioral in-memory implementation of
 * AIModelPort. Completions are deterministic functions of the prompt;
 * structured generation produces a configured value and validates it through
 * the caller's schema exactly as a real adapter must. V3 §3.2
 * (packages/testing/src/mocks/), Day 5.
 */

import {
  AIErrorCode,
  AIModelPortError,
  type AIModelPort,
  type CompletionOptions,
  type CompletionResult,
} from "@forge/ai-provider";

/** Options for the mock AI model port. */
export interface MockAIModelPortOptions {
  /** Model reported when the caller does not request one. */
  readonly defaultModel?: string;
  /** Raw value completeStructured generates before schema validation. */
  readonly structuredValue?: unknown;
}

/** Creates an in-memory AIModelPort. */
export function createMockAIModelPort(options?: MockAIModelPortOptions): AIModelPort {
  const defaultModel = options?.defaultModel ?? "mock-model";
  const structuredValue = options?.structuredValue ?? {};

  async function complete(prompt: string, completionOptions?: CompletionOptions): Promise<CompletionResult> {
    const text = `mock completion for: ${prompt}`;
    return {
      text,
      model: completionOptions?.model ?? defaultModel,
      usage: {
        promptTokens: prompt.length,
        completionTokens: text.length,
        totalTokens: prompt.length + text.length,
      },
    };
  }

  async function completeStructured<T>(
    prompt: string,
    schema: { parse(input: unknown): T },
    completionOptions?: CompletionOptions
  ): Promise<T> {
    void prompt;
    void completionOptions;
    try {
      return schema.parse(structuredValue);
    } catch (error) {
      throw new AIModelPortError("Structured output failed schema validation", {
        code: AIErrorCode.STRUCTURED_OUTPUT_INVALID,
        cause: error,
      });
    }
  }

  async function embed(text: string): Promise<readonly number[]> {
    return Array.from(text).map((character) => character.charCodeAt(0) / 255);
  }

  return { complete, completeStructured, embed };
}
