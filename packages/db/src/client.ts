/**
 * @forge/db client — Drizzle + postgres.js factory (V3 §6.1, P7).
 *
 * Application → Drizzle → PostgreSQL (postgres.js driver).
 * Connectivity is via DATABASE_URL only (no vendor SDK per P5).
 * Provider-neutral: accepts a connection string, does not read process.env.
 *
 * No generic database abstraction (P7).
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";
import { AppError } from "@forge/shared";

// Re-export schema for convenience (so callers can `import { users } from "@forge/db"`)
export * from "./schema/index.js";

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class DbConnectionError extends AppError {
  constructor(message: string, options?: { cause?: unknown; details?: unknown }) {
    super(message, {
      code: "DB_CONNECTION_ERROR",
      cause: options?.cause,
      details: options?.details,
    });
    this.name = "DbConnectionError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isDbConnectionError(error: unknown): error is DbConnectionError {
  return error instanceof DbConnectionError;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DbClient = PostgresJsDatabase<typeof schema>;

export interface CreateDbOptions {
  /**
   * Maximum number of connections in the pool. Defaults to 10.
   * Passed to postgres.js `max` option.
   */
  max?: number;
  /**
   * Whether to prepare statements. postgres.js default is true, but Drizzle
   * with postgres.js requires `prepare: false` for transaction compatibility
   * when using certain pgBouncer modes. Defaults to false.
   */
  prepare?: boolean;
  /**
   * Idle timeout in seconds. Defaults to 30.
   */
  idleTimeout?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a Drizzle client backed by postgres.js.
 *
 * - Validates connectionString is a non-empty string (does not log/redact it).
 * - Does NOT read process.env — caller passes the URL explicitly (provider-neutral).
 * - Returns a `PostgresJsDatabase` typed with the platform schema.
 *
 * The caller is responsible for closing the underlying postgres connection via
 * `await getPostgresClient(db).end()` or by retaining the postgres client
 * themselves if they need lifecycle control. For test isolation, use
 * `createDb` per test and `await closeDb(db)`.
 *
 * @param connectionString — PostgreSQL connection URL (e.g., `postgres://...` or `postgresql://...`). Never logged.
 * @throws DbConnectionError on invalid input or driver failure (message never contains the raw URL).
 */
export function createDb(
  connectionString: string,
  options: CreateDbOptions = {},
): DbClient {
  if (typeof connectionString !== "string" || connectionString.trim().length === 0) {
    throw new DbConnectionError("Invalid connectionString: expected a non-empty string", {
      details: { field: "connectionString" },
    });
  }

  // Do NOT include the raw string in error messages (secret safety)
  const trimmed = connectionString.trim();

  // Basic scheme check without leaking the value — accept postgres:// and postgresql://
  const hasValidScheme =
    trimmed.startsWith("postgres://") || trimmed.startsWith("postgresql://");
  if (!hasValidScheme) {
    throw new DbConnectionError(
      "Invalid connectionString: expected a postgres:// or postgresql:// URL",
      { details: { field: "connectionString" } },
    );
  }

  try {
    const sql = postgres(trimmed, {
      max: options.max ?? 10,
      idle_timeout: options.idleTimeout ?? 30,
      prepare: options.prepare ?? false,
      // Transform undefined to keep postgres.js defaults for other options
    });

    const db = drizzle(sql, { schema });
    return db;
  } catch (cause) {
    // Never include trimmed URL in message
    throw new DbConnectionError("Failed to create database client", {
      cause,
    });
  }
}

/**
 * Closes the underlying postgres.js client for a Drizzle instance.
 *
 * This is a best-effort helper for tests. If the Drizzle instance does not
 * expose a known close handle, it is a no-op. The underlying `postgres` client
 * is available via `db.$client` in drizzle-orm/postgres-js (typed as `Sql`).
 */
export async function closeDb(db: DbClient): Promise<void> {
  // drizzle-orm's PostgresJsDatabase exposes the raw postgres client as `$client`
  const maybe = db as unknown as { $client?: { end?: () => Promise<void> } };
  if (maybe.$client && typeof maybe.$client.end === "function") {
    await maybe.$client.end();
  }
}
