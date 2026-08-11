/**
 * @forge/db — Database layer barrel (V3 §6, P7, P8, P20).
 *
 * Application → Drizzle → PostgreSQL (postgres.js).
 * Named schema: `platform`. P20 invariant: usage_records + audit_events carry
 * product_id NOT NULL FK → products.id.
 */

// Client factory (provider-neutral — takes connection string, no process.env)
export {
  createDb,
  closeDb,
  DbConnectionError,
  isDbConnectionError,
} from "./client.js";
export type { DbClient, CreateDbOptions } from "./client.js";

// Helpers (typed, deterministic, no global state)
export {
  withOrg,
  withProduct,
  toOrgFilter,
  toProductFilter,
  DbError,
  isDbError,
} from "./helpers.js";

// Migration runner (V3 §6.5 — platform first, then product)
export {
  migrate,
  migratePlatform,
  migrateInOrder,
  MigrationError,
  isMigrationError,
} from "./migrate.js";
export type { MigrateOptions } from "./migrate.js";

// Platform schema — re-export for typed queries
export * from "./schema/index.js";

// The `platform` pgSchema itself is exported from schema/products.ts
// (import { platform } from "@forge/db" if needed for custom tables)
