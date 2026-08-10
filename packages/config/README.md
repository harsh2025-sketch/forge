# @forge/config

Configuration kernel for the Forge Master SaaS Framework (Layer 0).

Provider-neutral, typed, deterministic, secret-safe configuration boundary.

## Purpose

`@forge/config` is the single controlled boundary for configuration in Forge:

- Defines `ProductManifest`, `Archetype`, `Capability`, and `PlanDefinition` per V3 §8.1
- Provides a typed environment-variable loader that does not scatter `process.env` access
- Enforces explicit validation with deterministic errors (no silent coercion)
- Redacts secrets on inspection

It does **not** know that Clerk, Stripe, Supabase, Resend, Vercel, or AWS exist.
Configuration provides values to later packages; it does not implement providers.

## Installation

```json
{
  "dependencies": {
    "@forge/config": "workspace:*"
  }
}
```

Package is ESM (`type: module`), strict TypeScript, zero runtime dependencies except `@forge/shared`.

## Public API

```ts
import {
  // Product manifest
  Archetype, Capability, type ProductManifest, type PlanDefinition,
  isArchetype, isCapability,
  validateProductManifest, parseProductManifestOrThrow, defineProductManifest,

  // Env / config
  type EnvSource, type EnvField, type EnvSchema, type BaseEnv,
  defineString, defineNumber, defineBoolean, defineEnum,
  baseEnvSchema,
  getEnvSource, readRawEnv,
  loadConfig, loadConfigOrThrow, validateConfig,
  redactConfig, toSafeConfigString, isSecretField,

  // Errors
  ConfigError, isConfigError,
} from "@forge/config";
```

## How configuration is supplied

Configuration is supplied as a plain record (`EnvSource = Record<string, string | undefined>`).
In Node, `getEnvSource()` returns a shallow copy of `process.env`. In tests, pass an explicit object.

```ts
const schema = {
  API_URL: defineString({ required: true }),
  PORT: defineNumber({ defaultValue: 3000 }),
  FEATURE_FLAG: defineBoolean({ required: false }),
  SECRET_TOKEN: defineString({ required: true, secret: true }),
} as const;

const result = loadConfig(schema, { API_URL: "https://example.com", SECRET_TOKEN: "s3cr3t" });
// result.ok ? result.value : result.error (ConfigError)

 // or fail-fast at startup
const config = loadConfigOrThrow(schema);
```

There is no global singleton and no `dotenv` side effect. The caller decides when and with what source to load.

## Required vs optional vs defaults

- **Required**: `defineString({ required: true })` — missing key => `ConfigError: Missing required configuration: KEY`.
- **Optional** (no default): `defineString({ required: false })` — missing key => `undefined` in result.
- **Default**: `defineNumber({ defaultValue: 3000 })` — missing key => default value. Explicit `required: false` is implied.

All three states are typed. See `EnvSchema<T>` which uses `NonNullable` so optional properties (`OPTIONAL?: string`) work naturally.

## Validation

- String: returned as-is.
- Number: `Number(trimmed)` with `Number.isFinite` check; rejects `""`, `"abc"`, `"Infinity"`.
- Boolean: accepts `true/false`, `1/0`, `yes/no`, `on/off` case-insensitive; rejects others.
- Enum: exact match against allowed values.

Invalid values produce `ConfigError` with code `CONFIG_ERROR` and `details: { field: "KEY" }`. The message is deterministic:
- Non-secret: `Invalid configuration for KEY: <parse message>`
- Secret: `Invalid configuration for KEY: validation failed` (raw value never included).

No silent coercion: `"abc"` never becomes `0`; invalid input always fails.

## Secret handling

Mark fields with `secret: true`:

```ts
const schema = {
  STRIPE_SECRET: defineString({ required: true, secret: true }),
} as const;

const config = loadConfigOrThrow(schema, processEnv);
redactConfig(config, schema);        // { STRIPE_SECRET: "[REDACTED]" }
toSafeConfigString(config, schema); // JSON with [REDACTED]
```

Rules enforced:

- Never log raw secret values — use `redactConfig` / `toSafeConfigString`.
- Never include secret values in errors — errors for secret fields are generic.
- Never serialize secrets accidentally — `toSafeConfigString` redacts before `JSON.stringify`.
- No `.env` files are committed; `.env` is gitignored.
- Tests use placeholder secrets like `"test-secret"` not real credentials.

## Product manifest

```ts
const manifest = {
  id: "jwt-scanner",
  displayName: "JWT Scanner",
  tagline: "Scan JWTs for security issues",
  primaryArchetype: Archetype.ANALYZER,
  capabilities: [Capability.REPORTING],
  plans: [{ id: "free", name: "Free" }],
  requiresWorker: true,
  requiresAIProvider: false,
};

const result = validateProductManifest(manifest);
if (!result.ok) throw result.error; // ConfigError
```

Use `defineProductManifest(manifest)` for typed authoring, `parseProductManifestOrThrow` for fail-fast.

## Testing

Tests use Vitest and isolate environment via explicit `EnvSource` objects — never relying on the developer's real `process.env`.

Covered: valid required, missing required, optional, defaults, invalid, type conversion, secret redaction, isolation, product-manifest validation.

Run: `pnpm --filter @forge/config test`

## Package boundaries

Allowed imports: `@forge/shared`, Node stdlib. No provider SDKs, no Next.js, no React, no Drizzle.

```ts
// ALLOWED
import { ConfigError } from "@forge/config";

// FORBIDDEN — would fail CI
import Stripe from "stripe";
import { clerk } from "@clerk/nextjs";
```

## Node / runtime isolation

`getEnvSource()` guards `process` via `typeof process !== "undefined"`. The package works in Node and returns empty env in browser; it never imports `fs` or Next.js APIs.

## Dependencies

Runtime: `@forge/shared` (workspace:*)
Dev: `typescript`, `vitest`
No Zod, dotenv, convict, etc. per P6 — native validation keeps the kernel minimal.

## Secret safety checklist

- [ ] No secret values in source
- [ ] No `.env` files committed
- [ ] Redaction helpers used before logging
- [ ] Error messages for secret fields are generic
