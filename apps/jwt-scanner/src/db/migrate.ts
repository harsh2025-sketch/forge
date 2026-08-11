/**
 * JWT Scanner migration runner — V3 §6.5.
 *
 * Execution order is deterministic and matches the frozen architecture:
 *   1. platform migrations (packages/db/src/migrations — shared schema)
 *   2. product migrations (apps/jwt-scanner/src/db/migrations)
 *
 * The runner reuses @forge/db's migrateInOrder; it does not re-implement
 * migration mechanics. The connection string comes from DATABASE_URL and is
 * validated with the @forge/config env schema (secret values are never
 * logged or included in error messages).
 *
 * Usage:
 *   DATABASE_URL=postgres://... pnpm --filter jwt-scanner db:migrate
 */

import { fileURLToPath } from "node:url";
import { createDb, closeDb, migrateInOrder } from "@forge/db";
import { defineString, loadConfig } from "@forge/config";

const DATABASE_URL_SCHEMA = {
  DATABASE_URL: defineString({ required: true, secret: true }),
};

/**
 * Resolves the two migration folders relative to this module so the runner
 * works regardless of the process working directory. `tsc` compiles this
 * file to dist/db/migrate.js; the SQL folders are referenced from the source
 * tree (tsc does not copy .sql files into dist).
 */
function migrationFolders(importMetaUrl: string): { platform: string; product: string } {
  const compiledDir = fileURLToPath(new URL(".", importMetaUrl));
  // dist/db/ -> repo root (platform migrations live in packages/db/src/migrations)
  const repositoryRoot = fileURLToPath(new URL("../../../../", importMetaUrl));
  return {
    platform: `${repositoryRoot}packages/db/src/migrations`,
    product: `${compiledDir}../../src/db/migrations`,
  };
}

export async function runMigrations(importMetaUrl: string): Promise<void> {
  const config = loadConfig(DATABASE_URL_SCHEMA);
  if (!config.ok) {
    throw new Error(`db:migrate requires DATABASE_URL (${config.error.message})`);
  }
  const { platform, product } = migrationFolders(importMetaUrl);
  const db = createDb(config.value.DATABASE_URL);
  try {
    await migrateInOrder(db, [
      { migrationsFolder: platform },
      { migrationsFolder: product },
    ]);
  } finally {
    await closeDb(db);
  }
}

// Direct execution: `node dist/db/migrate.js`
if (process.argv[1] !== undefined && process.argv[1].endsWith("migrate.js")) {
  runMigrations(import.meta.url)
    .then(() => {
      console.log("Migrations applied: platform + jwt_scanner.");
    })
    .catch((error: unknown) => {
      console.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });
}
