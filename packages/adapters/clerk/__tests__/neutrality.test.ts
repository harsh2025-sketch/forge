/**
 * Boundary guard for @forge/adapter-clerk.
 *
 * Enforces P5 (the Clerk vendor SDK lives in exactly this adapter package),
 * Rule Set 2.3 (adapter implements exactly one port) and V3 §4.1/§4.2:
 * adapters/[clerk] → @forge/auth + @forge/shared + the Clerk vendor stack,
 * nothing else.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = dirname(TESTS_DIR);
const SRC_DIR = join(PACKAGE_DIR, "src");

/** Vendors and infrastructure that must never appear in this adapter. */
const FORBIDDEN_PATTERNS: readonly RegExp[] = [
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
  /\bauth0\b/i,
];

/** The only non-relative module specifiers this adapter may import. */
const ALLOWED_MODULE_SPECIFIERS: readonly string[] = [
  "@forge/auth",
  "@forge/shared",
  "@clerk/backend",
  "svix",
];

const ALLOWED_DEPENDENCIES: readonly string[] = [
  "@clerk/backend",
  "@forge/auth",
  "@forge/shared",
  "svix",
];
const ALLOWED_DEV_DEPENDENCIES: readonly string[] = ["@forge/testing", "typescript", "vitest"];

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

describe("@forge/adapter-clerk boundaries", () => {
  it("ships exactly the adapter, middleware, webhook and index source files", () => {
    const relativeFiles = sourceFiles
      .map((file) => relative(SRC_DIR, file).replaceAll("\\", "/"))
      .sort();
    expect(relativeFiles).toEqual(["adapter.ts", "index.ts", "middleware.ts", "webhook.ts"]);
  });

  it("contains no foreign vendor, framework or infrastructure references", () => {
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

  it("imports nothing except relative modules, the auth port, shared and the Clerk stack", () => {
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

  it("actually wraps the Clerk vendor SDK inside this package (P5)", () => {
    const specifiers = sourceFiles.flatMap((file) =>
      readImportSpecifiers(readFileSync(file, "utf8"))
    );
    expect(specifiers).toContain("@clerk/backend");
    expect(specifiers).toContain("svix");
  });

  it("declares only the allowed dependencies", () => {
    expect(manifest.name).toBe("@forge/adapter-clerk");
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual([...ALLOWED_DEPENDENCIES].sort());
    expect(Object.keys(manifest.devDependencies ?? {}).sort()).toEqual([...ALLOWED_DEV_DEPENDENCIES].sort());
    expect(manifest.peerDependencies).toBeUndefined();
    expect(manifest.optionalDependencies).toBeUndefined();
  });

  it("depends on no @forge package except the auth port and shared kernel", () => {
    const forgeDependencies = Object.keys(manifest.dependencies ?? {}).filter((name) =>
      name.startsWith("@forge/")
    );
    expect(forgeDependencies.sort()).toEqual(["@forge/auth", "@forge/shared"]);
  });
});
