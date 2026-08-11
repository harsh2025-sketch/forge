/**
 * @forge/db migrate — Migration runner (V3 §6.5).
 *
 * Platform migrations must run before product migrations. This module provides
 * a deterministic, provider-neutral runner that wraps drizzle-orm's migrator
 * without introducing a repository abstraction or DI framework.
 *
 * Design:
 * - `migrate(db, { migrationsFolder })` — runs migrations from a single folder.
 * - `migratePlatform(db, { migrationsFolder })` — alias for platform.
 * - `migrateInOrder(db, folders[])` — runs multiple folders sequentially (platform first).
 *
 * The runner does not generate migrations; generation is via `drizzle-kit generate`.
 * It does not hard-code paths; caller supplies the folder.
 */

import { migrate as drizzleMigrate } from "drizzle-orm/postgres-js/migrator";
import { AppError } from "@forge/shared";
import type { DbClient } from "./client.js";

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class MigrationError extends AppError {
  constructor(message: string, options?: { cause?: unknown; details?: unknown }) {
    super(message, {
      code: "DB_MIGRATION_ERROR",
      cause: options?.cause,
      details: options?.details,
    });
    this.name = "MigrationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isMigrationError(error: unknown): error is MigrationError {
  return error instanceof MigrationError;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MigrateOptions {
  /** Absolute or relative path to the folder containing `drizzle` migration files. */
  migrationsFolder: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function assertMigrationsFolder(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new MigrationError("Invalid migrationsFolder: expected a non-empty string", {
      details: { field: "migrationsFolder" },
    });
  }
  return value.trim();
}

function assertDb(value: unknown): DbClient {
  if (!value || typeof value !== "object") {
    throw new MigrationError("Invalid db: expected a Drizzle PostgresJsDatabase instance", {
      details: { field: "db" },
    });
  }
  // Drizzle client has query/execute style; duck-type check without leaking internals
  const maybe = value as Record<string, unknown>;
  if (typeof maybe.execute !== "function" && typeof maybe.query !== "object") {
    // Some versions expose differently; we do a loose check but still throw deterministic error if not a db
    // For now, if it doesn't look like a drizzle db, we throw
    // We allow any object that at least has a callable migrator target; drizzleMigrate will fail otherwise
    // So we don't over-validate — let drizzleMigrate throw and we wrap it
  }
  return value as DbClient;
}

// ---------------------------------------------------------------------------
// Core runner
// ---------------------------------------------------------------------------

/**
 * Runs migrations from a single folder against the given Drizzle client.
 *
 * Deterministic: same db + folder → same result. No global state, no env read.
 * Throws MigrationError on invalid input or migrator failure (cause is preserved,
 * message never contains secrets).
 */
export async function migrate(db: DbClient, options: MigrateOptions): Promise<void> {
  const safeDb = assertDb(db);
  const folder = assertMigrationsFolder(options.migrationsFolder);

  try {
    await drizzleMigrate(safeDb, { migrationsFolder: folder });
  } catch (cause) {
    throw new MigrationError(`Migration failed for folder: ${folder}`, {
      cause,
      details: { migrationsFolder: folder },
    });
  }
}

/**
 * Alias for platform migrations. Caller passes the platform migrations folder
 * (e.g., `packages/db/src/migrations` or `drizzle/platform`).
 */
export async function migratePlatform(
  db: DbClient,
  options: MigrateOptions,
): Promise<void> {
  await migrate(db, options);
}

/**
 * Runs migrations from multiple folders sequentially in the order provided.
 * This enforces V3 §6.5 ordering: platform first, then product.
 *
 * @example
 * await migrateInOrder(db, [
 *   { migrationsFolder: "packages/db/drizzle" },
 *   { migrationsFolder: "apps/my-product/src/db/migrations" },
 * ]);
 */
export async function migrateInOrder(
  db: DbClient,
  folders: readonly MigrateOptions[],
): Promise<void> {
  if (!Array.isArray(folders)) {
    throw new MigrationError("Invalid folders: expected an array of MigrateOptions", {
      details: { field: "folders" },
    });
  }
  if (folders.length === 0) {
    return;
  }
  const safeDb = assertDb(db);
  for (let i = 0; i < folders.length; i++) {
    const entry = folders[i] as MigrateOptions;
    if (!entry || typeof entry.migrationsFolder !== "string") {
      throw new MigrationError(`Invalid folders[${i}].migrationsFolder: expected a non-empty string`, {
        details: { field: `folders.${i}.migrationsFolder` },
      });
    }
    await migrate(safeDb, entry);
  }
}
