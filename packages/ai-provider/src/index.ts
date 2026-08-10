/**
 * @forge/ai-provider — language model port.
 * Provider-neutral contracts only. Depends on @forge/shared and nothing else.
 * V3 §3.2, §4.1, §5.2.
 */

export type {
  AIModelPortErrorOptions,
  CompletionOptions,
  CompletionResult,
  Embedding,
  ModelIdentifier,
  StructuredSchema,
  TokenUsage,
} from "./types.js";
export { AIErrorCode, AIModelPortError } from "./types.js";

export type { AIModelPort } from "./port.js";
