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
export type { PlanDefinition, ProductManifest } from "./product-manifest.js";
export {
  Archetype,
  Capability,
  defineProductManifest,
  isArchetype,
  isCapability,
  parseProductManifestOrThrow,
  validateProductManifest,
} from "./product-manifest.js";

// Environment / config
export type { BaseEnv, EnvField, EnvFieldOptions, EnvSchema, EnvSource } from "./env.js";
export {
  baseEnvSchema,
  defineBoolean,
  defineEnum,
  defineNumber,
  defineString,
  getEnvSource,
  isSecretField,
  loadConfig,
  loadConfigOrThrow,
  readRawEnv,
  redactConfig,
  toSafeConfigString,
  validateConfig,
} from "./env.js";
