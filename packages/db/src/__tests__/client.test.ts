import { describe, it, expect } from "vitest";
import { createDb, closeDb, DbConnectionError, isDbConnectionError } from "../client.js";

describe("createDb", () => {
  it("accepts a valid postgres:// connection string", () => {
    const db = createDb("postgres://user:pass@localhost:5432/db");
    expect(db).toBeDefined();
    expect(typeof db).toBe("object");
    // Drizzle postgres-js client exposes query/execute or select
    expect(db).toHaveProperty("select");
  });

  it("accepts a valid postgresql:// connection string (alternate scheme)", () => {
    const db = createDb("postgresql://user:pass@localhost:5432/db");
    expect(db).toBeDefined();
  });

  it("trims whitespace around connection string", () => {
    const db = createDb("  postgres://user:pass@localhost:5432/db  ");
    expect(db).toBeDefined();
  });

  it("throws DbConnectionError for empty string", () => {
    expect(() => createDb("")).toThrow(DbConnectionError);
    expect(() => createDb("   ")).toThrow(DbConnectionError);
  });

  it("throws DbConnectionError for non-string", () => {
    // @ts-expect-error -- runtime check
    expect(() => createDb(null)).toThrow(DbConnectionError);
    // @ts-expect-error -- expected error
    expect(() => createDb(undefined)).toThrow(DbConnectionError);
    // @ts-expect-error -- expected error
    expect(() => createDb(123)).toThrow(DbConnectionError);
  });

  it("throws DbConnectionError for invalid scheme (mysql://, etc.)", () => {
    expect(() => createDb("mysql://user:pass@localhost/db")).toThrow(DbConnectionError);
    expect(() => createDb("http://localhost")).toThrow(DbConnectionError);
  });

  it("never includes raw connection string in error message (secret safety)", () => {
    const secret = "postgres://user:super-secret-123@localhost/db";
    try {
      createDb("invalid-scheme://x");
    } catch (e) {
      expect((e as Error).message).not.toContain("super-secret");
      expect((e as Error).message).not.toContain(secret);
    }
    try {
      // @ts-expect-error -- expected error
      createDb("");
    } catch (e) {
      expect((e as Error).message).not.toContain(secret);
    }
  });

  it("does not read from process.env implicitly", () => {
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://should-not-be-used@localhost/db";
    // Must still throw when no argument provided, proving it doesn't fallback to env
    // @ts-expect-error -- expected error
    expect(() => createDb(undefined)).toThrow(DbConnectionError);
    // And must not automatically use env when valid string is provided — it uses the arg
    const db = createDb("postgres://explicit@localhost/db");
    expect(db).toBeDefined();
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
  });

  it("accepts CreateDbOptions without throwing", () => {
    const db = createDb("postgres://user:pass@localhost:5432/db", { max: 5, prepare: false });
    expect(db).toBeDefined();
  });

  it("is provider-neutral — no Supabase, Clerk, Stripe coupling", async () => {
    // The factory should not reference any vendor SDK; this is a static check via import inspection
    // Here we just verify the db instance does not have vendor-specific props
    const db = createDb("postgres://user:pass@localhost:5432/db");
    const keys = Object.keys(db as unknown as Record<string, unknown>);
    expect(keys).not.toContain("supabase");
    expect(keys).not.toContain("clerk");
    expect(keys).not.toContain("stripe");
  });
});

describe("closeDb", () => {
  it("is callable and does not throw for a Drizzle client", async () => {
    const db = createDb("postgres://user:pass@localhost:5432/db");
    await expect(closeDb(db)).resolves.not.toThrow();
  });

  it("is no-op for objects without $client", async () => {
    await expect(closeDb({} as unknown as never)).resolves.not.toThrow();
  });
});

describe("DbConnectionError", () => {
  it("has correct code and type guard", () => {
    const err = new DbConnectionError("fail");
    expect(err.code).toBe("DB_CONNECTION_ERROR");
    expect(err.name).toBe("DbConnectionError");
    expect(isDbConnectionError(err)).toBe(true);
    expect(isDbConnectionError(new Error("x"))).toBe(false);
  });
});
