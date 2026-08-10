import { describe, it, expect } from "vitest";
import { AppError } from "@forge/shared";
import * as aiPackage from "../index.js";
import {
  AIErrorCode,
  AIModelPortError,
  type CompletionOptions,
  type CompletionResult,
  type Embedding,
  type StructuredSchema,
} from "../index.js";
import type { AIModelPort } from "../index.js";

/** A dummy in-memory provider proving the port is implementable without a vendor. */
function createDummyModelProvider(response = "generated text"): AIModelPort & {
  readonly calls: { prompt: string; options?: CompletionOptions }[];
} {
  const calls: { prompt: string; options?: CompletionOptions }[] = [];

  return {
    calls,
    async complete(prompt, options) {
      calls.push({ prompt, options });
      const result: CompletionResult = {
        text: response,
        model: options?.model ?? "dummy-model",
        usage: {
          promptTokens: prompt.length,
          completionTokens: response.length,
          totalTokens: prompt.length + response.length,
        },
      };
      return result;
    },
    async completeStructured(prompt, schema, options) {
      const completion = await this.complete(prompt, options);
      try {
        return schema.parse(JSON.parse(completion.text));
      } catch (caught) {
        throw new AIModelPortError("Structured output rejected by schema", {
          code: AIErrorCode.STRUCTURED_OUTPUT_INVALID,
          cause: caught,
        });
      }
    },
    async embed(text) {
      const embedding: Embedding = [text.length, 0.5, -0.5];
      return embedding;
    },
  };
}

/** A structural schema — any validator exposing parse(input) satisfies the port. */
const severitySchema: StructuredSchema<{ severity: string }> = {
  parse(input: unknown) {
    if (
      typeof input !== "object" ||
      input === null ||
      typeof (input as { severity?: unknown }).severity !== "string"
    ) {
      throw new Error("Expected { severity: string }");
    }
    return input as { severity: string };
  },
};

describe("AIModelPort contract", () => {
  it("is implementable by a dummy provider", async () => {
    const provider = createDummyModelProvider();

    const result = await provider.complete("Summarise the findings");

    expect(result.text).toBe("generated text");
    expect(result.model).toBe("dummy-model");
    expect(result.usage?.totalTokens).toBe(
      "Summarise the findings".length + "generated text".length
    );
  });

  it("passes provider-neutral generation options through", async () => {
    const provider = createDummyModelProvider();
    const options: CompletionOptions = {
      model: "small-fast",
      temperature: 0.2,
      maxTokens: 256,
      systemPrompt: "Answer briefly.",
      stopSequences: ["\n\n"],
    };

    const result = await provider.complete("Explain", options);

    expect(result.model).toBe("small-fast");
    expect(provider.calls[0]?.options).toEqual(options);
  });

  it("generates structured output through a structural schema", async () => {
    const provider = createDummyModelProvider(JSON.stringify({ severity: "high" }));

    await expect(provider.completeStructured("Classify", severitySchema)).resolves.toEqual({
      severity: "high",
    });
  });

  it("throws AIModelPortError with STRUCTURED_OUTPUT_INVALID when the schema rejects output", async () => {
    const provider = createDummyModelProvider(JSON.stringify({ level: "high" }));

    const error = await provider
      .completeStructured("Classify", severitySchema)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AIModelPortError);
    expect((error as AIModelPortError).code).toBe(AIErrorCode.STRUCTURED_OUTPUT_INVALID);
    expect((error as AIModelPortError).cause).toBeInstanceOf(Error);
  });

  it("returns embeddings as plain numbers", async () => {
    const provider = createDummyModelProvider();

    const embedding = await provider.embed("token");

    expect(embedding).toEqual([5, 0.5, -0.5]);
    expect(embedding.every((value) => typeof value === "number")).toBe(true);
  });
});

describe("AIModelPortError", () => {
  it("extends AppError and defaults to PROVIDER_FAILURE", () => {
    const error = new AIModelPortError("model unavailable");

    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe("AIModelPortError");
    expect(error.code).toBe(AIErrorCode.PROVIDER_FAILURE);
  });
});

describe("package exports", () => {
  it("exposes exactly the runtime exports of the port", () => {
    expect(Object.keys(aiPackage).sort()).toEqual(["AIErrorCode", "AIModelPortError"]);
  });
});
