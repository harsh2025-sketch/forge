/**
 * @forge/config — Configuration kernel for the Forge Master SaaS Framework.
 *
 * Provider-neutral, typed, deterministic configuration boundary.
 * Depends only on @forge/shared.
 *
 * Exports:
 *  - ProductManifest, Archetype, Capability, PlanDefinition + validators
 *  - EnvSource, EnvField, EnvSchema, define* helpers, loadConfig, redact helpers
 *  - ConfigError
 */

export { ConfigError, isConfigError } from "./errors.js";

// Product manifest
export type {
  EnvironmentRequirement,
  PlanDefinition,
  ProductManifest,
  ProductProviders,
} from "./product-manifest.js";
export {
  Archetype,
  Capability,
  ProviderSlot,
  defineProductManifest,
  isArchetype,
  isCapability,
  parseProductManifestOrThrow,
  validateProductManifest,
} from "./product-manifest.js";

// Environment / config
export type { EnvField, EnvFieldOptions, EnvSchema, EnvSource } from "./env.js";
export {
  baseEnvSchema,
  defineBoolean,
  defineEnum,
  defineNumber,
  defineString,
  getEnvSource,
  loadConfig,
  loadConfigOrThrow,
  redactConfig,
  toSafeConfigString,
} from "./env.js";
