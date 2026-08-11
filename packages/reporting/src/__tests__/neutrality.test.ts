/**
 * Boundary / provider-neutrality guard for @forge/reporting.
 *
 * Enforces V3 §4.1 and .ai/boundaries.md:
 *   packages/reporting → packages/domain, packages/shared ONLY
 *
 * Forbidden: adapters, vendor SDKs, @forge/db, application code, any frontend
 * framework, and any static browser import. The only vendor exception is the
 * OPTIONAL Puppeteer wrapper (generators/pdf.ts), which must reference
 * puppeteer-core via a dynamic import only — never a static import — and must
 * be declared in optionalDependencies, not dependencies.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = dirname(TESTS_DIR);
const PACKAGE_DIR = dirname(SRC_DIR);

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
  /\bazure\b/i,
  /\bgcp\b/i,
  /\bvercel\b/i,
  /\bnext(?:\.js)?\b/i,
  /\breact\b/i,
  /\bdrizzle\b/i,
  /\bpostgres(?:ql)?\b/i,
  /\bprisma\b/i,
  /\bmongodb\b/i,
  /\bmysql\b/i,
  /from\s+["']@forge\/adapters?["']/,
  /from\s+["']@forge\/db["']/,
  /from\s+["']@forge\/ui["']/,
  /from\s+["']@forge\/testing["']/,
  /from\s+["']@forge\/(auth|billing|email|analytics|jobs|storage|ai-provider|config)["']/,
];

const ALLOWED_MODULE_SPECIFIERS: readonly string[] = ["@forge/domain", "@forge/shared"];

const PDF_GENERATOR = "generators/pdf.ts";

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
const manifest = JSON.parse(readFileSync(join(PACKAGE_DIR, "package.json"), "utf8")) as PackageManifest;

describe("reporting package neutrality", () => {
  it("ships the frozen V3 §3.2 file inventory", () => {
    const relativeFiles = sourceFiles.map((file) => relative(SRC_DIR, file));

    expect(relativeFiles).toContain("types.ts");
    expect(relativeFiles).toContain("pipeline.ts");
    expect(relativeFiles).toContain("generators/json.ts");
    expect(relativeFiles).toContain("generators/markdown.ts");
    expect(relativeFiles).toContain("generators/html.ts");
    expect(relativeFiles).toContain("generators/pdf.ts");
    expect(relativeFiles).toContain("index.ts");
  });

  it("contains no vendor, framework, adapter or database references in source", () => {
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

  it("imports nothing except relative modules, @forge/domain and @forge/shared", () => {
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

  it("keeps Puppeteer isolated: dynamic import only, inside generators/pdf.ts", () => {
    const pdfSource = readFileSync(join(SRC_DIR, PDF_GENERATOR), "utf8");

    // No static import of puppeteer-core anywhere in the package.
    for (const file of sourceFiles) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/import[\s\S]*from\s+["']puppeteer-core["']/);
    }

    // The dynamic import lives only in the pdf generator.
    expect(pdfSource).toContain('await import("puppeteer-core")');
  });

  it("declares exactly @forge/domain + @forge/shared as dependencies", () => {
    expect(manifest.name).toBe("@forge/reporting");
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual(["@forge/domain", "@forge/shared"]);
    expect(manifest.peerDependencies).toBeUndefined();
  });

  it("declares only puppeteer-core as an optional dependency (the PDF carve-out)", () => {
    expect(Object.keys(manifest.optionalDependencies ?? {})).toEqual(["puppeteer-core"]);
    expect(manifest.dependencies?.["puppeteer-core"]).toBeUndefined();
  });

  it("declares only test tooling as devDependencies", () => {
    expect(Object.keys(manifest.devDependencies ?? {}).sort()).toEqual(["typescript", "vitest"]);
  });
});
