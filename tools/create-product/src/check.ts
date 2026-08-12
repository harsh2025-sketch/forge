#!/usr/bin/env node

/**
 * Package check for @forge/create-product.
 *
 * Exercises the real CLI: scaffolds a throwaway product in a temporary Forge
 * workspace, verifies the generated surface, then deletes the workspace.
 * Never writes into the caller's repository.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "product.manifest.ts",
  "package.json",
  "src/providers.ts",
  "src/domain/engine.ts",
  "src/app/page.tsx",
  "src/app/layout.tsx",
  "src/app/api/health/route.ts",
  "src/components/landing/landing-page.tsx",
  "src/theme/tokens.ts",
  "src/dev-mode/auth.ts",
  "src/dev-mode/billing.ts",
  "Dockerfile",
  "docker-compose.yml",
  "e2e/smoke.spec.ts",
  ".env.example",
] as const;

function fail(message: string): never {
  console.error(`create-product check failed: ${message}`);
  process.exit(1);
}

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "forge-create-product-check-"));

try {
  fs.mkdirSync(path.join(temporaryRoot, "apps"));
  fs.writeFileSync(
    path.join(temporaryRoot, "pnpm-workspace.yaml"),
    'packages:\n  - "apps/*"\n  - "packages/*"\n  - "packages/adapters/*"\n  - "tools/*"\n',
  );

  const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), "cli.js");
  const run = spawnSync(
    process.execPath,
    [
      cli,
      "--root",
      temporaryRoot,
      "reuse-probe",
      "--archetype",
      "generator",
      "--capabilities",
      "reporting",
      "--display-name",
      "Reuse Probe",
    ],
    { encoding: "utf8" },
  );

  if (run.status !== 0) {
    fail(`CLI exited ${String(run.status)}: ${run.stderr || run.stdout}`);
  }
  if (!run.stdout.includes("Created product reuse-probe")) {
    fail(`CLI did not report product creation:\n${run.stdout}`);
  }

  const product = path.join(temporaryRoot, "apps", "reuse-probe");
  for (const relative of REQUIRED_FILES) {
    if (!fs.existsSync(path.join(product, relative))) {
      fail(`missing generated file ${relative}`);
    }
  }

  const landing = fs.readFileSync(path.join(product, "src/components/landing/landing-page.tsx"), "utf8");
  if (/alg=none|Scan JWTs|catch algorithm confusion/i.test(landing)) {
    fail("generated landing page contains JWT Scanner product behavior");
  }

  const tokens = fs.readFileSync(path.join(product, "src/theme/tokens.ts"), "utf8");
  if (!tokens.includes('name: "Reuse Probe"')) {
    fail("generated theme tokens do not carry the new product identity");
  }
  if (tokens.includes('name: "JWT Scanner"')) {
    fail("generated theme tokens reuse the JWT Scanner product name");
  }

  const manifest = fs.readFileSync(path.join(product, "product.manifest.ts"), "utf8");
  if (!manifest.includes('primaryArchetype: "generator"') || !manifest.includes('"reporting"')) {
    fail("generated manifest did not record the requested archetype/capability");
  }

  const packageJson = JSON.parse(fs.readFileSync(path.join(product, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
  };
  if (packageJson.dependencies?.["@forge/reporting"] !== "workspace:*") {
    fail("reporting capability did not add @forge/reporting");
  }
  if (packageJson.dependencies?.stripe !== undefined || packageJson.dependencies?.["@clerk/nextjs"] !== undefined) {
    fail("generated package.json contains a vendor SDK");
  }

  console.log(
    `create-product check passed: scaffolded reuse-probe (${REQUIRED_FILES.length} required files, generator + reporting).`,
  );
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
