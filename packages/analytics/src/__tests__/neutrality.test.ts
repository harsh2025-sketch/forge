/**
 * Provider-neutrality guard.
 *
 * Fails if any vendor name, framework, database or cross-port dependency leaks
 * into this port package. Enforces V3 §4.1/§4.2 and .ai/boundaries.md:
 * packages/[port] → packages/shared, and nothing else.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = dirname(TESTS_DIR);
const PACKAGE_DIR = dirname(SRC_DIR);

/** Vendor SDKs, frameworks and infrastructure that a port may never reference. */
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

/** The only non-relative module specifiers a port may import. */
const ALLOWED_MODULE_SPECIFIERS: readonly string[] = ["@forge/shared"];

const ALLOWED_DEPENDENCIES: readonly string[] = ["@forge/shared"];
const ALLOWED_DEV_DEPENDENCIES: readonly string[] = ["typescript", "vitest"];

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

describe("port package neutrality", () => {
  it("ships at least the port, types and index source files", () => {
    const relativeFiles = sourceFiles.map((file) => relative(SRC_DIR, file));

    expect(relativeFiles).toContain("index.ts");
    expect(relativeFiles).toContain("port.ts");
    expect(relativeFiles).toContain("types.ts");
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

  it("imports nothing except relative modules and @forge/shared", () => {
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

  it("declares no dependency other than @forge/shared", () => {
    expect(manifest.name?.startsWith("@forge/")).toBe(true);
    expect(Object.keys(manifest.dependencies ?? {})).toEqual(ALLOWED_DEPENDENCIES);
    expect(Object.keys(manifest.devDependencies ?? {}).sort()).toEqual(ALLOWED_DEV_DEPENDENCIES);
    expect(manifest.peerDependencies).toBeUndefined();
    expect(manifest.optionalDependencies).toBeUndefined();
  });

  it("declares no dependency on another port or on infrastructure packages", () => {
    const forgeDependencies = Object.keys(manifest.dependencies ?? {}).filter((name) =>
      name.startsWith("@forge/")
    );

    expect(forgeDependencies).toEqual(["@forge/shared"]);
  });
});
