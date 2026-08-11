/**
 * JWT Scanner — provider neutrality / vendor isolation tests (P5, P21).
 *
 * The product must remain provider-independent at the package level: no
 * vendor SDKs appear anywhere in the product; adapter packages are imported
 * only by the composition root (src/providers.ts); and domain code stays free
 * of infrastructure. arch-check enforces this statically for the whole
 * repository; these tests pin the product-level contract so a regression in
 * this product fails fast in its own test run.
 *
 * Day 13 (Task 013) wires the authentication and billing adapters through
 * src/providers.ts — the product manifest now declares @forge/adapter-clerk
 * and @forge/adapter-stripe (the only adapter dependencies it may declare),
 * and providers.ts is the only file allowed to import them.
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

/** The adapter packages the composition root may depend on (Task 013). */
const WIRED_ADAPTERS = ["@forge/adapter-clerk", "@forge/adapter-stripe"];

function walk(directory: string, files: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".turbo" || entry.name === ".next") continue;
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) walk(entryPath, files);
    else if (entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name)) files.push(entryPath);
  }
  return files;
}

describe("jwt-scanner provider neutrality", () => {
  it("declares no vendor SDK dependencies and only the wired adapters", () => {
    const packageJson = JSON.parse(
      readFileSync(join(PRODUCT_ROOT, "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    const dependencies = packageJson.dependencies ?? {};
    for (const dependency of Object.keys(dependencies)) {
      const isVendor = VENDOR_ROOTS.some(
        (vendor) => dependency === vendor || dependency.startsWith(`${vendor}/`),
      );
      expect(isVendor, `${dependency} must not appear in a product's dependencies`).toBe(false);
      const isAdapter = dependency.startsWith("@forge/adapter-");
      if (isAdapter) {
        expect(WIRED_ADAPTERS, `${dependency} is not a Task 013 wired adapter`).toContain(dependency);
      }
    }
    // The wired adapters must actually be declared.
    for (const adapter of WIRED_ADAPTERS) {
      expect(dependencies[adapter], `${adapter} must be declared for providers.ts`).toBeDefined();
    }
  });

  it("imports adapter packages only from src/providers.ts", () => {
    const sources = walk(join(PRODUCT_ROOT, "src"));
    for (const file of sources) {
      const relative = file.slice(PRODUCT_ROOT.length + 1);
      if (relative === "src/providers.ts") continue;
      // This audit file itself quotes adapter specifiers in string literals.
      if (relative === "src/__tests__/neutrality.test.ts") continue;
      const text = readFileSync(file, "utf8");
      const adapterImports = [...text.matchAll(/from\s+["'](@forge\/adapter-[^"']+)["']/g)].map(
        (match) => match[1],
      );
      expect(adapterImports, `${relative} must not import adapters`).toEqual([]);
    }
  });

  it("imports no vendor SDK anywhere in src", () => {
    const sources = walk(join(PRODUCT_ROOT, "src"));
    for (const file of sources) {
      const relative = file.slice(PRODUCT_ROOT.length + 1);
      const text = readFileSync(file, "utf8");
      for (const vendor of VENDOR_ROOTS) {
        const pattern = new RegExp(`from\\s+["']${vendor.replace(/\//g, "/")}["']`);
        expect(pattern.test(text), `${relative} must not import vendor SDK ${vendor}`).toBe(false);
      }
    }
  });

  it("keeps domain code free of infrastructure and provider imports", () => {
    const domainFiles = walk(join(PRODUCT_ROOT, "src", "domain")).filter((file) =>
      statSync(file).isFile(),
    );
    expect(domainFiles.length).toBeGreaterThan(0);
    for (const file of domainFiles) {
      const text = readFileSync(file, "utf8");
      for (const forbidden of [
        "@forge/db",
        "@forge/ui",
        "@forge/reporting",
        "@forge/auth",
        "@forge/billing",
        "drizzle-orm",
        "next",
        "react",
        ...VENDOR_ROOTS,
      ]) {
        expect(
          text.includes(`from "${forbidden}"`) || text.includes(`from '${forbidden}'`),
          `${file.slice(PRODUCT_ROOT.length + 1)} must not import ${forbidden}`,
        ).toBe(false);
      }
      // No provider names in domain types (P21): the word "stripe"/"clerk"
      // must not appear as an identifier in domain code.
      expect(text).not.toMatch(/\bstripe\b/i);
      expect(text).not.toMatch(/\bclerk\b/i);
    }
  });

  it("wires the auth and billing adapters in the composition root", () => {
    const providers = readFileSync(join(PRODUCT_ROOT, "src", "providers.ts"), "utf8");
    expect(providers).toContain('from "@forge/adapter-clerk"');
    expect(providers).toContain('from "@forge/adapter-stripe"');
    // Feature-facing port exports exist for the app to consume.
    expect(providers).toMatch(/export const authPort/);
    expect(providers).toMatch(/export const billingPort/);
    // The composition root must never expose provider names as product types.
    expect(providers).not.toMatch(/stripePriceId/);
  });
});
