/**
 * JWT Scanner — migration folder tests (V3 §6.5).
 *
 * The product migration folder must stay in the format the @forge/db runner
 * (drizzle-orm migrator) consumes: a meta/_journal.json whose entries each
 * reference an existing <tag>.sql file, with statements separated by
 * "--> statement-breakpoint". The folder content is deterministic and
 * append-only.
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

describe("jwt-scanner migration folder", () => {
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

  it("orders entries deterministically (idx and when increase, no duplicates)", () => {
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

  it("creates the jwt_scanner schema, enums, and all four tables", () => {
    const journal = readJournal();
    const sql = journal.entries
      .map((entry) => readFileSync(join(MIGRATIONS_DIR, `${entry.tag}.sql`), "utf8"))
      .join("\n");
    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS "jwt_scanner"');
    expect(sql).toContain(`AS ENUM('${SEVERITY_EXPECTED.join("','")}')`);
    expect(sql).toContain(`AS ENUM('${CATEGORY_EXPECTED.join("','")}')`);
    expect(sql).toContain(`AS ENUM('${JOB_STATUS_EXPECTED.join("','")}')`);
    for (const table of ["projects", "analysis_jobs", "findings", "reports"]) {
      expect(sql).toContain(`CREATE TABLE "jwt_scanner"."${table}"`);
      expect(sql).toContain('"organization_id" uuid NOT NULL');
    }
  });

  it("links product tables to platform.organizations (shared host, P20)", () => {
    const journal = readJournal();
    const sql = journal.entries
      .map((entry) => readFileSync(join(MIGRATIONS_DIR, `${entry.tag}.sql`), "utf8"))
      .join("\n");
    expect(sql).toContain('REFERENCES "platform"."organizations"("id") ON DELETE cascade');
    expect(sql).toContain('REFERENCES "jwt_scanner"."projects"("id") ON DELETE cascade');
    expect(sql).toContain('REFERENCES "jwt_scanner"."analysis_jobs"("id") ON DELETE cascade');
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

// Expected frozen vocabulary — mirrors @forge/domain and the product's types.
const SEVERITY_EXPECTED = ["critical", "high", "medium", "low", "info"];
const CATEGORY_EXPECTED = ["none_alg", "weak_hmac", "alg_confusion", "expired_claim"];
const JOB_STATUS_EXPECTED = ["pending", "running", "completed", "failed", "cancelled"];
