/**
 * JWT Scanner — provider neutrality / vendor isolation tests (P5, P21).
 *
 * The product must remain provider-independent at the package level: no
 * vendor SDKs, no adapter packages, and no adapter imports outside the
 * composition root (src/providers.ts). arch-check enforces this statically
 * for the whole repository; these tests pin the product-level contract so a
 * regression in this product fails fast in its own test run.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCT_ROOT = join(__dirname, "..", "..");

// Vendor SDK roots contained by packages/adapters/* (frozen in the
// architecture checker's ADAPTER_RULES).
const VENDOR_ROOTS = [
  "@anthropic-ai/sdk",
  "@aws-sdk",
  "@clerk/backend",
  "@clerk/nextjs",
  "@supabase/storage-js",
  "bullmq",
  "ioredis",
  "openai",
  "pg-boss",
  "posthog",
  "posthog-js",
  "posthog-node",
  "resend",
  "stripe",
  "svix",
];

function walk(directory: string, files: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".turbo") continue;
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) walk(entryPath, files);
    else if (entry.isFile() && /\.(?:[cm]?[jt]sx?)$/.test(entry.name)) files.push(entryPath);
  }
  return files;
}

describe("jwt-scanner provider neutrality", () => {
  it("declares no vendor SDK or adapter dependencies", () => {
    const packageJson = JSON.parse(
      readFileSync(join(PRODUCT_ROOT, "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    const dependencies = packageJson.dependencies ?? {};
    for (const dependency of Object.keys(dependencies)) {
      expect(
        dependency.startsWith("@forge/adapter-") || VENDOR_ROOTS.some((vendor) => dependency === vendor || dependency.startsWith(`${vendor}/`)),
        `${dependency} must not appear in a product's dependencies`,
      ).toBe(false);
    }
  });

  it("never imports adapter packages outside src/providers.ts", () => {
    const sources = walk(join(PRODUCT_ROOT, "src"));
    for (const file of sources) {
      const relative = file.slice(PRODUCT_ROOT.length + 1);
      if (relative === "src/providers.ts") continue;
      const text = readFileSync(file, "utf8");
      const adapterImports = [...text.matchAll(/from\s+["'](@forge\/adapter-[^"']+)["']/g)].map(
        (match) => match[1],
      );
      expect(adapterImports, `${relative} must not import adapters`).toEqual([]);
    }
  });

  it("keeps domain code free of infrastructure imports", () => {
    const domainFiles = walk(join(PRODUCT_ROOT, "src", "domain")).filter((file) =>
      statSync(file).isFile(),
    );
    expect(domainFiles.length).toBeGreaterThan(0);
    for (const file of domainFiles) {
      const text = readFileSync(file, "utf8");
      for (const forbidden of ["@forge/db", "@forge/ui", "@forge/reporting", "drizzle-orm", "next", "react"]) {
        expect(
          text.includes(`from "${forbidden}"`) || text.includes(`from '${forbidden}'`),
          `${file.slice(PRODUCT_ROOT.length + 1)} must not import ${forbidden}`,
        ).toBe(false);
      }
    }
  });

  it("wires no adapters in the composition root at the Day-11 milestone", () => {
    const providers = readFileSync(join(PRODUCT_ROOT, "src", "providers.ts"), "utf8");
    // The composition root must not import anything at this milestone —
    // documentation may mention adapter package names, imports may not.
    expect(providers).not.toMatch(/^import\s/m);
    expect(providers).toContain("composition root");
  });
});
