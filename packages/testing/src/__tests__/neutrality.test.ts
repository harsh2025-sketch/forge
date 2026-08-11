/**
 * Boundary guard for @forge/testing.
 *
 * Fails if any vendor SDK, framework or infrastructure dependency leaks into
 * this package. Enforces V3 §4.1/§4.2 and .ai/boundaries.md:
 * packages/testing → packages/shared + all port packages + test tooling only.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = dirname(TESTS_DIR);
const PACKAGE_DIR = dirname(SRC_DIR);

/** Vendor SDKs, frameworks and infrastructure this package may never reference. */
const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\bclerk\b/i,
  /\bauth0\b/i,
  /\bstripe\b/i,
  /\bpaddle\b/i,
  /\bresend\b/i,
  /\bsendgrid\b/i,
  /\bmailgun\b/i,
  /\bposthog\b/i,
  /\bmixpanel\b/i,
  /\blaunchdarkly\b/i,
  /\bsupabase\b/i,
  /\bsvix\b/i,
  /\bpg-boss\b/i,
  /\bpgboss\b/i,
  /\bbullmq\b/i,
  /\bredis\b/i,
  /\bioredis\b/i,
  /\bopenai\b/i,
  /\banthropic\b/i,
  /\bbedrock\b/i,
  /\baws\b/i,
  /\bs3\b/i,
  /\bazure\b/i,
  /\bgcp\b/i,
  /\bvercel\b/i,
  /\bnext\.js\b/i,
  /\bnextjs\b/i,
  /["']next(?:\/[^"']*)?["']/,
  /\breact\b/i,
  /\bdrizzle\b/i,
  /\bpostgres\b/i,
  /\bprisma\b/i,
  /\bmongodb\b/i,
  /\bpuppeteer\b/i,
];

/** The only non-relative module specifiers this package may import. */
const ALLOWED_MODULE_SPECIFIERS: readonly string[] = [
  "@forge/shared",
  "@forge/auth",
  "@forge/billing",
  "@forge/email",
  "@forge/analytics",
  "@forge/jobs",
  "@forge/storage",
  "@forge/ai-provider",
  "vitest",
];

const ALLOWED_DEPENDENCIES: readonly string[] = [
  "@forge/ai-provider",
  "@forge/analytics",
  "@forge/auth",
  "@forge/billing",
  "@forge/email",
  "@forge/jobs",
  "@forge/shared",
  "@forge/storage",
  "vitest",
];
const ALLOWED_DEV_DEPENDENCIES: readonly string[] = ["typescript"];

interface PackageManifest {
  readonly name?: string;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly optionalDependencies?: Record<string, string>;
}

function listSourceFiles(directory: string): readonly string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      // Test files intentionally name vendors; only shipped source is scanned.
      if (entry === "__tests__") {
        continue;
      }
      files.push(...listSourceFiles(fullPath));
      continue;
    }
    if (entry.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

function readImportSpecifiers(source: string): readonly string[] {
  const specifiers: string[] = [];
  const importPattern = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+["']([^"']+)["']/g;
  const sideEffectPattern = /(?:^|\n)\s*import\s+["']([^"']+)["']/g;

  for (const match of source.matchAll(importPattern)) {
    specifiers.push(match[1]);
  }
  for (const match of source.matchAll(sideEffectPattern)) {
    specifiers.push(match[1]);
  }

  return specifiers;
}

const sourceFiles = listSourceFiles(SRC_DIR);
const manifest = JSON.parse(
  readFileSync(join(PACKAGE_DIR, "package.json"), "utf8")
) as PackageManifest;

describe("@forge/testing neutrality", () => {
  it("ships the conformance, factories and mocks directories", () => {
    const relativeFiles = sourceFiles.map((file) => relative(SRC_DIR, file).replaceAll("\\", "/"));

    expect(relativeFiles).toContain("index.ts");
    expect(relativeFiles.some((file) => file.startsWith("conformance/"))).toBe(true);
    expect(relativeFiles.some((file) => file.startsWith("factories/"))).toBe(true);
    expect(relativeFiles.some((file) => file.startsWith("mocks/"))).toBe(true);
  });

  it("contains no vendor, framework or infrastructure references in source", () => {
    const violations: string[] = [];

    for (const file of sourceFiles) {
      const source = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(source)) {
          violations.push(`${relative(PACKAGE_DIR, file)} matches ${String(pattern)}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("imports nothing except relative modules, ports, shared and vitest", () => {
    const violations: string[] = [];

    for (const file of sourceFiles) {
      const source = readFileSync(file, "utf8");
      for (const specifier of readImportSpecifiers(source)) {
        const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
        if (isRelative || ALLOWED_MODULE_SPECIFIERS.includes(specifier)) {
          continue;
        }
        violations.push(`${relative(PACKAGE_DIR, file)} imports "${specifier}"`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("declares only the allowed dependencies", () => {
    expect(manifest.name).toBe("@forge/testing");
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual([...ALLOWED_DEPENDENCIES].sort());
    expect(Object.keys(manifest.devDependencies ?? {}).sort()).toEqual(ALLOWED_DEV_DEPENDENCIES);
    expect(manifest.peerDependencies).toBeUndefined();
    expect(manifest.optionalDependencies).toBeUndefined();
  });

  it("declares no dependency on adapters, domain, config, db or infrastructure", () => {
    const forgeDependencies = Object.keys(manifest.dependencies ?? {}).filter((name) =>
      name.startsWith("@forge/")
    );
    const forbidden = forgeDependencies.filter((name) =>
      ["@forge/domain", "@forge/config", "@forge/db", "@forge/ui", "@forge/reporting"].includes(name)
    );
    expect(forbidden).toEqual([]);
    expect(forgeDependencies.some((name) => name.includes("adapter"))).toBe(false);
  });
});
