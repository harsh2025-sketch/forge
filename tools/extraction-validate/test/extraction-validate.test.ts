import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { generateProduct } from "@forge/create-product";
import { extractProduct } from "@forge/extract-product";
import { ValidationError, validateProduct } from "../src/index.js";

const temporaryRoots: string[] = [];

function tempDir(prefix: string): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryRoots.push(directory);
  return directory;
}

function write(root: string, file: string, content: string): void {
  const absoluteFile = path.join(root, file);
  fs.mkdirSync(path.dirname(absoluteFile), { recursive: true });
  fs.writeFileSync(absoluteFile, content, "utf8");
}

/** A repository root with pnpm-workspace.yaml (create-product requires it). */
function createRepository(): string {
  const root = tempDir("forge-extraction-validate-");
  fs.mkdirSync(path.join(root, "apps"));
  fs.writeFileSync(path.join(root, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n  - "packages/*"\n  - "packages/adapters/*"\n  - "tools/*"\n');
  return root;
}

/** A plain directory without workspace markers (forces standalone mode). */
function standaloneRoot(): string {
  return tempDir("forge-extraction-validate-standalone-");
}

function errorsOf(root: string, product: string): string[] {
  return validateProduct({ root, product }).errors.map((diagnostic) => diagnostic.rule);
}

/** Generates a product in a repo and validates it in standalone mode. */
function standaloneErrors(productId: string, mutate?: (product: string) => void): string[] {
  const repo = createRepository();
  generateProduct({ root: repo, name: productId });
  const product = path.join(repo, "apps", productId);
  mutate?.(product);
  return validateProduct({ root: standaloneRoot(), product }).errors.map((diagnostic) => diagnostic.rule);
}

function simpleSource(productId: string): string {
  const source = tempDir("forge-extraction-validate-src-");
  write(source, "src/utils.ts", "export function double(n: number): number {\n  return n * 2;\n}\n");
  write(source, "README.md", "# Legacy\n\nDocs.\n");
  const destination = path.join(tempDir("forge-extraction-validate-out-"), productId);
  extractProduct({ source, destination, productId, primaryArchetype: "analyzer" });
  return destination;
}

function fakePackage(root: string, relative: string, name: string): void {
  write(root, `${relative}/package.json`, JSON.stringify({ name, version: "0.0.1", private: true, type: "module" }, null, 2));
  write(root, `${relative}/src/index.ts`, "export {};\n");
}

/** A complete (minimal) Forge repository that passes arch-check + validate-docs. */
function createFullFakeRepository(): string {
  const root = tempDir("forge-extraction-validate-repo-");
  fs.mkdirSync(path.join(root, "apps"));
  write(root, "package.json", JSON.stringify({ name: "fake-forge", private: true }, null, 2));
  write(
    root,
    "pnpm-workspace.yaml",
    'packages:\n  - "apps/*"\n  - "packages/*"\n  - "packages/adapters/*"\n  - "tools/*"\n',
  );
  const filler = Array.from({ length: 230 }, (_, index) => `word${index}`).join(" ");
  const substantive = (title: string): string => `# ${title}\n\n## Overview\n\n${filler}\n`;
  write(root, "README.md", substantive("Forge"));
  write(root, "docs/FRAMEWORK.md", substantive("Framework"));
  write(root, "docs/ARCHETYPES.md", substantive("Archetypes"));
  write(root, ".ai/rules.md", substantive("Rules"));
  write(
    root,
    ".ai/boundaries.md",
    `# Boundaries\n\n${filler}\n\n## packages/shared\n\n${filler}\n\n## packages/domain\n\n${filler}\n\n## packages/config\n\n${filler}\n`,
  );
  write(
    root,
    ".ai/architecture-rules.md",
    `# Architecture rules\n\n${Array.from({ length: 22 }, (_, index) => `**P${index + 1} — Principle ${index + 1}.** ${filler}`).join("\n\n")}\n`,
  );
  write(
    root,
    "docs/architecture/FORGE-MASTER-ARCHITECTURE-V3.md",
    `# Master V3\n\n${[
      "## 1. Final Architecture Principles",
      "## 3. Final Repository Architecture",
      "## 4. Final Dependency Graph",
      "## 13. Final CI/CD Architecture",
      "## 15. Final Architecture-Check System",
      "## 20. Final 14-Day Framework Implementation Plan",
    ].join("\n\n")}\n\n${filler}\n`,
  );
  fakePackage(root, "packages/shared", "@forge/shared");
  fakePackage(root, "packages/domain", "@forge/domain");
  fakePackage(root, "packages/config", "@forge/config");
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("extraction-validate valid products", () => {
  it("validates a generated product with no errors (standalone mode)", () => {
    const repo = createRepository();
    generateProduct({ root: repo, name: "demo" });
    const report = validateProduct({ root: standaloneRoot(), product: path.join(repo, "apps", "demo") });
    expect(report.mode).toBe("standalone");
    expect(report.errors).toEqual([]);
  });

  it("validates an extracted product with no errors (standalone mode)", () => {
    const product = simpleSource("legacy-app");
    const report = validateProduct({ root: standaloneRoot(), product });
    expect(report.mode).toBe("standalone");
    expect(report.errors).toEqual([]);
  });

  it("passes the full repo-mode chain (arch-check and validate-docs delegation)", () => {
    const root = createFullFakeRepository();
    generateProduct({ root, name: "demo" });
    const report = validateProduct({ root, product: "demo" });
    expect(report.mode).toBe("repo");
    expect(report.errors).toEqual([]);
  });

  it("is deterministic: identical input yields identical diagnostics", () => {
    const repo = createRepository();
    generateProduct({ root: repo, name: "demo" });
    const product = path.join(repo, "apps", "demo");
    const first = validateProduct({ root: standaloneRoot(), product });
    const second = validateProduct({ root: standaloneRoot(), product });
    expect(JSON.stringify(first.diagnostics)).toBe(JSON.stringify(second.diagnostics));
  });
});

describe("extraction-validate manifest checks", () => {
  it("fails when the manifest is missing", () => {
    expect(standaloneErrors("demo", (product) => fs.rmSync(path.join(product, "product.manifest.ts")))).toContain("MANIFEST_MISSING");
  });

  it("fails when the manifest is not static", () => {
    expect(
      standaloneErrors("demo", (product) =>
        write(
          product,
          "product.manifest.ts",
          'export default defineProductManifest({ id: "demo", displayName: process.env.NAME ?? "Demo", tagline: "t", primaryArchetype: "analyzer", capabilities: [], plans: [], requiresWorker: false, requiresAIProvider: false });\n',
        ),
      ),
    ).toContain("MANIFEST_NOT_STATIC");
  });

  it("fails when the manifest violates the frozen schema", () => {
    expect(
      standaloneErrors("demo", (product) =>
        write(
          product,
          "product.manifest.ts",
          'import { defineProductManifest } from "@forge/config";\nexport default defineProductManifest({ id: "demo", displayName: "Demo", tagline: "t", primaryArchetype: "wat", capabilities: [], plans: [], requiresWorker: false, requiresAIProvider: false });\n',
        ),
      ),
    ).toContain("MANIFEST_INVALID");
  });

  it("warns when the product directory does not match the manifest id (standalone)", () => {
    const repo = createRepository();
    generateProduct({ root: repo, name: "demo" });
    const renamed = path.join(repo, "apps", "other-name");
    fs.renameSync(path.join(repo, "apps/demo"), renamed);
    const report = validateProduct({ root: standaloneRoot(), product: renamed });
    expect(report.warnings.some((diagnostic) => diagnostic.rule === "PRODUCT_DIRECTORY_MISMATCH")).toBe(true);
  });
});

describe("extraction-validate structure and isolation", () => {
  it("fails when providers.ts is missing", () => {
    expect(standaloneErrors("demo", (product) => fs.rmSync(path.join(product, "src/providers.ts")))).toContain("PROVIDERS_MISSING");
  });

  it("fails on adapter imports outside providers.ts (provider bypass)", () => {
    const errors = standaloneErrors("demo", (product) =>
      write(product, "src/features/billing.ts", 'import { stripeBillingAdapter } from "@forge/adapter-stripe";\nexport const billing = stripeBillingAdapter;\n'),
    );
    expect(errors).toContain("ADAPTER_BYPASS");
  });

  it("fails on vendor SDK imports (vendor leakage)", () => {
    const errors = standaloneErrors("demo", (product) =>
      write(product, "src/features/billing.ts", 'import Stripe from "stripe";\nexport const client = new Stripe("key");\n'),
    );
    expect(errors).toContain("VENDOR_LEAKAGE");
  });

  it("fails on unknown @forge packages and undeclared forge dependencies", () => {
    const errors = standaloneErrors("demo", (product) => {
      write(product, "src/features/x.ts", 'import { thing } from "@forge/not-a-package";\nexport const x = thing;\n');
      write(product, "src/features/y.ts", 'import { db } from "@forge/db";\nexport const y = db;\n');
    });
    expect(errors).toContain("UNKNOWN_FORGE_PACKAGE");
    expect(errors).toContain("UNDECLARED_FORGE_DEPENDENCY");
  });

  it("fails when a port is imported from providers but not exported (provider wiring)", () => {
    const errors = standaloneErrors("demo", (product) =>
      write(product, "src/features/actions.ts", 'import { authPort } from "@/providers";\nexport const run = authPort;\n'),
    );
    expect(errors).toContain("PROVIDER_WIRING");

    const repo = createRepository();
    generateProduct({ root: repo, name: "demo" });
    write(repo, "apps/demo/src/features/actions.ts", 'import { authPort } from "@/providers";\nexport const run = authPort;\n');
    write(repo, "apps/demo/src/providers.ts", 'export const authPort: unknown = null;\n');
    const after = validateProduct({ root: standaloneRoot(), product: path.join(repo, "apps", "demo") });
    expect(after.errors.some((diagnostic) => diagnostic.rule === "PROVIDER_WIRING")).toBe(false);
  });

  it("fails when a declared capability has no subsystem dependency", () => {
    const repo = createRepository();
    generateProduct({ root: repo, name: "cap", capabilities: ["reporting"] });
    const packageFile = path.join(repo, "apps/cap/package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageFile, "utf8")) as { dependencies: Record<string, string> };
    delete packageJson.dependencies["@forge/reporting"];
    fs.writeFileSync(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`);
    const report = validateProduct({ root: standaloneRoot(), product: path.join(repo, "apps", "cap") });
    expect(report.errors.map((diagnostic) => diagnostic.rule)).toContain("CAPABILITY_DEPENDENCY");
  });

  it("fails on unresolved external dependencies in repo mode", () => {
    const root = createFullFakeRepository();
    generateProduct({ root, name: "demo" });
    fs.mkdirSync(path.join(root, "node_modules/zod"), { recursive: true });
    const packageFile = path.join(root, "apps/demo/package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageFile, "utf8")) as { dependencies: Record<string, string> };
    packageJson.dependencies["some-missing-pkg"] = "^1.0.0";
    fs.writeFileSync(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`);
    expect(errorsOf(root, "demo")).toContain("UNRESOLVED_DEPENDENCY");
  });

  it("fails on missing required documentation", () => {
    expect(standaloneErrors("demo", (product) => fs.rmSync(path.join(product, "docs/SETUP.md")))).toContain("MISSING_PRODUCT_DOCUMENT");
  });

  it("fails on stub documentation in standalone mode", () => {
    const errors = standaloneErrors("demo", (product) =>
      write(product, "docs/SETUP.md", "# Setup\n\n## Environment variables\n\nShort stub with TODO here.\n"),
    );
    expect(errors).toContain("PRODUCT_DOCUMENT_STUB");
  });

  it("fails on vendor leakage in repo mode through architecture delegation", () => {
    const root = createFullFakeRepository();
    generateProduct({ root, name: "demo" });
    write(root, "apps/demo/src/features/billing.ts", 'import Stripe from "stripe";\nexport const client = new Stripe("key");\n');
    const report = validateProduct({ root, product: "demo" });
    const diagnostic = report.errors.find((entry) => entry.rule === "ARCHITECTURE_CHECK");
    expect(diagnostic).toBeDefined();
    expect(diagnostic?.message).toContain("VENDOR_LEAKAGE");
  });
});

describe("extraction-validate extraction report checks", () => {
  it("fails when the report classifies a vendor file as SAFE", () => {
    const source = tempDir("forge-extraction-validate-vendor-");
    write(source, "src/billing.ts", 'import Stripe from "stripe";\nexport const client = new Stripe("key");\n');
    const product = path.join(tempDir("forge-extraction-validate-out-"), "vendor-app");
    extractProduct({ source, destination: product, productId: "vendor-app", primaryArchetype: "analyzer" });
    const reportFile = path.join(product, "extraction-report.json");
    const report = JSON.parse(fs.readFileSync(reportFile, "utf8")) as {
      filesDiscovered: Array<{ path: string; classification: string }>;
    };
    const billing = report.filesDiscovered.find((file) => file.path === "src/billing.ts");
    if (billing !== undefined) billing.classification = "SAFE";
    fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
    expect(errorsOf(standaloneRoot(), product)).toContain("CLASSIFICATION_INCONSISTENT");
  });

  it("fails when the report status is failed", () => {
    const product = simpleSource("legacy-app");
    const reportFile = path.join(product, "extraction-report.json");
    const report = JSON.parse(fs.readFileSync(reportFile, "utf8")) as { status: string };
    report.status = "failed";
    fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
    expect(errorsOf(standaloneRoot(), product)).toContain("EXTRACTION_STATUS_FAILED");
  });

  it("fails when a manual migration item has no remediation", () => {
    const source = tempDir("forge-extraction-validate-vendor-");
    write(source, "src/billing.ts", 'import Stripe from "stripe";\nexport const client = new Stripe("key");\n');
    const product = path.join(tempDir("forge-extraction-validate-out-"), "vendor-app");
    extractProduct({ source, destination: product, productId: "vendor-app", primaryArchetype: "analyzer" });
    const reportFile = path.join(product, "extraction-report.json");
    const report = JSON.parse(fs.readFileSync(reportFile, "utf8")) as {
      manualMigrationItems: Array<{ id: string; remediation: string }>;
    };
    expect(report.manualMigrationItems.length).toBeGreaterThan(0);
    report.manualMigrationItems[0].remediation = "";
    fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
    expect(errorsOf(standaloneRoot(), product)).toContain("EXTRACTION_MANUAL_ITEM_INVALID");
  });

  it("warns (not errors) when a reported file was removed after extraction", () => {
    const product = simpleSource("legacy-app");
    fs.rmSync(path.join(product, "src/utils.ts"));
    const report = validateProduct({ root: standaloneRoot(), product });
    expect(report.errors).toEqual([]);
    expect(report.warnings.some((diagnostic) => diagnostic.rule === "REPORTED_FILE_MISSING")).toBe(true);
  });
});

describe("extraction-validate CLI", () => {
  const cli = path.resolve("dist/cli.js");

  it("exits 0 for a valid product", () => {
    const root = createFullFakeRepository();
    generateProduct({ root, name: "cli-demo" });
    const run = spawnSync(process.execPath, [cli, "--root", root, "cli-demo"], { encoding: "utf8" });
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/Extraction validation passed/);
  });

  it("exits 1 for blocking violations", () => {
    const root = createFullFakeRepository();
    generateProduct({ root, name: "cli-demo" });
    fs.rmSync(path.join(root, "apps/cli-demo/src/providers.ts"));
    const run = spawnSync(process.execPath, [cli, "--root", root, "cli-demo"], { encoding: "utf8" });
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/PROVIDERS_MISSING/);
  });

  it("exits 2 for usage errors", () => {
    const run = spawnSync(process.execPath, [cli], { encoding: "utf8" });
    expect(run.status).toBe(2);
  });

  it("writes a machine-readable report with --json", () => {
    const root = createFullFakeRepository();
    generateProduct({ root, name: "cli-demo" });
    const jsonPath = path.join(tempDir("forge-extraction-validate-json-"), "report.json");
    const run = spawnSync(process.execPath, [cli, "--root", root, "cli-demo", "--json", jsonPath], { encoding: "utf8" });
    expect(run.status).toBe(0);
    const report = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as { diagnostics: unknown[] };
    expect(Array.isArray(report.diagnostics)).toBe(true);
  });
});

describe("extraction-validate resolution", () => {
  it("throws when the product cannot be found", () => {
    expect(() => validateProduct({ root: standaloneRoot(), product: "missing-product" })).toThrow(ValidationError);
  });
});
