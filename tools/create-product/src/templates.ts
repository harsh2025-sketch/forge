/**
 * Deterministic product templates for the Forge V3 scaffolding tooling.
 *
 * Every template is rendered from a ProductSpec with a fixed token map; the
 * same spec always produces byte-identical output. No timestamps, random ids,
 * or machine-specific values are ever embedded.
 */

import type { Archetype, Capability } from "@forge/config";

/** The frozen product manifest schema (V3 §8.1) fields a skeleton must carry. */
export interface ProductSpec {
  readonly id: string;
  readonly displayName: string;
  readonly tagline: string;
  readonly primaryArchetype: Archetype;
  readonly capabilities: readonly Capability[];
  readonly requiresWorker: boolean;
  readonly requiresAIProvider: boolean;
}

/** A file to be written into a product directory (posix-relative path). */
export interface GeneratedFile {
  readonly path: string;
  readonly content: string;
}

export const REQUIRED_PRODUCT_DOCUMENTS = [
  "ARCHITECTURE.md",
  "SETUP.md",
  "DEPLOYMENT.md",
  "DATABASE.md",
  "PROVIDERS.md",
  "API.md",
  "TESTING.md",
  "SECURITY.md",
  "OPERATIONS.md",
  "ACQUISITION.md",
] as const;

export const CAPABILITY_DEPENDENCIES: Readonly<Record<string, string>> = {
  reporting: "@forge/reporting",
  scheduling: "@forge/jobs",
  "ai-assisted": "@forge/ai-provider",
};

const ARCHETYPE_TAGLINES: Readonly<Record<Archetype, string>> = {
  analyzer: "Analyzes structured input and produces actionable findings.",
  optimizer: "Measures the current state and recommends measurable improvements.",
  generator: "Generates new artifacts from structured input.",
  transformer: "Transforms artifacts between formats and protocols.",
  middleware: "Evaluates requests and enforces policy at runtime.",
  gateway: "Routes and translates traffic between systems.",
};

/** The default tagline for a product of the given archetype. */
export function defaultTagline(archetype: Archetype): string {
  return ARCHETYPE_TAGLINES[archetype];
}

// ---------------------------------------------------------------------------
// Token rendering
// ---------------------------------------------------------------------------

interface TokenMap {
  readonly [token: string]: string;
}

function render(template: string, tokens: TokenMap): string {
  let output = template;
  for (const [token, value] of Object.entries(tokens)) {
    output = output.split(`{{${token}}}`).join(value);
  }
  return output;
}

function tokensFor(spec: ProductSpec): TokenMap {
  const capabilityNames = spec.capabilities.map((capability) => `\`${capability}\``);
  return {
    ID: spec.id,
    DISPLAY_NAME: spec.displayName,
    TAGLINE: spec.tagline,
    ARCHETYPE: spec.primaryArchetype,
    CAPABILITIES: spec.capabilities.length === 0 ? "none" : capabilityNames.join(", "),
    CAPABILITIES_LIST: spec.capabilities.length === 0 ? "(none declared)" : spec.capabilities.join(", "),
    WORKER_PHRASE: spec.requiresWorker ? "requires a background worker process" : "does not require a worker process",
    WORKER_SENTENCE: spec.requiresWorker
      ? "The product declares `requiresWorker: true`, so the worker process is scaffolded and job processors are registered in `src/worker/`."
      : "The product declares `requiresWorker: false`; a worker process is added during implementation if background jobs become necessary.",
    AI_SENTENCE: spec.requiresAIProvider
      ? "The product declares `requiresAIProvider: true`; AI access goes exclusively through the `@forge/ai-provider` port wired in `src/providers.ts`."
      : "The product declares `requiresAIProvider: false`; AI capabilities, if added later, must go through the `@forge/ai-provider` port.",
  };
}

// ---------------------------------------------------------------------------
// Engine templates (one per archetype, implementing the frozen contracts)
// ---------------------------------------------------------------------------

const EMPTY_SUMMARY = `{
          totalFindings: 0,
          findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
          generatedAt: "",
          metadata: { engine: "{{ID}}-{{ARCHETYPE}}-skeleton" },
        }`;

const ANALYZER_ENGINE = `/**
 * Product engine — {{DISPLAY_NAME}} ({{ARCHETYPE}} archetype).
 *
 * Implements the AnalyzerEngine contract from @forge/domain (V3 §8.2).
 * This file is PURE DOMAIN LOGIC: no Next.js, no database, no adapters, no
 * vendor SDKs. Every external input is validated with the Zod schemas before
 * any processing happens.
 *
 * The skeleton validates input and returns an empty analysis. Implement the
 * product's actual analysis phases here and cover them with unit tests.
 */

import type { AnalyzerEngine, AnalyzerResult } from "@forge/domain";
import type { Result } from "@forge/shared";
import { productConfigSchema, productInputSchema } from "./schemas.js";
import type { ProductConfig, ProductInput } from "./schemas.js";
import type { ProductFinding } from "./types.js";

export class ProductEngine implements AnalyzerEngine<ProductInput, ProductConfig, ProductFinding> {
  async execute(
    input: ProductInput,
    config: ProductConfig,
    onProgress: (percent: number) => void,
  ): Promise<Result<AnalyzerResult<ProductFinding>, string>> {
    const inputResult = productInputSchema.safeParse(input);
    if (!inputResult.success) {
      return { ok: false, error: \`Invalid input: \${inputResult.error.message}\` };
    }
    const configResult = productConfigSchema.safeParse(config);
    if (!configResult.success) {
      return { ok: false, error: \`Invalid config: \${configResult.error.message}\` };
    }

    onProgress(100);

    return {
      ok: true,
      value: {
        findings: [],
        summary: ${EMPTY_SUMMARY},
        metadata: { engine: "{{ID}}-analyzer-skeleton" },
      },
    };
  }
}
`;

const OPTIMIZER_ENGINE = `/**
 * Product engine — {{DISPLAY_NAME}} ({{ARCHETYPE}} archetype).
 *
 * Implements the OptimizerEngine contract from @forge/domain (V3 §8.2).
 * This file is PURE DOMAIN LOGIC: no Next.js, no database, no adapters, no
 * vendor SDKs. Every external input is validated with the Zod schemas before
 * any processing happens.
 *
 * The skeleton validates input and returns an empty optimization. Implement
 * the product's actual measurement and recommendation phases here.
 */

import type { OptimizerEngine, OptimizerResult } from "@forge/domain";
import type { Result } from "@forge/shared";
import { productConfigSchema, productInputSchema } from "./schemas.js";
import type { ProductConfig, ProductInput } from "./schemas.js";

export class ProductEngine implements OptimizerEngine<ProductInput, ProductConfig> {
  async execute(
    input: ProductInput,
    config: ProductConfig,
    onProgress: (percent: number) => void,
  ): Promise<Result<OptimizerResult, string>> {
    const inputResult = productInputSchema.safeParse(input);
    if (!inputResult.success) {
      return { ok: false, error: \`Invalid input: \${inputResult.error.message}\` };
    }
    const configResult = productConfigSchema.safeParse(config);
    if (!configResult.success) {
      return { ok: false, error: \`Invalid config: \${configResult.error.message}\` };
    }

    onProgress(100);

    return {
      ok: true,
      value: {
        metrics: [],
        recommendations: [],
        estimatedSavings: {},
        summary: ${EMPTY_SUMMARY},
        metadata: { engine: "{{ID}}-optimizer-skeleton" },
      },
    };
  }
}
`;

const GENERATOR_ENGINE = `/**
 * Product engine — {{DISPLAY_NAME}} ({{ARCHETYPE}} archetype).
 *
 * Implements the GeneratorEngine contract from @forge/domain (V3 §8.2).
 * This file is PURE DOMAIN LOGIC: no Next.js, no database, no adapters, no
 * vendor SDKs. Every external input is validated with the Zod schemas before
 * any processing happens.
 *
 * The skeleton validates input and returns an empty artifact. Implement the
 * product's actual generation and validation phases here.
 */

import type { GeneratorEngine, GeneratorResult } from "@forge/domain";
import type { Result } from "@forge/shared";
import { productConfigSchema, productInputSchema } from "./schemas.js";
import type { ProductConfig, ProductInput } from "./schemas.js";
import type { ProductArtifact } from "./types.js";

export class ProductEngine implements GeneratorEngine<ProductInput, ProductConfig, ProductArtifact> {
  async generate(
    input: ProductInput,
    config: ProductConfig,
    onProgress?: (percent: number) => void,
  ): Promise<Result<GeneratorResult<ProductArtifact>, string>> {
    const inputResult = productInputSchema.safeParse(input);
    if (!inputResult.success) {
      return { ok: false, error: \`Invalid input: \${inputResult.error.message}\` };
    }
    const configResult = productConfigSchema.safeParse(config);
    if (!configResult.success) {
      return { ok: false, error: \`Invalid config: \${configResult.error.message}\` };
    }

    onProgress?.(100);

    return {
      ok: true,
      value: {
        artifact: { kind: "skeleton", name: "", content: "" },
        metadata: { engine: "{{ID}}-generator-skeleton" },
      },
    };
  }
}
`;

const TRANSFORMER_ENGINE = `/**
 * Product engine — {{DISPLAY_NAME}} ({{ARCHETYPE}} archetype).
 *
 * Implements the TransformerEngine contract from @forge/domain (V3 §8.2).
 * This file is PURE DOMAIN LOGIC: no Next.js, no database, no adapters, no
 * vendor SDKs. Every external input is validated with the Zod schemas before
 * any processing happens.
 *
 * The skeleton validates input and returns an empty output. Implement the
 * product's actual transformation logic here.
 */

import type { TransformerEngine, TransformerResult } from "@forge/domain";
import type { Result } from "@forge/shared";
import { productConfigSchema, productInputSchema } from "./schemas.js";
import type { ProductConfig, ProductInput } from "./schemas.js";
import type { ProductOutput } from "./types.js";

export class ProductEngine implements TransformerEngine<ProductInput, ProductConfig, ProductOutput> {
  async transform(input: ProductInput, config: ProductConfig): Promise<Result<TransformerResult<ProductOutput>, string>> {
    const inputResult = productInputSchema.safeParse(input);
    if (!inputResult.success) {
      return { ok: false, error: \`Invalid input: \${inputResult.error.message}\` };
    }
    const configResult = productConfigSchema.safeParse(config);
    if (!configResult.success) {
      return { ok: false, error: \`Invalid config: \${configResult.error.message}\` };
    }

    return {
      ok: true,
      value: {
        output: { format: "skeleton", content: null },
        metadata: { engine: "{{ID}}-transformer-skeleton" },
      },
    };
  }
}
`;

const MIDDLEWARE_ENGINE = `/**
 * Product engine — {{DISPLAY_NAME}} ({{ARCHETYPE}} archetype).
 *
 * Implements the MiddlewareEngine contract from @forge/domain (V3 §8.2).
 * This file is PURE DOMAIN LOGIC: no Next.js, no database, no adapters, no
 * vendor SDKs. Every external request is validated with the Zod schemas
 * before a policy decision is produced.
 *
 * The skeleton allows every request. Implement the product's actual policy
 * rules here.
 */

import type { MiddlewareEngine, PolicyDecision } from "@forge/domain";
import type { Result } from "@forge/shared";
import { productContextSchema, productRequestSchema } from "./schemas.js";
import type { ProductContext, ProductRequest } from "./schemas.js";

export class ProductEngine implements MiddlewareEngine<ProductRequest, ProductContext, unknown> {
  async evaluate(
    request: ProductRequest,
    context: ProductContext,
  ): Promise<Result<PolicyDecision<unknown>, string>> {
    const requestResult = productRequestSchema.safeParse(request);
    if (!requestResult.success) {
      return { ok: false, error: \`Invalid request: \${requestResult.error.message}\` };
    }
    const contextResult = productContextSchema.safeParse(context);
    if (!contextResult.success) {
      return { ok: false, error: \`Invalid context: \${contextResult.error.message}\` };
    }

    return {
      ok: true,
      value: {
        action: "allow",
        reason: "Skeleton policy: no rules configured",
        metadata: { engine: "{{ID}}-middleware-skeleton" },
      },
    };
  }
}
`;

const GATEWAY_ENGINE = `/**
 * Product engine — {{DISPLAY_NAME}} ({{ARCHETYPE}} archetype).
 *
 * Implements the GatewayEngine contract from @forge/domain (V3 §8.2).
 * This file is PURE DOMAIN LOGIC: no Next.js, no database, no adapters, no
 * vendor SDKs. Every external request is validated with the Zod schemas
 * before routing decisions are made.
 *
 * The skeleton forwards the request unchanged. Implement the product's
 * actual routing and translation logic here.
 */

import type { GatewayEngine, GatewayResult } from "@forge/domain";
import type { Result } from "@forge/shared";
import { productRoutingConfigSchema, productRequestSchema } from "./schemas.js";
import type { ProductRequest, ProductRoutingConfig } from "./schemas.js";

export class ProductEngine implements GatewayEngine<ProductRequest, ProductRoutingConfig> {
  async process(
    request: ProductRequest,
    routingConfig: ProductRoutingConfig,
  ): Promise<Result<GatewayResult, string>> {
    const requestResult = productRequestSchema.safeParse(request);
    if (!requestResult.success) {
      return { ok: false, error: \`Invalid request: \${requestResult.error.message}\` };
    }
    const configResult = productRoutingConfigSchema.safeParse(routingConfig);
    if (!configResult.success) {
      return { ok: false, error: \`Invalid routing config: \${configResult.error.message}\` };
    }

    return {
      ok: true,
      value: {
        forwardedRequest: request,
        metadata: { engine: "{{ID}}-gateway-skeleton" },
      },
    };
  }
}
`;

const ENGINE_TEMPLATES: Readonly<Record<Archetype, string>> = {
  analyzer: ANALYZER_ENGINE,
  optimizer: OPTIMIZER_ENGINE,
  generator: GENERATOR_ENGINE,
  transformer: TRANSFORMER_ENGINE,
  middleware: MIDDLEWARE_ENGINE,
  gateway: GATEWAY_ENGINE,
};

// ---------------------------------------------------------------------------
// Domain types / schemas / tests templates (per archetype)
// ---------------------------------------------------------------------------

const ANALYZER_TYPES = `/**
 * Product-specific domain types for {{DISPLAY_NAME}} ({{ARCHETYPE}} archetype).
 * Domain types are pure data contracts — no infrastructure imports allowed.
 */

import type { BaseFinding } from "@forge/domain";

/** A finding produced by the {{DISPLAY_NAME}} analysis engine. */
export interface ProductFinding extends BaseFinding {
  /** Product-specific finding category. */
  readonly category: string;
}
`;

const OPTIMIZER_TYPES = `/**
 * Product-specific domain types for {{DISPLAY_NAME}} ({{ARCHETYPE}} archetype).
 * Domain types are pure data contracts — no infrastructure imports allowed.
 */

import type { Metric } from "@forge/domain";

/** A metric produced by the {{DISPLAY_NAME}} optimizer engine. */
export interface ProductMetric extends Metric {
  /** Human-readable label for the metric. */
  readonly label: string;
}
`;

const GENERATOR_TYPES = `/**
 * Product-specific domain types for {{DISPLAY_NAME}} ({{ARCHETYPE}} archetype).
 * Domain types are pure data contracts — no infrastructure imports allowed.
 */

/** An artifact produced by the {{DISPLAY_NAME}} generator engine. */
export interface ProductArtifact {
  readonly kind: string;
  readonly name: string;
  readonly content: unknown;
}
`;

const TRANSFORMER_TYPES = `/**
 * Product-specific domain types for {{DISPLAY_NAME}} ({{ARCHETYPE}} archetype).
 * Domain types are pure data contracts — no infrastructure imports allowed.
 */

/** An output produced by the {{DISPLAY_NAME}} transformer engine. */
export interface ProductOutput {
  readonly format: string;
  readonly content: unknown;
}
`;

const MIDDLEWARE_TYPES = `/**
 * Product-specific domain types for {{DISPLAY_NAME}} ({{ARCHETYPE}} archetype).
 * Domain types are pure data contracts — no infrastructure imports allowed.
 */

/** A request evaluated by the {{DISPLAY_NAME}} middleware engine. */
export interface ProductRequest {
  readonly path: string;
  readonly method: string;
}

/** Context the middleware engine evaluates requests against. */
export interface ProductContext {
  readonly policyVersion: number;
}
`;

const GATEWAY_TYPES = `/**
 * Product-specific domain types for {{DISPLAY_NAME}} ({{ARCHETYPE}} archetype).
 * Domain types are pure data contracts — no infrastructure imports allowed.
 */

/** A request processed by the {{DISPLAY_NAME}} gateway engine. */
export interface ProductRequest {
  readonly path: string;
  readonly method: string;
  readonly body?: unknown;
}

/** Routing configuration evaluated by the gateway engine. */
export interface ProductRoutingConfig {
  readonly defaultTarget: string;
}
`;

const ANALYZER_SCHEMAS = `/**
 * Zod schemas for {{DISPLAY_NAME}} domain inputs and configuration.
 * Domain code validates every external input with these schemas (V3 rule 8.3).
 */

import { z } from "zod";

/** Input accepted by the analysis engine. */
export const productInputSchema = z.object({
  /** The target being analyzed. */
  target: z.string().min(1),
});

export type ProductInput = z.infer<typeof productInputSchema>;

/** Configuration accepted by the analysis engine. */
export const productConfigSchema = z.object({
  /** Maximum number of findings to return. */
  maxFindings: z.number().int().positive().default(100),
});

export type ProductConfig = z.infer<typeof productConfigSchema>;
`;

const OPTIMIZER_SCHEMAS = `/**
 * Zod schemas for {{DISPLAY_NAME}} domain inputs and configuration.
 * Domain code validates every external input with these schemas (V3 rule 8.3).
 */

import { z } from "zod";

/** Input accepted by the optimizer engine. */
export const productInputSchema = z.object({
  /** The target being measured. */
  target: z.string().min(1),
});

export type ProductInput = z.infer<typeof productInputSchema>;

/** Configuration accepted by the optimizer engine. */
export const productConfigSchema = z.object({
  /** Maximum number of recommendations to return. */
  maxRecommendations: z.number().int().positive().default(20),
});

export type ProductConfig = z.infer<typeof productConfigSchema>;
`;

const GENERATOR_SCHEMAS = `/**
 * Zod schemas for {{DISPLAY_NAME}} domain inputs and configuration.
 * Domain code validates every external input with these schemas (V3 rule 8.3).
 */

import { z } from "zod";

/** Input accepted by the generator engine. */
export const productInputSchema = z.object({
  /** Free-form description of the artifact to generate. */
  description: z.string().min(1),
});

export type ProductInput = z.infer<typeof productInputSchema>;

/** Configuration accepted by the generator engine. */
export const productConfigSchema = z.object({
  /** Output format of the generated artifact. */
  format: z.enum(["json", "markdown"]).default("json"),
});

export type ProductConfig = z.infer<typeof productConfigSchema>;
`;

const TRANSFORMER_SCHEMAS = `/**
 * Zod schemas for {{DISPLAY_NAME}} domain inputs and configuration.
 * Domain code validates every external input with these schemas (V3 rule 8.3).
 */

import { z } from "zod";

/** Input accepted by the transformer engine. */
export const productInputSchema = z.object({
  /** The artifact to transform. */
  content: z.string().min(1),
});

export type ProductInput = z.infer<typeof productInputSchema>;

/** Configuration accepted by the transformer engine. */
export const productConfigSchema = z.object({
  /** Target format of the transformation. */
  targetFormat: z.string().min(1).default("json"),
});

export type ProductConfig = z.infer<typeof productConfigSchema>;
`;

const MIDDLEWARE_SCHEMAS = `/**
 * Zod schemas for {{DISPLAY_NAME}} domain inputs and configuration.
 * Domain code validates every external input with these schemas (V3 rule 8.3).
 */

import { z } from "zod";

/** A request evaluated by the middleware engine. */
export const productRequestSchema = z.object({
  path: z.string().min(1),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
});

export type ProductRequest = z.infer<typeof productRequestSchema>;

/** Context the middleware engine evaluates requests against. */
export const productContextSchema = z.object({
  policyVersion: z.number().int().nonnegative().default(1),
});

export type ProductContext = z.infer<typeof productContextSchema>;
`;

const GATEWAY_SCHEMAS = `/**
 * Zod schemas for {{DISPLAY_NAME}} domain inputs and configuration.
 * Domain code validates every external input with these schemas (V3 rule 8.3).
 */

import { z } from "zod";

/** A request processed by the gateway engine. */
export const productRequestSchema = z.object({
  path: z.string().min(1),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  body: z.unknown().optional(),
});

export type ProductRequest = z.infer<typeof productRequestSchema>;

/** Routing configuration evaluated by the gateway engine. */
export const productRoutingConfigSchema = z.object({
  defaultTarget: z.string().min(1),
});

export type ProductRoutingConfig = z.infer<typeof productRoutingConfigSchema>;
`;

const ENGINE_TEST = `import { describe, expect, it } from "vitest";
import { ProductEngine } from "../engine.js";

describe("ProductEngine", () => {
  const config = { maxFindings: 100 };

  it("rejects invalid input with an error Result", async () => {
    const engine = new ProductEngine();
    const result = await engine.execute({ target: "" }, config, () => {});
    expect(result.ok).toBe(false);
  });

  it("accepts valid input and reports an empty result on the skeleton", async () => {
    const engine = new ProductEngine();
    const progress: number[] = [];
    const result = await engine.execute({ target: "example" }, config, (percent) => progress.push(percent));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.summary.totalFindings).toBe(0);
      expect(progress).toContain(100);
    }
  });
});
`;

const GENERATOR_TEST = `import { describe, expect, it } from "vitest";
import { ProductEngine } from "../engine.js";

describe("ProductEngine", () => {
  const config = { format: "json" };

  it("rejects invalid input with an error Result", async () => {
    const engine = new ProductEngine();
    const result = await engine.generate({ description: "" }, config);
    expect(result.ok).toBe(false);
  });

  it("accepts valid input and reports an empty artifact on the skeleton", async () => {
    const engine = new ProductEngine();
    const result = await engine.generate({ description: "example" }, config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.artifact.kind).toBe("skeleton");
    }
  });
});
`;

const TRANSFORMER_TEST = `import { describe, expect, it } from "vitest";
import { ProductEngine } from "../engine.js";

describe("ProductEngine", () => {
  const config = { targetFormat: "json" };

  it("rejects invalid input with an error Result", async () => {
    const engine = new ProductEngine();
    const result = await engine.transform({ content: "" }, config);
    expect(result.ok).toBe(false);
  });

  it("accepts valid input and returns a skeleton output", async () => {
    const engine = new ProductEngine();
    const result = await engine.transform({ content: "example" }, config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.output.format).toBe("skeleton");
    }
  });
});
`;

const MIDDLEWARE_TEST = `import { describe, expect, it } from "vitest";
import { ProductEngine } from "../engine.js";

describe("ProductEngine", () => {
  const context = { policyVersion: 1 };

  it("rejects an invalid request with an error Result", async () => {
    const engine = new ProductEngine();
    const result = await engine.evaluate({ path: "", method: "GET" }, context);
    expect(result.ok).toBe(false);
  });

  it("allows valid requests on the skeleton policy", async () => {
    const engine = new ProductEngine();
    const result = await engine.evaluate({ path: "/health", method: "GET" }, context);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.action).toBe("allow");
    }
  });
});
`;

const GATEWAY_TEST = `import { describe, expect, it } from "vitest";
import { ProductEngine } from "../engine.js";

describe("ProductEngine", () => {
  const config = { defaultTarget: "origin" };

  it("rejects an invalid request with an error Result", async () => {
    const engine = new ProductEngine();
    const result = await engine.process({ path: "", method: "GET" }, config);
    expect(result.ok).toBe(false);
  });

  it("forwards valid requests on the skeleton gateway", async () => {
    const engine = new ProductEngine();
    const result = await engine.process({ path: "/api/health", method: "GET" }, config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.forwardedRequest.path).toBe("/api/health");
    }
  });
});
`;

const TYPES_TEMPLATES: Readonly<Record<Archetype, string>> = {
  analyzer: ANALYZER_TYPES,
  optimizer: OPTIMIZER_TYPES,
  generator: GENERATOR_TYPES,
  transformer: TRANSFORMER_TYPES,
  middleware: MIDDLEWARE_TYPES,
  gateway: GATEWAY_TYPES,
};

const SCHEMAS_TEMPLATES: Readonly<Record<Archetype, string>> = {
  analyzer: ANALYZER_SCHEMAS,
  optimizer: OPTIMIZER_SCHEMAS,
  generator: GENERATOR_SCHEMAS,
  transformer: TRANSFORMER_SCHEMAS,
  middleware: MIDDLEWARE_SCHEMAS,
  gateway: GATEWAY_SCHEMAS,
};

const TEST_TEMPLATES: Readonly<Record<Archetype, string>> = {
  analyzer: ENGINE_TEST,
  optimizer: ENGINE_TEST,
  generator: GENERATOR_TEST,
  transformer: TRANSFORMER_TEST,
  middleware: MIDDLEWARE_TEST,
  gateway: GATEWAY_TEST,
};

// ---------------------------------------------------------------------------
// providers.ts — the composition root
// ---------------------------------------------------------------------------

const PROVIDERS = `/**
 * providers.ts — the product composition root.
 *
 * Frozen V3 rule 2.4 / principle P5: this is the ONLY file in the application
 * allowed to import adapter packages (packages/adapters/*). Every other module
 * imports wired ports from here, for example:
 *
 *   import { authPort } from "@/providers";
 *
 * The {{DISPLAY_NAME}} skeleton ships with no adapters wired and no vendor SDK
 * dependencies. To activate a provider:
 *
 *   1. add the adapter package (for example \`@forge/adapter-clerk\`) to the
 *      product's dependencies
 *   2. import the adapter and export it under its port type, for example:
 *
 *        import { clerkAuthAdapter } from "@forge/adapter-clerk";
 *        export const authPort = clerkAuthAdapter;
 *
 *   3. document the wiring in docs/PROVIDERS.md and docs/SETUP.md
 *
 * Provider changes never touch domain or feature code.
 */
export {};
`;

// ---------------------------------------------------------------------------
// product.manifest.ts
// ---------------------------------------------------------------------------

const MANIFEST = `import { defineProductManifest } from "@forge/config";

/**
 * {{DISPLAY_NAME}} product manifest — frozen V3 §8.1.
 *
 * The manifest is the machine-readable contract consumed by Forge tooling
 * (create-product, extraction-validate, arch-check, validate-docs). Keep it
 * static: values are plain literals so tooling can evaluate it without
 * executing the file.
 */
export default defineProductManifest({
  id: "{{ID}}",
  displayName: "{{DISPLAY_NAME}}",
  tagline: "{{TAGLINE}}",
  primaryArchetype: "{{ARCHETYPE}}",
  capabilities: [{{CAPABILITIES_QUOTED}}],
  plans: [],
  requiresWorker: {{HAS_WORKER}},
  requiresAIProvider: {{HAS_AI}},
});
`;

// ---------------------------------------------------------------------------
// README.md
// ---------------------------------------------------------------------------

const README = `# {{DISPLAY_NAME}}

{{TAGLINE}}

**Product ID:** \`{{ID}}\` · **Primary archetype:** \`{{ARCHETYPE}}\` · **Capabilities:** {{CAPABILITIES}}

## Overview

{{DISPLAY_NAME}} is a Forge V3 product scaffolded with \`pnpm create-product\`.
It implements the {{ARCHETYPE}} archetype contract in \`src/domain/engine.ts\`
and follows the frozen Forge architecture: pure domain logic, provider
isolation behind ports, and machine-enforced package boundaries.

## Repository layout

- \`src/domain/\` — pure domain logic (engine, types, Zod schemas, unit tests)
- \`src/providers.ts\` — the composition root; the only file allowed to import adapters
- \`src/features/\` — feature modules (Server Actions, queries, components)
- \`src/db/\` — product schema and migrations (added when persistence is implemented)
- \`docs/\` — the ten required product documents

## Quick start

\`\`\`bash
pnpm install
pnpm build
pnpm test
pnpm arch-check
pnpm validate-docs
\`\`\`

## Provider wiring

All adapter selection happens in \`src/providers.ts\`. No other file may import
\`@forge/adapter-*\` packages or vendor SDKs directly. See \`docs/PROVIDERS.md\`.

## Documentation

- \`docs/ARCHITECTURE.md\` — domain contracts, boundaries, dependency flow
- \`docs/SETUP.md\` — prerequisites, environment variables, local setup
- \`docs/DEPLOYMENT.md\` — deployment targets and release process
- \`docs/DATABASE.md\` — schema, migrations, tenant scoping, extraction strategy
- \`docs/PROVIDERS.md\` — ports, providers.ts, provider replacement
- \`docs/API.md\` — Server Actions, routes, webhooks, error contracts
- \`docs/TESTING.md\` — test layers, coverage, conformance validation
- \`docs/SECURITY.md\` — security model, authentication, authorization
- \`docs/OPERATIONS.md\` — monitoring, logging, scaling, troubleshooting
- \`docs/ACQUISITION.md\` — extraction, data handoff, manual migration workflow

## License

Proprietary — All rights reserved.
`;

// ---------------------------------------------------------------------------
// The ten required product documents
// ---------------------------------------------------------------------------

const DOC_ARCHITECTURE = `# {{DISPLAY_NAME}} Architecture

## Overview

{{DISPLAY_NAME}} (product id \`{{ID}}\`) is a {{ARCHETYPE}} product built on the Forge V3
framework. It is a self-contained application under \`apps/{{ID}}/\` with its own package
manifest, domain code, provider wiring, and documentation. The product follows the
frozen Forge architecture: domain logic stays pure, providers are swappable behind
ports, and every boundary is machine-enforced by \`pnpm arch-check\` and
\`pnpm validate-docs\`.

## Domain model

The product's domain lives in \`src/domain/\` and contains:

- \`engine.ts\` — implements the {{ARCHETYPE}} archetype contract from \`@forge/domain\`
- \`types.ts\` — product-specific domain types
- \`schemas.ts\` — Zod schemas for every external input
- \`__tests__/\` — unit tests for the engine

Domain code may import only \`@forge/shared\`, \`@forge/domain\`, Zod, and local files.
It never imports Next.js, React, database packages, adapters, or vendor SDKs.

## Engine contract

The engine implements the {{ARCHETYPE}} contract (V3 §8.2). The skeleton validates its
input with the Zod schemas and returns a \`Result\`; every product feature must call the
engine through this contract and never bypass validation. The engine has zero side
effects: infrastructure (queries, jobs, external calls) lives in \`src/features/\` or
middleware.

## Dependency flow

Application code depends on Forge ports (auth, billing, email, analytics, jobs,
storage, ai-provider) through the typed port packages. Adapters implement those ports,
and \`src/providers.ts\` is the only file allowed to import adapter packages. The flow
is:

application/domain code → Forge ports → providers.ts → adapter → vendor SDK

## Capabilities

The manifest declares the capabilities this product composes: {{CAPABILITIES}}. Each
capability maps to a Forge subsystem ({{CAPABILITIES_LIST}}) that is wired through
\`src/providers.ts\` when implemented.

## Worker process

{{WORKER_SENTENCE}}

## Enforcement

\`pnpm arch-check\` enforces package boundaries, vendor containment, domain purity, and
dependency direction. \`pnpm validate-docs\` enforces documentation completeness. Both
run in CI and must pass before any deployment. The product's own docs describe each
enforced rule in detail.
`;

const DOC_SETUP = `# {{DISPLAY_NAME}} Setup

## Prerequisites

- Node.js 22 or newer and pnpm 8 or newer (the repository pins the package manager)
- PostgreSQL 16 or newer for local development once persistence is implemented
- The Forge monorepo checked out with this product at \`apps/{{ID}}/\`

## Installation

From the repository root:

\`\`\`bash
pnpm install
pnpm build
\`\`\`

The product resolves its workspace dependencies (\`@forge/config\`, \`@forge/domain\`,
\`@forge/shared\`) through \`pnpm-workspace.yaml\`. The skeleton requires no vendor SDKs.

## Environment variables

Configuration is validated through the \`@forge/config\` environment schema. Create a
\`.env.local\` file in the product directory when environment-specific values are
needed. The skeleton itself requires no environment variables. As the product
implements providers and persistence, declare and document every variable here:

| Variable | Purpose | Required |
| --- | --- | --- |
| \`DATABASE_URL\` | PostgreSQL connection string | when persistence is added |
| \`AUTH_SECRET\` / provider keys | authentication provider credentials | when auth is wired |
| \`BILLING_SECRET\` | billing provider webhook secret | when billing is wired |
| \`EMAIL_API_KEY\` | email provider API key | when email is wired |
| \`ANALYTICS_API_KEY\` | analytics provider API key | when analytics is wired |
| \`JOB_QUEUE_CONNECTION\` | job queue connection string | when the worker is enabled |

Never commit real values; \`.env*\` files are gitignored and only \`.env.example\` may be
committed. Missing required variables cause startup to fail fast with a clear message.

## Verification

\`\`\`bash
pnpm arch-check
pnpm validate-docs
pnpm test
\`\`\`

## Troubleshooting

If \`pnpm arch-check\` or \`pnpm validate-docs\` fails, resolve the reported diagnostics
before continuing; the product is not compliant until both pass. If \`pnpm install\`
fails, confirm the package manager version and that workspace packages are declared
with the \`workspace:\` protocol.
`;

const DOC_DEPLOYMENT = `# {{DISPLAY_NAME}} Deployment

## Deployment targets

{{DISPLAY_NAME}} is a self-contained application that can be deployed to any Node.js
runtime: a container platform, a VM, or a serverless Node host. No cloud provider is
mandatory (frozen principle P16). The deployment is defined by the product's
\`package.json\` scripts and, once added during implementation, its \`Dockerfile\` and
\`docker-compose.yml\`.

## Docker

During product implementation this product gains a \`Dockerfile\` for the web process
and, because the product {{WORKER_PHRASE}}, the worker artifacts as declared in the
manifest. Containers must run as a non-root user, respect environment variables for
secrets, expose a health check endpoint, and shut down gracefully on SIGTERM.

## Environment

Every environment needs a complete set of validated environment variables (see
\`docs/SETUP.md\`). Configuration is read through \`@forge/config\`; startup fails fast
when a required variable is missing. Secrets are never baked into images; they are
injected at runtime by the deployment platform.

## Release process

1. Run the full quality gate: \`pnpm lint\`, \`pnpm typecheck\`, \`pnpm test\`,
   \`pnpm arch-check\`, \`pnpm validate-docs\`.
2. Build the application (\`pnpm build\`).
3. Publish the container image with an immutable tag.
4. Deploy, then verify the health endpoint and the documented smoke checks.

## Rollback

Keep the previous image tag available. Rollback is a redeploy of the previous tag plus
any required database migration reversal; migrations must be backward compatible so the
previous application version can run while data converges.

## Monitoring

Every deployment must report health, error rates, and latency to the operations
tooling described in \`docs/OPERATIONS.md\`.
`;

const DOC_DATABASE = `# {{DISPLAY_NAME}} Database

## Schema

{{DISPLAY_NAME}} follows the frozen Forge data model: PostgreSQL with Drizzle, one
product-scoped schema, and no ORM inside domain code. The skeleton ships without a
database implementation; when persistence is added, the product defines its schema in
\`src/db/schema.ts\` and its migrations in \`src/db/migrations/\`.

### Schema rules

- Every tenant-scoped table carries an \`organization_id\` column.
- Queries against tenant tables use the \`withOrg()\` scoping helper from \`@forge/db\`.
- Tables are defined with Drizzle's typed schema helpers; raw SQL is limited to
  reviewed migrations.
- Product tables live in the product's own named schema so that data remains separable
  (frozen principle P20).

## Migrations

Migrations live in \`src/db/migrations/\` and follow the naming convention
\`YYYYMMDD_HHmmss_description.sql\`. They run through the \`@forge/db\` migration runner
and are applied automatically by the deployment stack at startup. Migrations are
append-only: existing migrations are never edited after they have been applied.

## Access paths

Application code queries the database through \`src/features/*/queries.ts\` modules,
never from domain code. Domain logic receives plain data and returns \`Result\` values;
the database is an implementation detail of the feature layer.

## Extraction strategy

All product data is identifiable and extractable without redesign (frozen principle
P20). The \`docs/ACQUISITION.md\` document explains how the product's schema and data
are exported during acquisition.

## Local development

Use a local PostgreSQL instance (for example via Docker) and set \`DATABASE_URL\` in
\`.env.local\`. Run migrations before starting the application; the full setup is
documented in \`docs/SETUP.md\`.
`;

const DOC_PROVIDERS = `# {{DISPLAY_NAME}} Providers

## Ports and adapters

{{DISPLAY_NAME}} consumes external capabilities exclusively through Forge port
packages (\`@forge/auth\`, \`@forge/billing\`, \`@forge/email\`, \`@forge/analytics\`,
\`@forge/jobs\`, \`@forge/storage\`, \`@forge/ai-provider\`). Ports are provider-neutral
interfaces; adapters in \`packages/adapters/*\` implement them for a concrete vendor.

The product declares the capabilities it needs in \`product.manifest.ts\`:
{{CAPABILITIES}}.

## Composition root

\`src/providers.ts\` is the only file in the application allowed to import adapter
packages. Every other module imports the wired ports from it, for example:

\`\`\`ts
import { authPort } from "@/providers";
\`\`\`

The skeleton ships with no adapters wired. Wiring a provider is a three step change:

1. Add the adapter package to this product's dependencies (for example
   \`@forge/adapter-clerk\`).
2. Import the adapter and export it as its port type in \`src/providers.ts\`.
3. Document the provider choice and its environment variables in this document and in
   \`docs/SETUP.md\`.

## Provider replacement

Replacing a provider must not change application or domain code:

1. Implement or select a new adapter that satisfies the port's conformance suite.
2. Verify the adapter passes the \`packages/testing/conformance\` tests.
3. Switch the wiring in \`src/providers.ts\`.
4. Update environment variables and this document.

If \`pnpm arch-check\` reports vendor leakage or adapter bypass, the wiring is wrong;
vendor SDKs may appear only inside adapter packages.

## Migration from a legacy application

Products imported with \`pnpm extract-product\` arrive with an
\`extraction-report.json\` that lists every provider integration found in the source,
classified REVIEW or MANUAL. Each integration must be migrated behind its port before
the product is compliant; the report's remediation notes describe the required work.
`;

const DOC_API = `# {{DISPLAY_NAME}} API

## Surface

{{DISPLAY_NAME}} exposes its behavior through Next.js App Router routes and Server
Actions once the application layer is implemented. The skeleton defines the conventions
below; every route and action added to the product must follow them.

## Server Actions

State-changing operations are Server Actions in \`src/features/*/actions.ts\`. Every
action:

- validates its input with a Zod schema from \`src/domain/schemas.ts\` or a feature
  schema
- authorizes the caller through the auth port (\`authPort\`) before touching data
- returns \`Result<T, E>\` and never throws for expected failures
- uses \`revalidatePath\` or \`revalidateTag\` after mutations that affect rendered data

## API routes and webhooks

Machine-to-machine endpoints live in \`src/app/api/\`. Webhook endpoints are the only
places that consume raw provider payloads: each webhook handler is implemented by an
adapter (for example \`BillingWebhookHandler\` from \`@forge/billing\`) and verifies the
provider's signature before any data is changed.

## Contracts

Public contracts are documented here as they are implemented:

| Endpoint / action | Method | Input schema | Output | Authorization |
| --- | --- | --- | --- | --- |

## Errors

Every endpoint and action returns structured errors via \`Result\`. Error responses
never leak stack traces, connection strings, or provider secrets; \`@forge/shared\`
error types carry machine-readable codes that clients can branch on.

## Testing

Every route and action has integration coverage under \`src/__tests__/integration/\`
(see \`docs/TESTING.md\`). Webhook handlers are tested with signed fixture payloads.
`;

const DOC_TESTING = `# {{DISPLAY_NAME}} Testing

## Test layers

- Unit tests for domain logic live in \`src/domain/__tests__/\` and run with Vitest.
  They cover the engine contract: valid inputs, invalid inputs, and every Result
  branch.
- Integration tests for Server Actions, API routes, and webhooks live in
  \`src/__tests__/integration/\` and run against a test database.
- Conformance tests from \`packages/testing/conformance\` prove that every wired
  adapter satisfies its port contract; adapters are replaceable only when they pass.
- End-to-end tests (Playwright) cover critical user flows in \`e2e/flows/\` and
  security scenarios in \`e2e/security/\` once the application layer is implemented.

## Running tests

\`\`\`bash
pnpm test              # all workspace tests
pnpm --filter {{ID}} test
\`\`\`

## Coverage

Domain logic is the quality gate: every branch of the engine is exercised, including
the error branch of each Zod validation. Coverage is a quality signal, not proof
(frozen principle P22); the required scenarios are documented in the product checklist.

## Conformance validation

When a provider is wired, its adapter must pass the conformance suite for its port
before the wiring is accepted. This is the machine-enforced proof that the provider can
be replaced without touching application code.

## Test data

Factories come from \`@forge/testing\`. Test data never persists in the development or
production database, and tests never send real emails, payments, or analytics events;
provider calls are mocked at the port boundary.

## CI

The repository CI runs \`pnpm test\` for every package; a failing test blocks merge.
`;

const DOC_SECURITY = `# {{DISPLAY_NAME}} Security

## Security model

{{DISPLAY_NAME}} follows the frozen Forge security model: security is implemented, not
inherited (frozen principle P18). The framework provides primitives; the product
implements the controls. The model has three layers: authentication establishes the
caller, authorization checks every data access, and the application never trusts
client-supplied input.

## Authentication

Authentication goes through the auth port (\`authPort\` from \`src/providers.ts\`).
Routes and Server Actions require an authenticated principal before they run;
unauthenticated requests are rejected by middleware. Credentials and session material
are handled exclusively by the auth adapter; product code never reads or stores
passwords or session secrets.

## Authorization

Authorization is enforced per request, not per page. Every query of tenant-scoped data
uses \`withOrg()\` from \`@forge/db\` so that a user can never read or mutate another
organization's records (IDOR prevention). Server Actions re-check authorization after
validating input; authorization is never inferred from the URL.

## Threat mitigations

- CSRF: state-changing actions require CSRF protection; webhooks verify provider
  signatures before processing payloads.
- SQL injection: all queries are typed Drizzle queries; raw SQL appears only in
  reviewed migrations.
- XSS: React output is escaped; \`dangerouslySetInnerHTML\` is not used.
- Secrets: real credentials never appear in code, logs, or committed files; only
  \`.env.example\` documents variable names.
- Rate limiting: endpoints that create resources or send email are rate limited.

## Reporting

Security incidents and suspected vulnerabilities are reported through the product's
operations channels documented in \`docs/OPERATIONS.md\`. Dependencies are audited in
CI.
`;

const DOC_OPERATIONS = `# {{DISPLAY_NAME}} Operations

## Monitoring

{{DISPLAY_NAME}} reports health, error rates, and latency from every deployed
environment. A health check endpoint returns the application status and must be
configured in the container orchestrator and load balancer. Error rates are watched per
route and per provider; provider failures surface through the port boundaries and are
logged with their operation context.

## Logging

Logs are structured and machine-readable. Sensitive data is never logged: passwords,
tokens, API keys, webhook signatures, and full database connection strings are redacted
before anything is written. Correlation identifiers connect a request across the
application, worker, and provider boundaries.

## Scaling

The web process scales horizontally; the worker process scales independently because
the product {{WORKER_PHRASE}}. The job queue is PostgreSQL-backed and follows the
frozen default (pg-boss). Scaling the database is a deployment concern; the product's
schema stays product-scoped so the database can be split per product if needed (frozen
principle P8).

## Backups

Database backups follow the product data boundary: every product-scoped record is
restorable independently (frozen principle P20). Backup and restore procedures are
documented in \`docs/ACQUISITION.md\` and are exercised at least monthly.

## Troubleshooting

Common failure modes:

- Startup failure with a configuration error: a required environment variable is
  missing; see \`docs/SETUP.md\`.
- \`pnpm arch-check\` failures: an import crossed a frozen boundary; fix the import, do
  not weaken the rule.
- Provider errors: verify credentials and webhook signatures, then check the provider
  status page; the port boundary isolates the provider from the rest of the product.

## Incident response

Every incident is documented with timeline, impact, and remediation. Post-incident
changes follow the normal CI gates (\`pnpm test\`, \`pnpm arch-check\`,
\`pnpm validate-docs\`).
`;

const DOC_ACQUISITION = `# {{DISPLAY_NAME}} Acquisition

## Extraction

{{DISPLAY_NAME}} is acquisition-ready by construction (frozen principle P15): the
product survives extraction at any time. Extraction produces a standalone repository
containing the product code, its documentation, its provider wiring, and its database
schema. The extraction flow is:

1. \`pnpm extract-product\` produces the product archive and the extraction report
   describing every file, dependency, and provider integration.
2. \`pnpm extraction-validate\` verifies the extracted product against the frozen
   structure, manifest, documentation, and provider isolation rules.
3. \`pnpm arch-check\` and \`pnpm validate-docs\` run on the extracted repository as the
   final gates.

## Data handoff

Every persistent record belonging to {{DISPLAY_NAME}} is identifiable and extractable
without redesign (frozen principle P20). The product schema is product-scoped, and
tenant data is scoped by \`organization_id\`, so the acquiring team exports only the
product's schema and rows.

## Provider migration

The acquiring team replaces the product's providers as part of the handoff: auth,
billing, email, analytics, jobs, storage, and AI providers are swapped by implementing
or selecting adapters that pass the port conformance suites and updating
\`src/providers.ts\` (see \`docs/PROVIDERS.md\`). Application and domain code are not
modified by a provider change.

## What the acquirer receives

- the full product source with domain tests and documentation
- the product manifest and provider wiring
- the database schema, migrations, and an export of product-scoped data
- the extraction report listing all manual migration items with remediations

## Manual migration workflow

Items classified MANUAL in the extraction report are never silently transformed; each
carries a remediation note. The acquiring team works through the list, re-running
\`pnpm extraction-validate\` after each item until the product is compliant.
`;

const DOC_TEMPLATES: Readonly<Record<(typeof REQUIRED_PRODUCT_DOCUMENTS)[number], string>> = {
  "ARCHITECTURE.md": DOC_ARCHITECTURE,
  "SETUP.md": DOC_SETUP,
  "DEPLOYMENT.md": DOC_DEPLOYMENT,
  "DATABASE.md": DOC_DATABASE,
  "PROVIDERS.md": DOC_PROVIDERS,
  "API.md": DOC_API,
  "TESTING.md": DOC_TESTING,
  "SECURITY.md": DOC_SECURITY,
  "OPERATIONS.md": DOC_OPERATIONS,
  "ACQUISITION.md": DOC_ACQUISITION,
};

// ---------------------------------------------------------------------------
// package.json / tsconfig.json builders
// ---------------------------------------------------------------------------

/** Forge packages every product depends on. */
export const BASE_PRODUCT_DEPENDENCIES: Readonly<Record<string, string>> = {
  "@forge/config": "workspace:*",
  "@forge/domain": "workspace:*",
  "@forge/shared": "workspace:*",
  zod: "^3.23.8",
};

/** The standard Forge dev toolchain for products. */
export const PRODUCT_DEV_DEPENDENCIES: Readonly<Record<string, string>> = {
  "@types/node": "^26.2.0",
  eslint: "^8.0.0",
  typescript: "^5.8.3",
  vitest: "^1.0.0",
};

/** Workspace dependencies required by the product's declared capabilities. */
export function capabilityDependencies(spec: ProductSpec): Readonly<Record<string, string>> {
  const dependencies: Record<string, string> = {};
  for (const capability of spec.capabilities) {
    const dependency = CAPABILITY_DEPENDENCIES[capability];
    if (dependency !== undefined) dependencies[dependency] = "workspace:*";
  }
  if (spec.requiresWorker) dependencies["@forge/jobs"] = "workspace:*";
  if (spec.requiresAIProvider) dependencies["@forge/ai-provider"] = "workspace:*";
  return dependencies;
}

export function productPackageJson(spec: ProductSpec): string {
  return `${JSON.stringify(
    {
      name: spec.id,
      version: "0.0.1",
      description: `${spec.displayName} — Forge V3 product (${spec.primaryArchetype} archetype)`,
      private: true,
      type: "module",
      scripts: {
        build: "tsc",
        typecheck: "tsc --noEmit",
        lint: "eslint .",
        test: "vitest run",
      },
      dependencies: {
        ...BASE_PRODUCT_DEPENDENCIES,
        ...capabilityDependencies(spec),
      },
      devDependencies: PRODUCT_DEV_DEPENDENCIES,
    },
    null,
    2,
  )}\n`;
}

export function productTsconfig(spec: ProductSpec, standalone: boolean): string {
  const compilerOptions = {
    target: "ES2022",
    module: "ESNext",
    lib: ["ES2022"],
    declaration: true,
    outDir: "./dist",
    rootDir: "./src",
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    resolveJsonModule: true,
    moduleResolution: "bundler",
    types: ["node"],
  };
  const config = standalone
    ? { compilerOptions, include: ["src"], exclude: ["node_modules", "dist", "**/*.test.ts"] }
    : {
        extends: "../../tsconfig.json",
        compilerOptions: { rootDir: "./src", outDir: "./dist", types: ["node"] },
        include: ["src"],
        exclude: ["node_modules", "dist", "**/*.test.ts"],
      };
  return `${JSON.stringify(config, null, 2)}\n`;
}

// ---------------------------------------------------------------------------
// Sub-directory READMEs (mark the frozen structure without inventing code)
// ---------------------------------------------------------------------------

const DIR_README_APP = `# src/app

Next.js App Router entry points for {{DISPLAY_NAME}} (V3 §3.3): layouts, marketing and
dashboard routes, API and webhook routes, and auth middleware. This directory is
populated during product implementation. Domain logic never lives here; see
docs/ARCHITECTURE.md.
`;

const DIR_README_FEATURES = `# src/features

Feature modules for {{DISPLAY_NAME}}: each feature owns its Server Actions
(\`actions.ts\`), queries (\`queries.ts\`), and components. Features may import ports
from \`@/providers\` and \`@forge/db\`, but never adapters or vendor SDKs. See
docs/ARCHITECTURE.md.
`;

const DIR_README_DB = `# src/db

Product-scoped PostgreSQL schema and migrations for {{DISPLAY_NAME}} (V3 §6). The
skeleton ships without a database implementation; when persistence is added, define
the Drizzle schema in \`schema.ts\` and migrations in \`migrations/\`
(\`YYYYMMDD_HHmmss_description.sql\`). Tenant tables carry \`organization_id\` and all
queries use \`withOrg()\`. See docs/DATABASE.md.
`;

const DIR_README_THEME = `# src/theme

Design tokens for {{DISPLAY_NAME}} (frozen principle P13): \`tokens.ts\` defines the
product's visual identity and \`globals.css\` applies tokens as CSS custom properties.
The UI layer is composed from \`@forge/ui\` primitives. See docs/ARCHITECTURE.md.
`;

const DIR_README_WORKER = `# src/worker

Background worker for {{DISPLAY_NAME}}: \`index.ts\` starts the job queue and registers
processors. Jobs are defined through the \`@forge/jobs\` port; the worker process runs
as a separate container. See docs/DEPLOYMENT.md and docs/PROVIDERS.md.
`;

// ---------------------------------------------------------------------------
// File map assembly
// ---------------------------------------------------------------------------

/**
 * Builds the complete deterministic file map for a product skeleton.
 * Paths are posix-relative to the product directory.
 */
export function buildProductFileMap(spec: ProductSpec): readonly GeneratedFile[] {
  const tokens = tokensFor(spec);
  const files: GeneratedFile[] = [];

  files.push({
    path: "product.manifest.ts",
    content: render(MANIFEST, {
      ...tokens,
      CAPABILITIES_QUOTED: spec.capabilities.map((capability) => `"${capability}"`).join(", "),
      HAS_WORKER: String(spec.requiresWorker),
      HAS_AI: String(spec.requiresAIProvider),
    }),
  });
  files.push({ path: "README.md", content: render(README, tokens) });
  files.push({ path: "package.json", content: productPackageJson(spec) });
  files.push({ path: "tsconfig.json", content: productTsconfig(spec, false) });
  files.push({ path: "src/providers.ts", content: render(PROVIDERS, tokens) });

  files.push({ path: "src/domain/engine.ts", content: render(ENGINE_TEMPLATES[spec.primaryArchetype], tokens) });
  files.push({ path: "src/domain/types.ts", content: render(TYPES_TEMPLATES[spec.primaryArchetype], tokens) });
  files.push({ path: "src/domain/schemas.ts", content: render(SCHEMAS_TEMPLATES[spec.primaryArchetype], tokens) });
  files.push({
    path: "src/domain/__tests__/engine.test.ts",
    content: render(TEST_TEMPLATES[spec.primaryArchetype], tokens),
  });

  files.push({ path: "src/app/README.md", content: render(DIR_README_APP, tokens) });
  files.push({ path: "src/features/README.md", content: render(DIR_README_FEATURES, tokens) });
  files.push({ path: "src/db/README.md", content: render(DIR_README_DB, tokens) });
  files.push({ path: "src/theme/README.md", content: render(DIR_README_THEME, tokens) });
  if (spec.requiresWorker) {
    files.push({ path: "src/worker/README.md", content: render(DIR_README_WORKER, tokens) });
  }

  for (const document of REQUIRED_PRODUCT_DOCUMENTS) {
    files.push({ path: `docs/${document}`, content: render(DOC_TEMPLATES[document], tokens) });
  }

  return files.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
}

/** Builds only the documentation files (README.md + docs/*) for a spec. */
export function buildProductDocs(spec: ProductSpec): readonly GeneratedFile[] {
  return buildProductFileMap(spec).filter(
    (file) => file.path === "README.md" || file.path.startsWith("docs/"),
  );
}
