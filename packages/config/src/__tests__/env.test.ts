import { describe, expect, it } from "vitest";
import {
  defineBoolean,
  defineEnum,
  defineNumber,
  defineString,
  getEnvSource,
  loadConfig,
  loadConfigOrThrow,
  redactConfig,
  toSafeConfigString,
} from "../env.js";
import type { EnvSource } from "../env.js";
import { ConfigError } from "../errors.js";

describe("env — configuration kernel", () => {
  describe("valid required configuration", () => {
    it("loads required string and number fields when present", () => {
      const schema = {
        API_URL: defineString({ required: true }),
        PORT: defineNumber({ required: true }),
      } as const;

      const source = {
        API_URL: "https://example.com",
        PORT: "3000",
      };

      const result = loadConfig(schema, source);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.API_URL).toBe("https://example.com");
        expect(result.value.PORT).toBe(3000);
      }
    });

    it("loadConfigOrThrow returns typed config on success", () => {
      const schema = {
        HOST: defineString({ required: true }),
      } as const;
      const source = { HOST: "localhost" };
      const config = loadConfigOrThrow(schema, source);
      expect(config.HOST).toBe("localhost");
    });
  });

  describe("missing required configuration", () => {
    it("fails when required field is missing", () => {
      const schema = {
        DATABASE_URL: defineString({ required: true }),
      } as const;

      const result = loadConfig(schema, {});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ConfigError);
        expect(result.error.code).toBe("CONFIG_ERROR");
        expect(result.error.message).toMatch(/Missing required configuration: DATABASE_URL/);
        // details should contain field but not secret value
        expect(result.error.details).toEqual({ field: "DATABASE_URL" });
      }
    });

    it("loadConfigOrThrow throws ConfigError when required missing", () => {
      const schema = {
        REQUIRED: defineString({ required: true }),
      } as const;
      expect(() => loadConfigOrThrow(schema, {})).toThrow(ConfigError);
    });

    it("fails with deterministic message and does not leak secret value", () => {
      const schema = {
        SECRET_TOKEN: defineString({ required: true, secret: true }),
      } as const;
      const result = loadConfig(schema, {});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Missing required configuration: SECRET_TOKEN");
        expect(result.error.message).not.toContain("super-secret");
      }
    });
  });

  describe("optional configuration", () => {
    it("returns undefined for optional field when not present", () => {
      const schema = {
        OPTIONAL_URL: defineString({ required: false }),
      } as const;
      const result = loadConfig(schema, {});
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.OPTIONAL_URL).toBeUndefined();
      }
    });

    it("returns value when optional field is present", () => {
      const schema = {
        OPTIONAL_URL: defineString({ required: false }),
      } as const;
      const source = { OPTIONAL_URL: "https://optional.com" };
      const result = loadConfig(schema, source);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.OPTIONAL_URL).toBe("https://optional.com");
      }
    });

    it("allows optional boolean without default", () => {
      const schema = {
        FEATURE_ENABLED: defineBoolean({ required: false }),
      } as const;
      const result = loadConfig(schema, {});
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.FEATURE_ENABLED).toBeUndefined();
      }
    });
  });

  describe("default values", () => {
    it("uses default when field is missing and defaultValue is provided", () => {
      const schema = {
        PORT: defineNumber({ defaultValue: 3000 }),
        NODE_ENV: defineEnum(["development", "production"] as const, {
          defaultValue: "development" as const,
        }),
      } as const;

      const result = loadConfig(schema, {});
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.PORT).toBe(3000);
        expect(result.value.NODE_ENV).toBe("development");
      }
    });

    it("prefers provided value over default", () => {
      const schema = {
        PORT: defineNumber({ defaultValue: 3000 }),
      } as const;
      const source = { PORT: "8080" };
      const result = loadConfig(schema, source);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.PORT).toBe(8080);
      }
    });

    it("uses default for string with secret flag", () => {
      const schema = {
        LOG_LEVEL: defineEnum(["debug", "info"] as const, {
          defaultValue: "info" as const,
        }),
      } as const;
      const result = loadConfig(schema, {});
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.LOG_LEVEL).toBe("info");
      }
    });
  });

  describe("invalid configuration values", () => {
    it("fails when number field receives non-numeric string", () => {
      const schema = {
        PORT: defineNumber({ required: true }),
      } as const;
      const source = { PORT: "abc" };
      const result = loadConfig(schema, source);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toMatch(/Invalid configuration for PORT/);
        expect(result.error.details).toEqual({ field: "PORT" });
      }
    });

    it("fails when boolean field receives invalid value", () => {
      const schema = {
        ENABLED: defineBoolean({ required: true }),
      } as const;
      const source = { ENABLED: "maybe" };
      const result = loadConfig(schema, source);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toMatch(/Invalid configuration for ENABLED/);
      }
    });

    it("fails when enum field receives value not in allowed set", () => {
      const schema = {
        NODE_ENV: defineEnum(["development", "test", "production"] as const, {
          required: true,
        }),
      } as const;
      const source = { NODE_ENV: "staging" };
      const result = loadConfig(schema, source);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toMatch(/Invalid configuration for NODE_ENV/);
        expect(result.error.message).toMatch(/expected one of/);
      }
    });

    it("does not include secret raw value in error message", () => {
      // Even though string field accepts anything, test with number field secret invalid
      const numSchema = {
        SECRET_PORT: defineNumber({ required: true, secret: true }),
      } as const;
      const result = loadConfig(numSchema, { SECRET_PORT: "not-a-number" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Invalid configuration for SECRET_PORT: validation failed");
        expect(result.error.message).not.toContain("not-a-number");
      }
    });

    it("rejects empty string for number field", () => {
      const schema = {
        PORT: defineNumber({ required: true }),
      } as const;
      const result = loadConfig(schema, { PORT: "" });
      expect(result.ok).toBe(false);
    });
  });

  describe("type conversion", () => {
    it("converts numeric string to number without silent coercion", () => {
      const schema = {
        PORT: defineNumber({ required: true }),
        RETRY_COUNT: defineNumber({ required: true }),
      } as const;
      const source = { PORT: "3000", RETRY_COUNT: "42" };
      const result = loadConfig(schema, source);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.PORT).toBe(3000);
        expect(typeof result.value.PORT).toBe("number");
        expect(result.value.RETRY_COUNT).toBe(42);
      }
    });

    it("converts boolean strings to booleans", () => {
      const schema = {
        ENABLED_TRUE: defineBoolean({ required: true }),
        ENABLED_FALSE: defineBoolean({ required: true }),
        ENABLED_ONE: defineBoolean({ required: true }),
        ENABLED_ZERO: defineBoolean({ required: true }),
      } as const;
      const source = {
        ENABLED_TRUE: "true",
        ENABLED_FALSE: "false",
        ENABLED_ONE: "1",
        ENABLED_ZERO: "0",
      };
      const result = loadConfig(schema, source);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.ENABLED_TRUE).toBe(true);
        expect(result.value.ENABLED_FALSE).toBe(false);
        expect(result.value.ENABLED_ONE).toBe(true);
        expect(result.value.ENABLED_ZERO).toBe(false);
      }
    });

    it("handles case-insensitive booleans", () => {
      const schema = {
        FLAG: defineBoolean({ required: true }),
      } as const;
      expect(loadConfig(schema, { FLAG: "TRUE" }).ok).toBe(true);
      expect(loadConfig(schema, { FLAG: "False" }).ok).toBe(true);
      expect(loadConfig(schema, { FLAG: "YES" }).ok).toBe(true);
      expect(loadConfig(schema, { FLAG: "No" }).ok).toBe(true);
    });

    it("does not silently convert invalid number to 0", () => {
      const schema = {
        PORT: defineNumber({ required: true }),
      } as const;
      const result = loadConfig(schema, { PORT: "abc" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        // ensure not 0
        expect(result.error).toBeInstanceOf(ConfigError);
      }
      // Also check that "0" is valid and returns 0, not error
      const validZero = loadConfig(schema, { PORT: "0" });
      expect(validZero.ok).toBe(true);
      if (validZero.ok) expect(validZero.value.PORT).toBe(0);
    });

    it("keeps string values as strings without coercion", () => {
      const schema = {
        COUNT: defineString({ required: true }),
      } as const;
      const source = { COUNT: "42" };
      const result = loadConfig(schema, source);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.COUNT).toBe("42");
        expect(typeof result.value.COUNT).toBe("string");
      }
    });
  });

  describe("secret redaction", () => {
    it("redacts secret fields in redacted view", () => {
      const schema = {
        API_KEY: defineString({ required: true, secret: true }),
        PUBLIC_URL: defineString({ required: true }),
        PORT: defineNumber({ required: true }),
      } as const;

      const source = {
        API_KEY: "super-secret-value",
        PUBLIC_URL: "https://example.com",
        PORT: "3000",
      };

      const result = loadConfig(schema, source);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const redacted = redactConfig(result.value, schema);
      expect(redacted.API_KEY).toBe("[REDACTED]");
      expect(redacted.PUBLIC_URL).toBe("https://example.com");
      expect(redacted.PORT).toBe(3000);
      // original not mutated
      expect(result.value.API_KEY).toBe("super-secret-value");
    });

    it("toSafeConfigString never includes secret values", () => {
      const schema = {
        SECRET: defineString({ required: true, secret: true }),
        NORMAL: defineString({ required: true }),
      } as const;
      const source = { SECRET: "my-secret-123", NORMAL: "hello" };
      const result = loadConfig(schema, source);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const safe = toSafeConfigString(result.value, schema);
      expect(safe).not.toContain("my-secret-123");
      expect(safe).toContain("[REDACTED]");
      expect(safe).toContain("hello");
    });

    it("redacts multiple secret fields", () => {
      const schema = {
        A: defineString({ required: true, secret: true }),
        B: defineNumber({ required: true, secret: true }),
        C: defineString({ required: true }),
      } as const;
      const source = { A: "secret-a", B: "123", C: "public" };
      const result = loadConfig(schema, source);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const redacted = redactConfig(result.value, schema);
      expect(redacted.A).toBe("[REDACTED]");
      expect(redacted.B).toBe("[REDACTED]");
      expect(redacted.C).toBe("public");
    });

    it("does not redact non-secret fields", () => {
      const schema = {
        PUBLIC: defineString({ required: true }),
      } as const;
      const source = { PUBLIC: "visible" };
      const result = loadConfig(schema, source);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const redacted = redactConfig(result.value, schema);
      expect(redacted.PUBLIC).toBe("visible");
    });
  });

  describe("environment isolation", () => {
    it("isolates tests when source is explicitly provided", () => {
      const schema = {
        VALUE: defineString({ required: true }),
      } as const;

      const resultA = loadConfig(schema, { VALUE: "a" });
      const resultB = loadConfig(schema, { VALUE: "b" });
      expect(resultA.ok && resultA.value.VALUE).toBe("a");
      expect(resultB.ok && resultB.value.VALUE).toBe("b");
      // mutating one source does not affect the other
      const source = { VALUE: "original" };
      const r1 = loadConfig(schema, source);
      source.VALUE = "mutated";
      const r2 = loadConfig(schema, source);
      expect(r1.ok && r1.value.VALUE).toBe("original");
      expect(r2.ok && r2.value.VALUE).toBe("mutated");
    });

    it("getEnvSource returns a copy, not reference to input", () => {
      const original: Record<string, string | undefined> = { KEY: "value" };
      const copy = getEnvSource(original);
      expect(copy).toEqual(original);
      expect(copy).not.toBe(original);
      (copy as Record<string, string | undefined>).KEY = "changed";
      expect(original.KEY).toBe("value");
    });

    it("getEnvSource copies process.env without mutation side-effects", () => {
      const source = getEnvSource({ ISOLATED: "1" });
      expect(source.ISOLATED).toBe("1");
      // Ensure that passing no overrides still returns a copy
      const fromProcess = getEnvSource();
      expect(fromProcess).toBeDefined();
      // Mutating returned object should not affect next call
      (fromProcess as Record<string, string | undefined>).TEST_MUTATION = "x";
      const second = getEnvSource();
      expect(second.TEST_MUTATION).toBeUndefined();
    });

    it("concurrent loads with different sources are independent", () => {
      const schema = {
        FLAG: defineBoolean({ required: true }),
      } as const;
      const rTrue = loadConfig(schema, { FLAG: "true" });
      const rFalse = loadConfig(schema, { FLAG: "false" });
      expect(rTrue.ok && rTrue.value.FLAG).toBe(true);
      expect(rFalse.ok && rFalse.value.FLAG).toBe(false);
    });
  });

  describe("edge cases and deterministic behavior", () => {
    it("handles negative and floating point numbers", () => {
      const schema = {
        NEG: defineNumber({ required: true }),
        FLOAT: defineNumber({ required: true }),
      } as const;
      const source = { NEG: "-42", FLOAT: "3.14" };
      const result = loadConfig(schema, source);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.NEG).toBe(-42);
        expect(result.value.FLOAT).toBe(3.14);
      }
    });

    it("rejects Infinity", () => {
      const schema = {
        VAL: defineNumber({ required: true }),
      } as const;
      const result = loadConfig(schema, { VAL: "Infinity" });
      expect(result.ok).toBe(false);
    });

    it("accepts empty string for string fields but not for number", () => {
      const stringSchema = {
        S: defineString({ required: true }),
      } as const;
      const strResult = loadConfig(stringSchema, { S: "" });
      expect(strResult.ok).toBe(true);
      if (strResult.ok) expect(strResult.value.S).toBe("");

      const numSchema = {
        N: defineNumber({ required: true }),
      } as const;
      const numResult = loadConfig(numSchema, { N: "" });
      expect(numResult.ok).toBe(false);
    });
  });

  describe("required-by-default semantics", () => {
    it("defineString() without options is required and fails when missing", () => {
      const schema = {
        REQUIRED_STR: defineString(),
      } as const;
      const result = loadConfig(schema, {});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toMatch(/Missing required configuration: REQUIRED_STR/);
      }
    });

    it("defineNumber() without options is required", () => {
      const schema = {
        REQUIRED_NUM: defineNumber(),
      } as const;
      const result = loadConfig(schema, {});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toMatch(/Missing required configuration: REQUIRED_NUM/);
      }
    });

    it("defineBoolean() without options is required", () => {
      const schema = {
        REQUIRED_BOOL: defineBoolean(),
      } as const;
      const result = loadConfig(schema, {});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toMatch(/Missing required configuration: REQUIRED_BOOL/);
      }
    });

    it("defineEnum() without options is required", () => {
      const schema = {
        REQUIRED_ENUM: defineEnum(["a", "b"] as const),
      } as const;
      const result = loadConfig(schema, {});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toMatch(/Missing required configuration: REQUIRED_ENUM/);
      }
    });

    it("explicit required:false remains optional", () => {
      const schema = {
        OPTIONAL: defineString({ required: false }),
      } as const;
      const result = loadConfig(schema, {});
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.OPTIONAL).toBeUndefined();
    });

    it("defaultValue makes field optional even though bare is required", () => {
      const schema = {
        WITH_DEFAULT: defineString({ defaultValue: "fallback" }),
      } as const;
      const result = loadConfig(schema, {});
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.WITH_DEFAULT).toBe("fallback");
    });

    it("explicit required:true overrides defaultValue (remains required)", () => {
      const schema = {
        EXPLICIT_REQUIRED: defineString({ required: true, defaultValue: "ignored" }),
      } as const;
      const result = loadConfig(schema, {});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toMatch(/Missing required configuration: EXPLICIT_REQUIRED/);
      }
    });
  });

  describe("null / unknown input safety", () => {
    it("treats null as missing for required field", () => {
      const schema = {
        REQUIRED: defineString({ required: true }),
      } as const;
      const source = { REQUIRED: null } as unknown as EnvSource;
      const result = loadConfig(schema, source);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toMatch(/Missing required configuration: REQUIRED/);
      }
    });

    it("treats null as missing for optional field with default", () => {
      const schema = {
        WITH_DEFAULT: defineNumber({ defaultValue: 99 }),
      } as const;
      const source = { WITH_DEFAULT: null } as unknown as EnvSource;
      const result = loadConfig(schema, source);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.WITH_DEFAULT).toBe(99);
    });

    it("fails deterministically for non-string runtime value on non-secret field", () => {
      const schema = {
        PORT: defineNumber({ required: true }),
      } as const;
      const source = { PORT: 123 as unknown as string } as unknown as EnvSource;
      const result = loadConfig(schema, source);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toMatch(/Invalid configuration for PORT: expected a string value/);
        expect(result.error.details).toEqual({ field: "PORT" });
      }
    });

    it("fails with generic message for non-string runtime value on secret field without leaking raw", () => {
      const schema = {
        SECRET_PORT: defineNumber({ required: true, secret: true }),
      } as const;
      const source = { SECRET_PORT: 12345 as unknown as string } as unknown as EnvSource;
      const result = loadConfig(schema, source);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Invalid configuration for SECRET_PORT: validation failed");
        expect(result.error.message).not.toContain("12345");
      }
    });

    it("rejects object runtime value deterministically", () => {
      const schema = {
        FLAG: defineBoolean({ required: true }),
      } as const;
      const source = { FLAG: { foo: "bar" } as unknown as string } as unknown as EnvSource;
      const result = loadConfig(schema, source);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toMatch(/Invalid configuration for FLAG/);
      }
    });

    it("malformed secret values do not leak raw value in cause", () => {
      const schema = {
        SECRET_BOOL: defineBoolean({ required: true, secret: true }),
      } as const;
      const source = { SECRET_BOOL: "not-a-bool-raw-value" };
      const result = loadConfig(schema, source);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Invalid configuration for SECRET_BOOL: validation failed");
        expect(result.error.message).not.toContain("not-a-bool");
        // cause should not be included in message for secret
      }
    });

    it("null for secret required field is treated as missing, not leaked", () => {
      const schema = {
        SECRET: defineString({ required: true, secret: true }),
      } as const;
      const source = { SECRET: null } as unknown as EnvSource;
      const result = loadConfig(schema, source);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Missing required configuration: SECRET");
      }
    });
  });
});
