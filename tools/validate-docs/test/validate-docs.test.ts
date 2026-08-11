import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { REQUIRED_PRODUCT_DOCUMENTS, validateDocumentation } from "../src/index.js";

const temporaryRoots: string[] = [];
const filler = Array.from({ length: 230 }, (_, index) => `word${index}`).join(" ");

function write(root: string, file: string, content: string): void {
  const absoluteFile = path.join(root, file);
  fs.mkdirSync(path.dirname(absoluteFile), { recursive: true });
  fs.writeFileSync(absoluteFile, content);
}

function substantive(title: string, section = "Overview"): string {
  return `# ${title}\n\n## ${section}\n\n${filler}\n`;
}

function createRepository(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-validate-docs-"));
  temporaryRoots.push(root);
  write(root, "package.json", JSON.stringify({ name: "fixture", private: true }));
  write(root, "README.md", substantive("Forge"));
  write(root, "docs/FRAMEWORK.md", substantive("Framework"));
  write(root, "docs/ARCHETYPES.md", substantive("Archetypes"));
  write(root, ".ai/rules.md", substantive("Rules"));
  write(root, ".ai/boundaries.md", substantive("Boundaries"));
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
  return root;
}

function addProduct(root: string, product = "alpha"): void {
  write(root, `apps/${product}/package.json`, JSON.stringify({ name: `@forge/product-${product}` }));
}

function requiredSection(document: (typeof REQUIRED_PRODUCT_DOCUMENTS)[number]): string {
  const sections: Partial<Record<(typeof REQUIRED_PRODUCT_DOCUMENTS)[number], string>> = {
    "SETUP.md": "Environment variables",
    "DATABASE.md": "Schema",
    "PROVIDERS.md": "Provider replacement",
    "SECURITY.md": "Security model",
    "ACQUISITION.md": "Extraction and handoff",
  };
  return sections[document] ?? "Overview";
}

function addCompleteProductDocs(root: string, product = "alpha"): void {
  for (const document of REQUIRED_PRODUCT_DOCUMENTS) {
    write(
      root,
      `apps/${product}/docs/${document}`,
      substantive(document.replace(".md", ""), requiredSection(document)),
    );
  }
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("framework and governance documentation", () => {
  it("passes a substantive framework repository before product applications exist", () => {
    const report = validateDocumentation(createRepository());
    expect(report.errors).toEqual([]);
    expect(report.productsChecked).toBe(0);
    expect(report.documentsChecked).toBe(7);
  });

  it("fails when a required framework document is missing", () => {
    const root = createRepository();
    fs.rmSync(path.join(root, "docs/FRAMEWORK.md"));
    const error = validateDocumentation(root).errors.find(
      (diagnostic) => diagnostic.rule === "MISSING_FRAMEWORK_DOCUMENT",
    );
    expect(error?.file).toBe("docs/FRAMEWORK.md");
  });

  it("detects drift in the frozen P1 through P22 principle sequence", () => {
    const root = createRepository();
    const file = path.join(root, ".ai/architecture-rules.md");
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("**P22 —", "**P23 —"));
    expect(validateDocumentation(root).errors.map((error) => error.rule)).toContain(
      "FROZEN_PRINCIPLES_DRIFT",
    );
  });

  it("requires every package to have a documented boundary", () => {
    const root = createRepository();
    write(root, "packages/auth/package.json", JSON.stringify({ name: "@forge/auth" }));
    const error = validateDocumentation(root).errors.find(
      (diagnostic) => diagnostic.rule === "UNDOCUMENTED_PACKAGE_BOUNDARY",
    );
    expect(error?.message).toContain("packages/auth");
  });
});

describe("product documentation", () => {
  it("fails with actionable paths for every missing document enumerated by frozen V3", () => {
    const root = createRepository();
    addProduct(root);
    const missing = validateDocumentation(root).errors.filter(
      (error) => error.rule === "MISSING_PRODUCT_DOCUMENT",
    );
    expect(missing).toHaveLength(REQUIRED_PRODUCT_DOCUMENTS.length);
    expect(missing[0]?.file).toMatch(/^apps\/alpha\/docs\//);
  });

  it("accepts complete product documentation with required sections", () => {
    const root = createRepository();
    addProduct(root);
    addCompleteProductDocs(root);
    const report = validateDocumentation(root);
    expect(report.errors).toEqual([]);
    expect(report.documentsChecked).toBe(17);
  });

  it("rejects short content and explicit stub markers", () => {
    const root = createRepository();
    addProduct(root);
    addCompleteProductDocs(root);
    write(root, "apps/alpha/docs/API.md", "# API\n\n## Overview\n\nTODO: describe this later.\n");
    const apiErrors = validateDocumentation(root).errors.filter(
      (error) => error.file === "apps/alpha/docs/API.md",
    );
    expect(apiErrors.map((error) => error.rule)).toEqual([
      "PRODUCT_DOCUMENT_STUB",
      "PRODUCT_DOCUMENT_STUB",
    ]);
  });

  it("rejects a missing document-specific required section", () => {
    const root = createRepository();
    addProduct(root);
    addCompleteProductDocs(root);
    write(root, "apps/alpha/docs/SETUP.md", substantive("Setup", "Overview"));
    const error = validateDocumentation(root).errors.find(
      (diagnostic) => diagnostic.file === "apps/alpha/docs/SETUP.md",
    );
    expect(error?.rule).toBe("MISSING_REQUIRED_SECTION");
  });
});

describe("CLI behavior", () => {
  it("returns a non-zero status and an actionable stable rule name", () => {
    const root = createRepository();
    addProduct(root);
    const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
    const result = spawnSync(process.execPath, [cli, "--root", root], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("[MISSING_PRODUCT_DOCUMENT]");
    expect(result.stderr).toContain("apps/alpha/docs/ARCHITECTURE.md");
  });
});
