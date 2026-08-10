import { err, ok } from "@forge/shared";
import type { Result } from "@forge/shared";
import { ConfigError } from "./errors.js";

/**
 * Archetype constants per FORGE-MASTER-ARCHITECTURE-V3 §8.1
 */
export const Archetype = {
  ANALYZER: "analyzer",
  OPTIMIZER: "optimizer",
  GENERATOR: "generator",
  TRANSFORMER: "transformer",
  MIDDLEWARE: "middleware",
  GATEWAY: "gateway",
} as const;

export type Archetype = (typeof Archetype)[keyof typeof Archetype];

/**
 * Capability constants per FORGE-MASTER-ARCHITECTURE-V3 §8.1
 */
export const Capability = {
  REPORTING: "reporting",
  SCHEDULING: "scheduling",
  REMEDIATION: "remediation",
  TRANSFORMATION: "transformation",
  POLICY: "policy",
  ANALYSIS: "analysis",
  OPTIMIZATION: "optimization",
  GENERATION: "generation",
  AI_ASSISTED: "ai-assisted",
  STREAMING: "streaming",
} as const;

export type Capability = (typeof Capability)[keyof typeof Capability];

/**
 * Plan definition for product manifest.
 * Minimal provider-neutral shape: id, name, optional description,
 * optional Stripe price reference, optional limits, optional features.
 */
export interface PlanDefinition {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly stripePriceId?: string;
  readonly limits?: Readonly<Record<string, number>>;
  readonly features?: readonly string[];
}

/**
 * Product manifest per FORGE-MASTER-ARCHITECTURE-V3 §8.1
 */
export interface ProductManifest {
  readonly id: string;
  readonly displayName: string;
  readonly tagline: string;
  readonly primaryArchetype: Archetype;
  readonly capabilities: readonly Capability[];
  readonly plans: readonly PlanDefinition[];
  readonly requiresWorker: boolean;
  readonly requiresAIProvider: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ARCHETYPE_VALUES = Object.values(Archetype) as readonly string[];
const CAPABILITY_VALUES = Object.values(Capability) as readonly string[];

/**
 * Type guard for Archetype.
 */
export function isArchetype(value: unknown): value is Archetype {
  return typeof value === "string" && ARCHETYPE_VALUES.includes(value);
}

/**
 * Type guard for Capability.
 */
export function isCapability(value: unknown): value is Capability {
  return typeof value === "string" && CAPABILITY_VALUES.includes(value);
}

const PRODUCT_ID_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const PLAN_ID_RE = /^[a-z0-9][a-z0-9-_]*[a-z0-9]$/i;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validatePlanDefinition(
  plan: unknown,
  index: number
): Result<PlanDefinition, ConfigError> {
  if (typeof plan !== "object" || plan === null || Array.isArray(plan)) {
    return err(
      new ConfigError(`Invalid plan at index ${index}: expected object`, {
        details: { index },
      })
    );
  }

  const p = plan as Record<string, unknown>;

  if (!isNonEmptyString(p.id) || !PLAN_ID_RE.test(p.id)) {
    return err(
      new ConfigError(`Invalid plan at index ${index}: id must be a slug`, {
        details: { index, field: "id" },
      })
    );
  }

  if (!isNonEmptyString(p.name)) {
    return err(
      new ConfigError(`Invalid plan at index ${index}: name is required`, {
        details: { index, field: "name" },
      })
    );
  }

  if (p.description !== undefined && typeof p.description !== "string") {
    return err(
      new ConfigError(
        `Invalid plan at index ${index}: description must be a string if provided`,
        { details: { index, field: "description" } }
      )
    );
  }

  if (p.stripePriceId !== undefined && !isNonEmptyString(p.stripePriceId)) {
    return err(
      new ConfigError(
        `Invalid plan at index ${index}: stripePriceId must be a non-empty string if provided`,
        { details: { index, field: "stripePriceId" } }
      )
    );
  }

  if (p.limits !== undefined) {
    if (
      typeof p.limits !== "object" ||
      p.limits === null ||
      Array.isArray(p.limits)
    ) {
      return err(
        new ConfigError(
          `Invalid plan at index ${index}: limits must be a record if provided`,
          { details: { index, field: "limits" } }
        )
      );
    }
    for (const [k, v] of Object.entries(p.limits as Record<string, unknown>)) {
      if (typeof v !== "number" || !Number.isFinite(v)) {
        return err(
          new ConfigError(
            `Invalid plan at index ${index}: limits[${k}] must be a finite number`,
            { details: { index, field: `limits.${k}` } }
          )
        );
      }
    }
  }

  if (p.features !== undefined) {
    if (!Array.isArray(p.features)) {
      return err(
        new ConfigError(
          `Invalid plan at index ${index}: features must be an array if provided`,
          { details: { index, field: "features" } }
        )
      );
    }
    for (let j = 0; j < p.features.length; j++) {
      if (!isNonEmptyString(p.features[j])) {
        return err(
          new ConfigError(
            `Invalid plan at index ${index}: features[${j}] must be a non-empty string`,
            { details: { index, field: `features.${String(j)}` } }
          )
        );
      }
    }
  }

  return ok({
    id: p.id as string,
    name: p.name as string,
    description: p.description as string | undefined,
    stripePriceId: p.stripePriceId as string | undefined,
    limits: p.limits as Readonly<Record<string, number>> | undefined,
    features: p.features as readonly string[] | undefined,
  });
}

/**
 * Validates a product manifest. Returns Result with deterministic errors.
 * Never includes secret values (manifest has no secrets).
 */
export function validateProductManifest(
  input: unknown
): Result<ProductManifest, ConfigError> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return err(new ConfigError("Product manifest must be an object"));
  }

  const m = input as Record<string, unknown>;

  // id
  if (!isNonEmptyString(m.id) || !PRODUCT_ID_RE.test(m.id)) {
    return err(
      new ConfigError(
        "Product manifest id must be a non-empty slug (a-z, 0-9, hyphen, must start/end alphanumeric)",
        { details: { field: "id" } }
      )
    );
  }

  // displayName
  if (!isNonEmptyString(m.displayName)) {
    return err(
      new ConfigError("Product manifest displayName is required", {
        details: { field: "displayName" },
      })
    );
  }
  if ((m.displayName as string).length > 100) {
    return err(
      new ConfigError("Product manifest displayName must be <= 100 characters", {
        details: { field: "displayName" },
      })
    );
  }

  // tagline
  if (!isNonEmptyString(m.tagline)) {
    return err(
      new ConfigError("Product manifest tagline is required", {
        details: { field: "tagline" },
      })
    );
  }
  if ((m.tagline as string).length > 200) {
    return err(
      new ConfigError("Product manifest tagline must be <= 200 characters", {
        details: { field: "tagline" },
      })
    );
  }

  // primaryArchetype
  if (!isArchetype(m.primaryArchetype)) {
    return err(
      new ConfigError(
        `Product manifest primaryArchetype must be one of: ${ARCHETYPE_VALUES.join(", ")}`,
        { details: { field: "primaryArchetype" } }
      )
    );
  }

  // capabilities
  if (!Array.isArray(m.capabilities)) {
    return err(
      new ConfigError("Product manifest capabilities must be an array", {
        details: { field: "capabilities" },
      })
    );
  }
  const caps = m.capabilities as unknown[];
  const seenCaps = new Set<string>();
  for (let i = 0; i < caps.length; i++) {
    const c = caps[i];
    if (!isCapability(c)) {
      return err(
        new ConfigError(
          `Invalid capability at index ${i}: must be one of ${CAPABILITY_VALUES.join(", ")}`,
          { details: { field: `capabilities.${String(i)}` } }
        )
      );
    }
    if (seenCaps.has(c)) {
      return err(
        new ConfigError(`Duplicate capability: ${c}`, {
          details: { field: "capabilities" },
        })
      );
    }
    seenCaps.add(c);
  }

  // plans
  if (!Array.isArray(m.plans)) {
    return err(
      new ConfigError("Product manifest plans must be an array", {
        details: { field: "plans" },
      })
    );
  }
  const plans = m.plans as unknown[];
  const seenPlanIds = new Set<string>();
  const validatedPlans: PlanDefinition[] = [];
  for (let i = 0; i < plans.length; i++) {
    const result = validatePlanDefinition(plans[i], i);
    if (!result.ok) return result as Result<never, ConfigError>;
    if (seenPlanIds.has(result.value.id)) {
      return err(
        new ConfigError(`Duplicate plan id: ${result.value.id}`, {
          details: { field: "plans" },
        })
      );
    }
    seenPlanIds.add(result.value.id);
    validatedPlans.push(result.value);
  }

  // requiresWorker
  if (typeof m.requiresWorker !== "boolean") {
    return err(
      new ConfigError("Product manifest requiresWorker must be a boolean", {
        details: { field: "requiresWorker" },
      })
    );
  }

  // requiresAIProvider
  if (typeof m.requiresAIProvider !== "boolean") {
    return err(
      new ConfigError(
        "Product manifest requiresAIProvider must be a boolean",
        {
          details: { field: "requiresAIProvider" },
        }
      )
    );
  }

  return ok({
    id: m.id as string,
    displayName: m.displayName as string,
    tagline: m.tagline as string,
    primaryArchetype: m.primaryArchetype as Archetype,
    capabilities: caps as Capability[],
    plans: validatedPlans,
    requiresWorker: m.requiresWorker as boolean,
    requiresAIProvider: m.requiresAIProvider as boolean,
  });
}

/**
 * Defines a product manifest with type safety. Helper for consumers to get
 * autocompletion while still requiring runtime validation via validateProductManifest
 * for external inputs.
 */
export function defineProductManifest(
  manifest: ProductManifest
): ProductManifest {
  return manifest;
}

/**
 * Parses and validates a product manifest or throws ConfigError.
 */
export function parseProductManifestOrThrow(input: unknown): ProductManifest {
  const result = validateProductManifest(input);
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}
