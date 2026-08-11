/**
 * JWT Scanner database client (V3 §6.1, P7).
 *
 * The product connects through @forge/db's `createDb` — the connection string
 * is the infrastructure boundary, there is no database adapter (frozen
 * principle P7). The connection string comes from DATABASE_URL and is
 * validated with the @forge/config env schema; the raw value is never logged.
 *
 * `getDb()` is lazy so that modules which import this file (server actions,
 * pages) never fail at import time when DATABASE_URL is absent — the error is
 * raised only when the database is actually needed (e.g. DATA_MODE=memory
 * never touches it).
 */

import { closeDb, createDb, type DbClient } from "@forge/db";
import { defineString, loadConfig } from "@forge/config";

let cached: DbClient | undefined;

/** Returns the lazily-created product database client. Throws when DATABASE_URL is missing or invalid. */
export function getDb(): DbClient {
  if (cached !== undefined) {
    return cached;
  }
  const config = loadConfig({
    DATABASE_URL: defineString({ required: true, secret: true }),
  });
  if (!config.ok) {
    throw new Error(
      "Database access requires DATABASE_URL. Set the connection string or run with DATA_MODE=memory for local/test runs.",
    );
  }
  cached = createDb(config.value.DATABASE_URL);
  return cached;
}

/** Closes the pooled client when one has been created (used by tests and tooling). */
export async function closeProductDb(): Promise<void> {
  if (cached === undefined) return;
  await closeDb(cached);
  cached = undefined;
}
