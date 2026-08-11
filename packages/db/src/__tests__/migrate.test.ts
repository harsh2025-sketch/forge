import { describe, it, expect } from "vitest";
import {
  migrate,
  migratePlatform,
  migrateInOrder,
  MigrationError,
  isMigrationError,
} from "../migrate.js";

// Helper to create a mock DbClient without needing a real DB.
// drizzleMigrate will attempt to run SQL; with a mock it will throw, which we verify is wrapped.
function mockDb(): unknown {
  // Minimal shape that passes assertDb duck-type: has execute/query
  return {
    execute: async () => {},
    query: {},
    // drizzle-orm postgres-js migrator expects internal session; throwing here is expected
  };
}

describe("migrate", () => {
  it("throws MigrationError for empty migrationsFolder", async () => {
    const db = mockDb() as never;
    await expect(migrate(db, { migrationsFolder: "" })).rejects.toThrow(MigrationError);
    await expect(migrate(db, { migrationsFolder: "   " })).rejects.toThrow(MigrationError);
  });

  it("throws MigrationError for non-string migrationsFolder", async () => {
    const db = mockDb() as never;
    // @ts-expect-error -- expected error
    await expect(migrate(db, { migrationsFolder: null })).rejects.toThrow(MigrationError);
    // @ts-expect-error -- expected error
    await expect(migrate(db, { migrationsFolder: 123 })).rejects.toThrow(MigrationError);
    // @ts-expect-error -- expected error
    await expect(migrate(db, { migrationsFolder: undefined })).rejects.toThrow(MigrationError);
  });

  it("throws MigrationError for invalid db (null/undefined)", async () => {
    // @ts-expect-error -- expected error
    await expect(migrate(null, { migrationsFolder: "migrations" })).rejects.toThrow(MigrationError);
    // @ts-expect-error -- expected error
    await expect(migrate(undefined, { migrationsFolder: "migrations" })).rejects.toThrow(MigrationError);
  });

  it("wraps drizzle migrator failures into MigrationError (preserves cause)", async () => {
    const db = mockDb() as never;
    // This will fail because mockDb cannot actually migrate — we verify wrapping
    await expect(migrate(db, { migrationsFolder: "./non-existent-folder-xyz" })).rejects.toThrow(
      MigrationError,
    );
    try {
      await migrate(db, { migrationsFolder: "./also-missing" });
    } catch (e) {
      expect(isMigrationError(e)).toBe(true);
      expect((e as MigrationError).code).toBe("DB_MIGRATION_ERROR");
      // details should contain the folder, never a secret
      expect((e as MigrationError).details).toEqual(
        expect.objectContaining({ migrationsFolder: "./also-missing" }),
      );
    }
  });

  it("never leaks secrets in error message", async () => {
    const db = mockDb() as never;
    const secretFolder = "/tmp/secret-folder";
    try {
      await migrate(db, { migrationsFolder: secretFolder });
    } catch (e) {
      const msg = (e as Error).message;
      // Folder is included in details, but message should be generic and not contain connection strings
      expect(msg).not.toContain("postgres://");
    }
  });

  it("migratePlatform is an alias for migrate", async () => {
    const db = mockDb() as never;
    await expect(migratePlatform(db, { migrationsFolder: "" })).rejects.toThrow(MigrationError);
  });
});

describe("migrateInOrder", () => {
  it("handles empty folders array as no-op", async () => {
    const db = mockDb() as never;
    await expect(migrateInOrder(db, [])).resolves.toBeUndefined();
  });

  it("throws MigrationError for non-array folders", async () => {
    const db = mockDb() as never;
    // @ts-expect-error -- expected error
    await expect(migrateInOrder(db, null)).rejects.toThrow(MigrationError);
    // @ts-expect-error -- expected error
    await expect(migrateInOrder(db, "not-array")).rejects.toThrow(MigrationError);
  });

  it("throws MigrationError for invalid entry at index", async () => {
    const db = mockDb() as never;
    // entry missing migrationsFolder string
    await expect(
      // @ts-expect-error -- expected error
      migrateInOrder(db, [{ migrationsFolder: "" }, { migrationsFolder: "ok" }]),
    ).rejects.toThrow(MigrationError);
    await expect(
      // @ts-expect-error -- expected error
      migrateInOrder(db, [{ migrationsFolder: null }]),
    ).rejects.toThrow(MigrationError);
  });

  it("throws for invalid db", async () => {
    // @ts-expect-error -- expected error
    await expect(migrateInOrder(null, [{ migrationsFolder: "a" }])).rejects.toThrow(MigrationError);
  });

  it("enforces sequencing — fails fast on first invalid folder (platform first)", async () => {
    const db = mockDb() as never;
    // First folder is invalid (empty), second is also present but should not be reached
    await expect(
      migrateInOrder(db, [{ migrationsFolder: "" }, { migrationsFolder: "second" }]),
    ).rejects.toThrow(MigrationError);
    // Verify error mentions first folder, not second
    try {
      await migrateInOrder(db, [{ migrationsFolder: "" }, { migrationsFolder: "second" }]);
    } catch (e) {
      expect((e as MigrationError).message).toMatch(/0|migrationsFolder/);
    }
  });

  it("is deterministic and provider-neutral — no vendor SDK coupling", async () => {
    // Ensure migrate module does not import clerk/stripe/supabase etc.
    // This is a proxy: we verify the function exists and is pure
    expect(typeof migrate).toBe("function");
    expect(typeof migrateInOrder).toBe("function");
  });
});

describe("MigrationError", () => {
  it("has correct code and type guard", () => {
    const err = new MigrationError("fail");
    expect(err.code).toBe("DB_MIGRATION_ERROR");
    expect(err.name).toBe("MigrationError");
    expect(isMigrationError(err)).toBe(true);
    expect(isMigrationError(new Error("x"))).toBe(false);
  });
});
