import { err, ok } from "@forge/shared";
import type { Result } from "@forge/shared";
import { ConfigError } from "./errors.js";

/**
 * EnvSource is a provider-neutral abstraction over environment variables.
 *
 * Consumers pass a plain record; the kernel copies it to isolate from
 * process.env mutation and to allow deterministic testing.
 */
export type EnvSource = Readonly<Record<string, string | undefined>>;

/**
 * Options for defining an env field.
 */
export interface EnvFieldOptions<T> {
  readonly required?: boolean;
  readonly defaultValue?: T;
  readonly secret?: boolean;
}

/**
 * EnvField describes validation and parsing for a single config key.
 *
 * - required: if true and no value present in source, loadConfig fails.
 * - secret: if true, value is redacted in inspection helpers and never
 *           appears in error messages.
 * - defaultValue: used when key is missing and not required.
 * - parse: converts raw string -> T, should throw on invalid.
 */
export interface EnvField<T> {
  readonly required: boolean;
  readonly secret: boolean;
  readonly defaultValue?: T;
  readonly parse: (raw: string) => T;
}

/**
 * EnvSchema maps config keys to EnvField descriptors.
 *
 * Use defineString / defineNumber / defineBoolean / defineEnum to create fields.
 */
export type EnvSchema<T extends Record<string, unknown>> = {
  readonly [K in keyof T]-?: EnvField<NonNullable<T[K]>>;
};

// ---------------------------------------------------------------------------
// Env source isolation
// ---------------------------------------------------------------------------

/**
 * Returns an isolated EnvSource.
 *
 * - If overrides is provided, a shallow copy of it is returned (test isolation).
 * - Otherwise a shallow copy of process.env is returned if available (Node).
 * - In non-Node runtimes (browser), returns an empty record.
 *
 * This is the single controlled boundary for reading environment variables.
 * No other file should access process.env directly.
 */
export function getEnvSource(overrides?: EnvSource): EnvSource {
  if (overrides !== undefined) {
    return { ...overrides };
  }
  const maybeProcess = (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process;
  if (maybeProcess?.env) {
    return { ...maybeProcess.env };
  }
  return {};
}

// ---------------------------------------------------------------------------
// Field factories — deterministic, no silent coercion
// ---------------------------------------------------------------------------

function isRequiredByDefault<T>(options: EnvFieldOptions<T>): boolean {
  if (options.required === true) return true;
  if (options.required === false) return false;
  if (options.defaultValue !== undefined) return false;
  return true;
}

/**
 * Defines a string field.
 *
 * Validation: any string is accepted as-is. Missing required values fail.
 * Empty string is considered present (not missing).
 */
export function defineString(
  options: EnvFieldOptions<string> = {}
): EnvField<string> {
  const isRequired = isRequiredByDefault(options);
  return {
    required: isRequired,
    secret: options.secret ?? false,
    defaultValue: options.defaultValue,
    parse: (raw: string) => raw,
  };
}

/**
 * Defines a number field.
 *
 * Parsing is strict: trims whitespace, then Number(raw). Rejects NaN,
 * Infinity, -Infinity, and empty string. Does NOT silently coerce "abc" -> 0.
 */
export function defineNumber(
  options: EnvFieldOptions<number> = {}
): EnvField<number> {
  const isRequired = isRequiredByDefault(options);
  return {
    required: isRequired,
    secret: options.secret ?? false,
    defaultValue: options.defaultValue,
    parse: (raw: string) => {
      if (typeof raw !== "string") {
        throw new Error("expected a string value");
      }
      const trimmed = raw.trim();
      if (trimmed === "") {
        throw new Error("expected a valid number, received empty string");
      }
      const num = Number(trimmed);
      if (Number.isNaN(num) || !Number.isFinite(num)) {
        throw new Error("expected a valid finite number");
      }
      return num;
    },
  };
}

/**
 * Defines a boolean field.
 *
 * Accepted (case-insensitive, trimmed):
 *   true  -> true:  "true", "1", "yes", "on"
 *   false -> false: "false", "0", "no", "off"
 *
 * Any other value is rejected deterministically.
 */
export function defineBoolean(
  options: EnvFieldOptions<boolean> = {}
): EnvField<boolean> {
  const isRequired = isRequiredByDefault(options);
  return {
    required: isRequired,
    secret: options.secret ?? false,
    defaultValue: options.defaultValue,
    parse: (raw: string) => {
      if (typeof raw !== "string") {
        throw new Error("expected a string value");
      }
      const normalized = raw.trim().toLowerCase();
      if (
        normalized === "true" ||
        normalized === "1" ||
        normalized === "yes" ||
        normalized === "on"
      ) {
        return true;
      }
      if (
        normalized === "false" ||
        normalized === "0" ||
        normalized === "no" ||
        normalized === "off"
      ) {
        return false;
      }
      throw new Error("expected boolean (true/false, 1/0, yes/no, on/off)");
    },
  };
}

/**
 * Defines an enum field with explicit allowed values.
 *
 * Parsing is exact string match (case-sensitive). No coercion.
 * Whitespace is not trimmed for enums to keep exact-match semantics;
 * if trimming is desired, consumers should trim before defining values.
 */
export function defineEnum<T extends string>(
  values: readonly T[],
  options: EnvFieldOptions<T> = {}
): EnvField<T> {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("defineEnum requires a non-empty values array");
  }
  const isRequired = isRequiredByDefault(options);
  return {
    required: isRequired,
    secret: options.secret ?? false,
    defaultValue: options.defaultValue,
    parse: (raw: string) => {
      if (typeof raw !== "string") {
        throw new Error("expected a string value");
      }
      if ((values as readonly string[]).includes(raw)) {
        return raw as T;
      }
      throw new Error(`expected one of: ${values.join(", ")}`);
    },
  };
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * Loads and validates config from an EnvSource against a schema.
 *
 * Behavior:
 * - If a key's raw value is undefined or null (missing), then:
 *    - if field.required === true -> Result err (ConfigError)
 *    - else if field.defaultValue !== undefined -> use defaultValue
 *    - else -> set value to undefined (optional without default)
 * - If raw value is present but not a string, returns deterministic ConfigError
 *   (secret fields use generic message).
 * - If raw value is present string (even ""), parse() is invoked.
 *   Parse failures produce a ConfigError with a deterministic message.
 *   For secret fields, the message is generic and never includes the raw value.
 *
 * The operation is pure with respect to the source argument and does not
 * mutate process.env.
 */
export function loadConfig<T extends Record<string, unknown>>(
  schema: EnvSchema<T>,
  source?: EnvSource
): Result<T, ConfigError> {
  const env = getEnvSource(source);
  const config: Record<string, unknown> = {};

  for (const key of Object.keys(schema) as (keyof T)[]) {
    const field = schema[key];
    const raw = (env as Record<string, unknown>)[key as string];

    // Treat undefined and null as missing
    if (raw === undefined || raw === null) {
      if (field.required) {
        return err(
          new ConfigError(`Missing required configuration: ${String(key)}`, {
            details: { field: String(key) },
          })
        );
      }
      if (field.defaultValue !== undefined) {
        config[key as string] = field.defaultValue;
      } else {
        config[key as string] = undefined;
      }
      continue;
    }

    if (typeof raw !== "string") {
      const message = field.secret
        ? `Invalid configuration for ${String(key)}: validation failed`
        : `Invalid configuration for ${String(key)}: expected a string value`;
      return err(
        new ConfigError(message, {
          details: { field: String(key) },
        })
      );
    }

    try {
      const parsed = field.parse(raw);
      config[key as string] = parsed;
    } catch (cause) {
      const message = field.secret
        ? `Invalid configuration for ${String(key)}: validation failed`
        : cause instanceof Error
          ? `Invalid configuration for ${String(key)}: ${cause.message}`
          : `Invalid configuration for ${String(key)}: validation failed`;
      return err(
        new ConfigError(message, {
          cause,
          details: { field: String(key) },
        })
      );
    }
  }

  return ok(config as T);
}

/**
 * Loads config or throws ConfigError. Useful at application startup (fail-fast).
 */
export function loadConfigOrThrow<T extends Record<string, unknown>>(
  schema: EnvSchema<T>,
  source?: EnvSource
): T {
  const result = loadConfig(schema, source);
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}

// ---------------------------------------------------------------------------
// Secret safety
// ---------------------------------------------------------------------------

const REDACTED = "[REDACTED]";

/**
 * Returns a shallow copy of config with secret field values replaced by "[REDACTED]".
 *
 * Never mutates the input config. Keys not marked secret are copied as-is.
 */
export function redactConfig<T extends Record<string, unknown>>(
  config: T,
  schema: EnvSchema<T>
): Record<string, unknown> {
  const redacted: Record<string, unknown> = { ...config };
  for (const key of Object.keys(schema) as (keyof T)[]) {
    const field = schema[key];
    if (field.secret && redacted[key as string] !== undefined) {
      redacted[key as string] = REDACTED;
    }
  }
  return redacted;
}

/**
 * Returns a JSON string of the redacted config for safe logging/inspection.
 * Secret values are never serialized as plain text.
 */
export function toSafeConfigString<T extends Record<string, unknown>>(
  config: T,
  schema: EnvSchema<T>
): string {
  const redacted = redactConfig(config, schema);
  try {
    return JSON.stringify(redacted, null, 2);
  } catch {
    return String(redacted);
  }
}

/**
 * Minimal base schema for framework-level env.
 * Currently only NODE_ENV is included as the genuinely required provider-neutral
 * example. Consumers extend this for their own environment.
 */
export const baseEnvSchema = {
  NODE_ENV: defineEnum(["development", "test", "production"] as const, {
    defaultValue: "development" as const,
  }),
} as const;
