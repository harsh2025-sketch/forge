/**
 * Provider & infrastructure neutrality guard for @forge/db.
 *
 * Enforces V3 §4.1, P7, and .ai/boundaries.md:
 * packages/db → @forge/shared + drizzle-orm + postgres ONLY.
 *
 * Forbidden: @forge/domain, @forge/config, any port, any adapter, Next.js,
 * React, Supabase SDK, Clerk, Stripe, Resend, PostHog, Redis, BullMQ, pg-boss,
 * any other vendor SDK. Also ensures postgres is only here (not in ports).
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = dirname(TESTS_DIR);
const PACKAGE_DIR = dirname(SRC_DIR);

const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\bfrom\s+["']@forge\/domain["']/,
  /\bfrom\s+["']@forge\/config["']/,
  /\bfrom\s+["']@forge\/auth["']/,
  /\bfrom\s+["']@forge\/billing["']/,
  /\bfrom\s+["']@forge\/email["']/,
  /\bfrom\s+["']@forge\/analytics["']/,
  /\bfrom\s+["']@forge\/jobs["']/,
  /\bfrom\s+["']@forge\/storage["']/,
  /\bfrom\s+["']@forge\/ai-provider["']/,
  /\bfrom\s+["']@forge\/ui["']/,
  /\bfrom\s+["']@forge\/testing["']/,
  // Adapter packages — only apps/*/src/providers.ts may import these
  /packages\/adapters\//,
  /@forge\/adapter-/,
  // Framework / vendor SDKs that must never appear in db layer (except allowed drizzle-orm/postgres)
  /\bfrom\s+["']next["']/,
  /\bfrom\s+["']next\/[^"']*["']/,
  /["']react["']/,
  /\bclerk\b/i,
  /\bstripe\b/i,
  /\bresend\b/i,
  /\bposthog\b/i,
  /\bsupabase\b/i, // Supabase SDK is forbidden; connection is via postgres:// only
  /\brediss?\b/i,
  /\bbullmq\b/i,
  /\bpg-boss\b/i,
  /\bopenai\b/i,
  /\banthropic\b/i,
  /\baws-sdk\b/i,
  /\bBedrock\b/i,
  // Repository / generic abstractions forbidden by TASK 005
  /\bIDatabaseAdapter\b/,
  /\bIGenericDatabase\b/,
  /\bBaseRepository\b/,
];

const ALLOWED_SPECIFIERS: readonly (string | RegExp)[] = [
  "@forge/shared",
  /^drizzle-orm(\/.*)?$/,
  "postgres",
  // Node built-ins
  /^node:.*/,
  // Relative imports
  /^\.\.?\/.*/,
];

const ALLOWED_DEPS = ["@forge/shared", "drizzle-orm", "postgres"] as const;
const ALLOWED_DEV_DEPS = ["typescript", "vitest"] as const;

function listSourceFiles(dir: string): readonly string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__") continue;
      files.push(...listSourceFiles(full));
      continue;
    }
    if (entry.endsWith(".ts")) files.push(full);
  }
  return files;
}

function readImportSpecifiers(source: string): readonly string[] {
  const specs: string[] = [];
  const importPattern = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+["']([^"']+)["']/g;
  const sideEffectPattern = /(?:^|\n)\s*import\s+["']([^"']+)["']/g;
  for (const m of source.matchAll(importPattern)) specs.push(m[1]);
  for (const m of source.matchAll(sideEffectPattern)) specs.push(m[1]);
  return specs;
}

const sourceFiles = listSourceFiles(SRC_DIR);
const manifest = JSON.parse(readFileSync(join(PACKAGE_DIR, "package.json"), "utf8")) as {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

describe("db package neutrality", () => {
  it("ships required source files", () => {
    const rel = sourceFiles.map((f) => relative(SRC_DIR, f));
    expect(rel).toContain("client.ts");
    expect(rel).toContain("helpers.ts");
    expect(rel).toContain("migrate.ts");
    expect(rel).toContain("index.ts");
    expect(rel).toContain(join("schema", "index.ts"));
    expect(rel).toContain(join("schema", "products.ts"));
    expect(rel).toContain(join("schema", "users.ts"));
    expect(rel).toContain(join("schema", "organizations.ts"));
    expect(rel).toContain(join("schema", "members.ts"));
    expect(rel).toContain(join("schema", "subscriptions.ts"));
    expect(rel).toContain(join("schema", "usage-records.ts"));
    expect(rel).toContain(join("schema", "audit-events.ts"));
  });

  it("does not import forbidden modules (domain/config/ports/adapters/frameworks/vendors)", () => {
    const violations: string[] = [];
    for (const file of sourceFiles) {
      const src = readFileSync(file, "utf8");
      for (const pat of FORBIDDEN_PATTERNS) {
        if (pat.test(src)) {
          violations.push(`${relative(PACKAGE_DIR, file)} matches ${String(pat)} — snippet: ${src.slice(src.search(pat) - 20, src.search(pat) + 80).replace(/\n/g, "\\n")}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("imports only allowed specifiers (shared, drizzle-orm, postgres, node:, relative)", () => {
    const violations: string[] = [];
    for (const file of sourceFiles) {
      const src = readFileSync(file, "utf8");
      for (const spec of readImportSpecifiers(src)) {
        const allowed = ALLOWED_SPECIFIERS.some((a) =>
          typeof a === "string" ? spec === a : a.test(spec),
        );
        if (!allowed) {
          violations.push(`${relative(PACKAGE_DIR, file)} imports "${spec}"`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("declares only allowed dependencies", () => {
    expect(manifest.name).toBe("@forge/db");
    const deps = Object.keys(manifest.dependencies ?? {}).sort();
    expect(deps).toEqual([...ALLOWED_DEPS].sort());
    const devDeps = Object.keys(manifest.devDependencies ?? {}).sort();
    expect(devDeps).toEqual([...ALLOWED_DEV_DEPS].sort());
  });

  it("does not contain IDatabaseAdapter / IGenericDatabase / BaseRepository abstractions", () => {
    const violations: string[] = [];
    for (const file of sourceFiles) {
      const src = readFileSync(file, "utf8");
      for (const term of ["IDatabaseAdapter", "IGenericDatabase", "BaseRepository"]) {
        if (src.includes(term)) {
          violations.push(`${relative(PACKAGE_DIR, file)} contains "${term}"`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("uses postgres.js + drizzle-orm, not Supabase SDK, not Prisma", () => {
    const clientSrc = readFileSync(join(SRC_DIR, "client.ts"), "utf8");
    expect(clientSrc).toContain(`from "drizzle-orm/postgres-js"`);
    expect(clientSrc).toContain(`from "postgres"`);
    expect(clientSrc).not.toContain(`@supabase`);
    expect(clientSrc).not.toContain(`prisma`);
  });

  it("platform tables use pgSchema('platform'), not public or product schemas", () => {
    const violations: string[] = [];
    for (const file of sourceFiles) {
      if (file.includes(`${join("schema", "")}`) && file.endsWith(".ts")) {
        const src = readFileSync(file, "utf8");
        if (src.includes(`pgTable(`) && !src.includes(`pgSchema("platform")`) && !src.includes(`platform.table`)) {
          // If a file uses pgTable directly without platform, it's a violation unless it's the platform anchor itself
          const isProducts = file.endsWith("products.ts");
          if (!isProducts) {
            // But products.ts is the anchor that defines platform; other files should import platform
            // So check they import platform rather than defining their own schema name
            if (!src.includes(`from "./products.js"`)) {
              violations.push(`${relative(PACKAGE_DIR, file)} should import platform from products.ts`);
            }
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
