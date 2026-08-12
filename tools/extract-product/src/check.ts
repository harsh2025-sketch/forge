#!/usr/bin/env node

/**
 * Package check for @forge/extract-product.
 *
 * Exercises the real CLI in both directions:
 *   1. import an untrusted source application into a Forge product
 *   2. export a Forge product as a standalone workspace
 *
 * All work happens in a temporary directory that is deleted afterwards.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { generateProduct } from "@forge/create-product";

function fail(message: string): never {
  console.error(`extract-product check failed: ${message}`);
  process.exit(1);
}

function write(root: string, file: string, content: string): void {
  const absolute = path.join(root, file);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content, "utf8");
}

const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), "cli.js");
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "forge-extract-product-check-"));

try {
  // ---- import direction -------------------------------------------------
  const source = path.join(temporaryRoot, "legacy-source");
  write(
    source,
    "package.json",
    JSON.stringify({ name: "legacy-app", version: "1.0.0", dependencies: { react: "^18.3.1" } }),
  );
  write(source, "src/utils.ts", "export function double(n: number): number {\n  return n * 2;\n}\n");
  const imported = path.join(temporaryRoot, "imported-app");
  const importRun = spawnSync(
    process.execPath,
    [cli, source, imported, "--archetype", "analyzer", "--name", "imported-app"],
    { encoding: "utf8" },
  );
  if (importRun.status !== 0) {
    fail(`import CLI exited ${String(importRun.status)}: ${importRun.stderr || importRun.stdout}`);
  }
  for (const relative of ["product.manifest.ts", "src/providers.ts", "extraction-report.json", "src/utils.ts"]) {
    if (!fs.existsSync(path.join(imported, relative))) {
      fail(`import did not produce ${relative}`);
    }
  }
  const importReport = JSON.parse(fs.readFileSync(path.join(imported, "extraction-report.json"), "utf8")) as {
    status: string;
    productId: string;
  };
  if (importReport.productId !== "imported-app") {
    fail(`import report productId is ${importReport.productId}`);
  }
  if (importReport.status !== "complete" && importReport.status !== "complete-with-manual-migration") {
    fail(`import report status is ${importReport.status}`);
  }

  // ---- export direction -------------------------------------------------
  const repo = path.join(temporaryRoot, "forge-repo");
  write(repo, "pnpm-workspace.yaml", 'packages:\n  - "apps/*"\n  - "packages/*"\n  - "tools/*"\n');
  write(repo, "package.json", JSON.stringify({ name: "forge", private: true, scripts: { "create-product": "factory" } }));
  write(
    repo,
    "apps/other/package.json",
    JSON.stringify({ name: "other" }),
  );
  write(repo, "apps/other/src/leaked.ts", "export const leaked = true;\n");
  write(repo, "tools/create-product/package.json", JSON.stringify({ name: "@forge/create-product" }));
  write(repo, "tools/create-product/src/index.ts", "export const factory = true;\n");
  write(repo, "packages/shared/package.json", JSON.stringify({ name: "@forge/shared" }));
  write(repo, "packages/shared/src/index.ts", "export const ok = true;\n");
  write(
    repo,
    "packages/config/package.json",
    JSON.stringify({ name: "@forge/config", dependencies: { "@forge/shared": "workspace:*" } }),
  );
  write(repo, "packages/config/src/index.ts", "export const config = true;\n");
  generateProduct({ root: repo, name: "export-probe", primaryArchetype: "analyzer" });

  const exported = path.join(temporaryRoot, "exported-app");
  const exportRun = spawnSync(
    process.execPath,
    [cli, "--export", "--root", repo, "export-probe", exported],
    { encoding: "utf8" },
  );
  if (exportRun.status !== 0) {
    fail(`export CLI exited ${String(exportRun.status)}: ${exportRun.stderr || exportRun.stdout}`);
  }
  if (!fs.existsSync(path.join(exported, "apps/export-probe/product.manifest.ts"))) {
    fail("export did not copy the product");
  }
  if (fs.existsSync(path.join(exported, "apps/other"))) {
    fail("export copied an unrelated product");
  }
  if (fs.existsSync(path.join(exported, "tools/create-product"))) {
    fail("export copied factory tooling");
  }
  if (fs.existsSync(path.join(exported, "node_modules"))) {
    fail("export copied node_modules");
  }
  const exportReport = JSON.parse(fs.readFileSync(path.join(exported, "extraction-export-report.json"), "utf8")) as {
    status: string;
    productId: string;
  };
  if (exportReport.productId !== "export-probe" || exportReport.status !== "complete") {
    fail(`export report is ${exportReport.productId}/${exportReport.status}`);
  }

  console.log("extract-product check passed: import + export CLI both produced valid isolated output.");
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
