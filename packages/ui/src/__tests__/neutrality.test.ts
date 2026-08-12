/**
 * Boundary / provider-neutrality guard for @forge/ui.
 *
 * Enforces V3 §4.1/§4.2 and .ai/boundaries.md:
 *   packages/ui → react, react-dom ONLY (plus relative modules)
 *   FORBIDDEN: @forge/domain, @forge/db, ports, adapters, vendor SDKs,
 *   payment/auth providers, Next.js, any other framework.
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
  /\bdrizzle\b/i,
  /\bpostgres(?:ql)?\b/i,
  /\bprisma\b/i,
  /\bmongodb\b/i,
  /\bmysql\b/i,
  /from\s+["']@forge\/domain["']/,
  /from\s+["']@forge\/db["']/,
  /from\s+["']@forge\/testing["']/,
  /from\s+["']@forge\/adapters?["']/,
  /from\s+["']@forge\/(auth|billing|email|analytics|jobs|storage|ai-provider|config|reporting)["']/,
  /from\s+["']next["']/,
  /from\s+["']next\/[^"']*["']/,
];

const ALLOWED_MODULE_SPECIFIERS: readonly string[] = ["react", "react-dom"];

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
    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
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

describe("ui package neutrality", () => {
  it("ships the frozen V3 §3.2 structure", () => {
    const relativeFiles = sourceFiles.map((file) => relative(SRC_DIR, file));

    expect(relativeFiles).toContain("index.ts");
    expect(relativeFiles).toContain("theme/types.ts");
    expect(relativeFiles).toContain("theme/defaults.ts");
    expect(relativeFiles).toContain("theme/apply.ts");
    for (const primitive of [
      "button",
      "input",
      "card",
      "dialog",
      "select",
      "tabs",
      "table",
      "badge",
      "checkbox",
      "toggle",
    ]) {
      expect(relativeFiles, `missing primitives/${primitive}`).toContain(`primitives/${primitive}.tsx`);
    }
    for (const composite of [
      "data-table",
      "form-field",
      "status-badge",
      "severity-badge",
      "empty-state",
      "error-state",
      "notice",
      "loading-state",
      "pagination",
    ]) {
      expect(relativeFiles, `missing composites/${composite}`).toContain(`composites/${composite}.tsx`);
    }
    for (const layout of ["shell", "sidebar", "top-nav"]) {
      expect(relativeFiles, `missing layouts/${layout}`).toContain(`layouts/${layout}.tsx`);
    }
    expect(relativeFiles).toContain("charts/chart-container.tsx");
  });

  it("contains no vendor, provider, database or framework references in source", () => {
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

  it("imports nothing except relative modules, react and react-dom", () => {
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

  it("declares exactly react + react-dom as dependencies", () => {
    expect(manifest.name).toBe("@forge/ui");
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual(["react", "react-dom"]);
    expect(manifest.peerDependencies).toBeUndefined();
    expect(manifest.optionalDependencies).toBeUndefined();
  });

  it("declares only test/type tooling as devDependencies", () => {
    const devDependencies = Object.keys(manifest.devDependencies ?? {}).sort();
    expect(devDependencies).toEqual([
      "@types/react",
      "@types/react-dom",
      "jsdom",
      "typescript",
      "vitest",
    ]);
  });
});
