/**
 * @forge/db — platform migration folder tests (V3 §6.5).
 *
 * The platform migration folder must stay in the format the migration runner
 * (drizzle-orm migrator) consumes and must stay in sync with the platform
 * schema definitions in packages/db/src/schema. The folder is deterministic
 * and append-only: existing migrations are never edited after being applied.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

interface JournalEntry {
  readonly idx: number;
  readonly version: string;
  readonly when: number;
  readonly tag: string;
  readonly breakpoints: boolean;
}

function readJournal(): { version: string; dialect: string; entries: JournalEntry[] } {
  return JSON.parse(readFileSync(join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8"));
}

describe("platform migration folder", () => {
  it("is consumable by the drizzle migrator (journal ↔ sql files)", () => {
    const journal = readJournal();
    expect(journal.version).toBe("7");
    expect(journal.dialect).toBe("postgresql");
    expect(journal.entries.length).toBeGreaterThan(0);
    const sqlFiles = readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith(".sql"));
    for (const entry of journal.entries) {
      expect(sqlFiles, `missing ${entry.tag}.sql`).toContain(`${entry.tag}.sql`);
    }
  });

  it("orders entries deterministically", () => {
    const entries = readJournal().entries;
    const seen = new Set<number>();
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index] as JournalEntry;
      expect(entry.idx).toBe(index);
      expect(seen.has(entry.when)).toBe(false);
      seen.add(entry.when);
      if (index > 0) {
        expect(entry.when).toBeGreaterThan((entries[index - 1] as JournalEntry).when);
      }
    }
  });

  it("creates the platform schema with all seven shared tables", () => {
    const journal = readJournal();
    const sql = journal.entries
      .map((entry) => readFileSync(join(MIGRATIONS_DIR, `${entry.tag}.sql`), "utf8"))
      .join("\n");
    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS "platform"');
    for (const table of [
      "products",
      "users",
      "organizations",
      "organization_members",
      "subscriptions",
      "usage_records",
      "audit_events",
    ]) {
      expect(sql).toContain(`CREATE TABLE "platform"."${table}"`);
    }
  });

  it("enforces the P20 invariant: product_id NOT NULL FK on usage_records and audit_events", () => {
    const journal = readJournal();
    const sql = journal.entries
      .map((entry) => readFileSync(join(MIGRATIONS_DIR, `${entry.tag}.sql`), "utf8"))
      .join("\n");
    for (const table of ["usage_records", "audit_events"]) {
      expect(sql).toContain(`CREATE TABLE "platform"."${table}"`);
      expect(sql).toContain('"product_id" uuid NOT NULL');
      expect(sql).toContain(
        `ALTER TABLE "platform"."${table}" ADD CONSTRAINT "${table}_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "platform"."products"("id") ON DELETE cascade`,
      );
    }
  });

  it("splits statements with the migrator's breakpoint marker", () => {
    const journal = readJournal();
    const sql = journal.entries
      .map((entry) => readFileSync(join(MIGRATIONS_DIR, `${entry.tag}.sql`), "utf8"))
      .join("\n");
    const statements = sql.split("--> statement-breakpoint");
    expect(statements.length).toBeGreaterThan(10);
    for (const statement of statements) {
      expect(statement.trim().length).toBeGreaterThan(0);
    }
  });
});
