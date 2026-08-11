/**
 * AI model conformance suite — proves any AIModelPort implementation satisfies
 * the @forge/ai-provider contract: completion shape, structured-output
 * validation semantics and deterministic embeddings. V3 §12.4, §5.2, P12.
 */

import { describe, expect, it } from "vitest";
import { isAppError } from "@forge/shared";
import {
  AIErrorCode,
  AIModelPortError,
  type AIModelPort,
} from "@forge/ai-provider";

/** Seeded inputs the AI conformance run promises. */
export interface AIProviderConformanceFixtures {
  /** The model reported when the caller does not request one. */
  readonly defaultModel: string;
  /** The raw value the adapter generates for structured output. */
  readonly structuredValue: unknown;
}

/** Produces an AIModelPort implementation. */
export interface AIProviderConformanceHarness {
  readonly fixtures: AIProviderConformanceFixtures;
  createPort(): AIModelPort;
}

function structurallyEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") {
    return false;
  }
  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  return aKeys.every((key) =>
    structurallyEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
  );
}

/** Registers the AIModelPort conformance suite against the harness. */
export function runAIProviderConformance(harness: AIProviderConformanceHarness): void {
  const { fixtures } = harness;

  describe("AIModelPort conformance", () => {
    it("complete resolves text attributed to the requested model", async () => {
      const port = harness.createPort();
      const result = await port.complete("Say hello", { model: "requested-model" });

      expect(typeof result.text).toBe("string");
      expect(result.text).not.toBe("");
      expect(result.model).toBe("requested-model");
    });

    it("complete attributes results to the default model when none is requested", async () => {
      const port = harness.createPort();
      const result = await port.complete("Say hello");
      expect(result.model).toBe(fixtures.defaultModel);
    });

    it("completeStructured resolves output accepted by the schema", async () => {
      const port = harness.createPort();
      const schema = {
        parse(input: unknown): unknown {
          if (!structurallyEqual(input, fixtures.structuredValue)) {
            throw new Error("generated output does not match the expected value");
          }
          return input;
        },
      };

      await expect(port.completeStructured("Produce the fixture", schema)).resolves.toEqual(
        fixtures.structuredValue
      );
    });

    it("completeStructured rejects schema-invalid output with AI_STRUCTURED_OUTPUT_INVALID", async () => {
      const port = harness.createPort();
      const rejectingSchema = {
        parse(): never {
          throw new Error("schema always rejects");
        },
      };

      const error = await port
        .completeStructured("Produce the fixture", rejectingSchema)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(AIModelPortError);
      expect(isAppError(error)).toBe(true);
      expect((error as AIModelPortError).code).toBe(AIErrorCode.STRUCTURED_OUTPUT_INVALID);
    });

    it("embed resolves a deterministic numeric vector", async () => {
      const port = harness.createPort();
      const first = await port.embed("forge");
      const second = await port.embed("forge");

      expect(first.length).toBeGreaterThan(0);
      for (const value of first) {
        expect(typeof value).toBe("number");
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(second).toEqual(first);
    });
  });
}
