import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { ExtractError, extractProduct } from "../src/index.js";
import { classifyDependency, classifyFile } from "../src/classify.js";
import { safeDestinationPath } from "../src/scan.js";
import type { SourceImport } from "../src/scan.js";

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

function imports(...specifiers: string[]): SourceImport[] {
  return specifiers.map((specifier, index) => ({ specifier, line: index + 1, column: 1 }));
}

function simpleSource(): string {
  const source = tempDir("forge-extract-simple-");
  write(source, "package.json", JSON.stringify({ name: "legacy-app", version: "1.0.0", dependencies: { react: "^18.3.1" } }));
  write(source, "src/utils.ts", "export function double(n: number): number {\n  return n * 2;\n}\n");
  write(source, "README.md", "# Legacy App\n\nDocs.\n");
  return source;
}

function vendorSource(): string {
  const source = tempDir("forge-extract-vendor-");
  write(
    source,
    "package.json",
    JSON.stringify({ name: "legacy-app", dependencies: { stripe: "^16.0.0", "@clerk/nextjs": "^5.0.0", resend: "^3.0.0", react: "^18.3.1" } }),
  );
  write(source, "src/billing.ts", 'import Stripe from "stripe";\nexport const client = new Stripe("sk_test_abc");\n');
  write(source, "src/auth.ts", 'import { ClerkProvider } from "@clerk/nextjs";\nexport { ClerkProvider };\n');
  write(source, "src/email.ts", 'import { Resend } from "resend";\nexport const resend = new Resend("key");\n');
  return source;
}

function databaseSource(): string {
  const source = tempDir("forge-extract-db-");
  write(source, "src/db.ts", 'import { drizzle } from "drizzle-orm/postgres-js";\nexport const db = drizzle("postgres://localhost");\n');
  return source;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("extract-product basic extraction", () => {
  it("extracts a simple valid source into a Forge product", () => {
    const source = simpleSource();
    const destination = path.join(tempDir("forge-extract-out-"), "legacy-app");
    const result = extractProduct({ source, destination, primaryArchetype: "analyzer" });
    expect(result.report.status).toBe("complete");
    for (const file of [
      "product.manifest.ts",
      "src/providers.ts",
      "package.json",
      "README.md",
      "extraction-report.json",
      "extraction-report.md",
    ]) {
      expect(fs.existsSync(path.join(destination, file)), file).toBe(true);
    }
    for (const document of ["ARCHITECTURE.md", "SETUP.md", "DEPLOYMENT.md", "DATABASE.md", "PROVIDERS.md", "API.md", "TESTING.md", "SECURITY.md", "OPERATIONS.md", "ACQUISITION.md"]) {
      expect(fs.existsSync(path.join(destination, "docs", document)), document).toBe(true);
    }
    expect(fs.readFileSync(path.join(destination, "src/utils.ts"), "utf8")).toContain("double");
    expect(result.report.filesCopied).toContain("src/utils.ts");
    expect(result.report.filesCopied).toContain("README.md");
    expect(result.report.manualMigrationItems).toHaveLength(0);
  });

  it("keeps the source README and required docs when present", () => {
    const source = simpleSource();
    write(source, "docs/PROVIDERS.md", "# Legacy providers\n\nContent from the source.\n");
    const destination = path.join(tempDir("forge-extract-out-"), "legacy-app");
    extractProduct({ source, destination, primaryArchetype: "analyzer" });
    expect(fs.readFileSync(path.join(destination, "README.md"), "utf8")).toContain("Legacy App");
    expect(fs.readFileSync(path.join(destination, "docs/PROVIDERS.md"), "utf8")).toContain("Legacy providers");
    expect(fs.readFileSync(path.join(destination, "docs/SETUP.md"), "utf8")).toContain("Setup");
  });

  it("archives the source package.json and generates a Forge package.json", () => {
    const source = simpleSource();
    const destination = path.join(tempDir("forge-extract-out-"), "legacy-app");
    const result = extractProduct({ source, destination, primaryArchetype: "analyzer" });
    expect(fs.existsSync(path.join(destination, "package.original.json"))).toBe(true);
    const generated = JSON.parse(fs.readFileSync(path.join(destination, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(generated.dependencies["@forge/config"]).toBe("workspace:*");
    expect(generated.dependencies.react).toBe("^18.3.1");
    expect(generated.dependencies.stripe).toBeUndefined();
    expect(result.report.filesTransformed).toContain("package.json");
    expect(result.report.filesTransformed).toContain("package.original.json");
  });

  it("generates a static valid product manifest with the product identity", () => {
    const source = simpleSource();
    const destination = path.join(tempDir("forge-extract-out-"), "my-legacy-app");
    const result = extractProduct({ source, destination, productId: "my-legacy-app", primaryArchetype: "gateway" });
    const manifestSource = fs.readFileSync(path.join(destination, "product.manifest.ts"), "utf8");
    expect(manifestSource).toContain('id: "my-legacy-app"');
    expect(manifestSource).toContain('primaryArchetype: "gateway"');
    expect(result.report.productId).toBe("my-legacy-app");
  });

  it("derives the product id from the destination directory name", () => {
    const source = tempDir("forge-extract-name-src-");
    write(source, "src/utils.ts", "export const x = 1;\n");
    const destination = path.join(tempDir("forge-extract-out-"), "my-cool-app");
    const result = extractProduct({ source, destination, primaryArchetype: "analyzer" });
    expect(result.report.productId).toBe("my-cool-app");
    expect(result.report.warnings.some((warning) => warning.includes("destination directory name"))).toBe(true);
  });

  it("defaults the archetype and flags it as a manual migration item", () => {
    const source = simpleSource();
    const destination = path.join(tempDir("forge-extract-out-"), "legacy-app");
    const result = extractProduct({ source, destination });
    expect(result.report.status).toBe("complete-with-manual-migration");
    const item = result.report.manualMigrationItems.find((entry) => entry.id === "archetype-review");
    expect(item).toBeDefined();
    expect(item?.blocking).toBe(false);
  });
});

describe("extract-product classification", () => {
  it("classifies a vendor integration as REVIEW with a provider integration", () => {
    const source = vendorSource();
    const destination = path.join(tempDir("forge-extract-out-"), "legacy-app");
    const result = extractProduct({ source, destination, primaryArchetype: "analyzer" });
    const billing = result.report.filesDiscovered.find((file) => file.path === "src/billing.ts");
    expect(billing?.classification).toBe("REVIEW");
    expect(billing?.vendorImports).toEqual(["stripe"]);
    const stripe = result.report.providerIntegrations.find((entry) => entry.vendor === "stripe");
    expect(stripe?.category).toBe("billing");
    expect(stripe?.port).toBe("@forge/billing");
    expect(stripe?.files).toEqual(["src/billing.ts"]);
    expect(result.report.architectureViolations.some((entry) => entry.file === "src/billing.ts")).toBe(true);
  });

  it("classifies database integration as REVIEW with port 'database'", () => {
    const source = databaseSource();
    const destination = path.join(tempDir("forge-extract-out-"), "db-app");
    const result = extractProduct({ source, destination, primaryArchetype: "analyzer" });
    const db = result.report.filesDiscovered.find((file) => file.path === "src/db.ts");
    expect(db?.classification).toBe("REVIEW");
    const integration = result.report.providerIntegrations.find((entry) => entry.vendor === "drizzle-orm");
    expect(integration?.port).toBe("database");
  });

  it("finds multiple provider integrations", () => {
    const source = vendorSource();
    const destination = path.join(tempDir("forge-extract-out-"), "legacy-app");
    const result = extractProduct({ source, destination, primaryArchetype: "analyzer" });
    expect(result.report.providerIntegrations.map((entry) => entry.vendor).sort()).toEqual([
      "@clerk/nextjs",
      "resend",
      "stripe",
    ]);
    expect(result.report.manualMigrationItems.some((entry) => entry.id === "provider-stripe")).toBe(true);
  });

  it("classifies ambiguous dynamic code as MANUAL with remediation", () => {
    const source = tempDir("forge-extract-ambiguous-");
    write(source, "src/plugin.ts", 'export async function load(name: string) {\n  return import(name);\n}\n');
    const destination = path.join(tempDir("forge-extract-out-"), "ambiguous-app");
    const result = extractProduct({ source, destination, primaryArchetype: "analyzer" });
    const plugin = result.report.filesDiscovered.find((file) => file.path === "src/plugin.ts");
    expect(plugin?.classification).toBe("MANUAL");
    const item = result.report.manualMigrationItems.find((entry) => entry.area === "src/plugin.ts");
    expect(item).toBeDefined();
    expect(item?.blocking).toBe(true);
    expect(item?.remediation.length).toBeGreaterThan(10);
  });

  it("classifies hardcoded secrets as MANUAL", () => {
    const source = tempDir("forge-extract-secret-");
    write(source, "src/config.ts", 'export const key = "sk_live_1234567890abcdef1234";\n');
    const destination = path.join(tempDir("forge-extract-out-"), "secret-app");
    const result = extractProduct({ source, destination, primaryArchetype: "analyzer" });
    const config = result.report.filesDiscovered.find((file) => file.path === "src/config.ts");
    expect(config?.classification).toBe("MANUAL");
  });

  it("classifies dependencies deterministically", () => {
    expect(classifyDependency("node:fs")).toEqual({ classification: "SAFE", category: "builtin" });
    expect(classifyDependency("react")).toEqual({ classification: "SAFE", category: "framework-utility" });
    expect(classifyDependency("@types/node")).toEqual({ classification: "SAFE", category: "types" });
    expect(classifyDependency("stripe").classification).toBe("REVIEW");
    expect(classifyDependency("drizzle-orm").classification).toBe("REVIEW");
    expect(classifyDependency("prisma").classification).toBe("MANUAL");
    expect(classifyDependency("some-unknown-pkg").classification).toBe("REVIEW");
  });

  it("classifies files deterministically", () => {
    const safe = classifyFile({
      relativePath: "src/lib/math.ts",
      kind: "code",
      imports: [],
      dynamicSpecifiers: [],
      content: "export const two = 2;\n",
    });
    expect(safe.classification).toBe("SAFE");

    const vendor = classifyFile({
      relativePath: "src/lib/vendor.ts",
      kind: "code",
      imports: imports("stripe"),
      dynamicSpecifiers: [],
      content: "export {};\n",
    });
    expect(vendor.classification).toBe("REVIEW");

    const domainVendor = classifyFile({
      relativePath: "src/domain/engine.ts",
      kind: "code",
      imports: imports("openai"),
      dynamicSpecifiers: [],
      content: "export {};\n",
    });
    expect(domainVendor.classification).toBe("MANUAL");

    const deep = classifyFile({
      relativePath: "src/app.ts",
      kind: "code",
      imports: imports("stripe", "resend", "posthog"),
      dynamicSpecifiers: [],
      content: "export {};\n",
    });
    expect(deep.classification).toBe("MANUAL");
  });
});

describe("extract-product report", () => {
  it("produces a machine-readable report with the required fields", () => {
    const source = vendorSource();
    const destination = path.join(tempDir("forge-extract-out-"), "legacy-app");
    const result = extractProduct({ source, destination, primaryArchetype: "analyzer" });
    const report = result.report;
    expect(report.schemaVersion).toBe(1);
    expect(report.source).toBe(source);
    expect(report.destination).toBe(destination);
    expect(report.productId).toBe("legacy-app");
    expect(Array.isArray(report.filesDiscovered)).toBe(true);
    expect(Array.isArray(report.filesCopied)).toBe(true);
    expect(Array.isArray(report.filesTransformed)).toBe(true);
    expect(Array.isArray(report.providerIntegrations)).toBe(true);
    expect(Array.isArray(report.dependencyClassifications)).toBe(true);
    expect(Array.isArray(report.architectureViolations)).toBe(true);
    expect(Array.isArray(report.manualMigrationItems)).toBe(true);
    expect(Array.isArray(report.warnings)).toBe(true);
    expect(Array.isArray(report.errors)).toBe(true);
    expect(["complete", "complete-with-manual-migration", "failed"]).toContain(report.status);
    const onDisk = JSON.parse(fs.readFileSync(result.reportJsonPath, "utf8")) as typeof report;
    expect(onDisk).toEqual(report);
  });

  it("is deterministic for identical inputs", () => {
    const source = vendorSource();
    const destinationA = path.join(tempDir("forge-extract-out-"), "legacy-app");
    const destinationB = path.join(tempDir("forge-extract-out-"), "legacy-app");
    const resultA = extractProduct({ source, destination: destinationA, primaryArchetype: "analyzer" });
    const resultB = extractProduct({ source, destination: destinationB, primaryArchetype: "analyzer" });
    const reportA = { ...resultA.report, destination: "<dest>" };
    const reportB = { ...resultB.report, destination: "<dest>" };
    expect(JSON.stringify(reportA)).toBe(JSON.stringify(reportB));
    const filesA = fs.readdirSync(destinationA, { recursive: true }) as string[];
    for (const relative of filesA) {
      const absoluteA = path.join(destinationA, relative);
      if (!fs.statSync(absoluteA).isFile()) continue;
      const absoluteB = path.join(destinationB, relative);
      if (relative === "extraction-report.json" || relative === "extraction-report.md") {
        // Reports embed the destination path; compare with it normalized.
        const textA = fs.readFileSync(absoluteA, "utf8").replaceAll(destinationA, "<dest>");
        const textB = fs.readFileSync(absoluteB, "utf8").replaceAll(destinationB, "<dest>");
        expect(textA, relative).toBe(textB);
      } else {
        expect(fs.readFileSync(absoluteA), relative).toEqual(fs.readFileSync(absoluteB));
      }
    }
  });
});

describe("extract-product safety", () => {
  it("refuses a missing source", () => {
    const source = path.join(tempDir("forge-extract-"), "missing");
    const destination = path.join(tempDir("forge-extract-out-"), "out");
    expect(() => extractProduct({ source, destination })).toThrow(ExtractError);
    expect(fs.existsSync(destination)).toBe(false);
  });

  it("refuses an existing destination", () => {
    const source = simpleSource();
    const destination = tempDir("forge-extract-existing-");
    expect(() => extractProduct({ source, destination })).toThrow(/already exists/);
  });

  it("refuses a destination inside the source", () => {
    const source = simpleSource();
    const destination = path.join(source, "nested");
    expect(() => extractProduct({ source, destination })).toThrow(/inside/);
  });

  it("refuses the source as destination (duplicate)", () => {
    const source = simpleSource();
    expect(() => extractProduct({ source, destination: source })).toThrow(/already exists|inside/);
  });

  it("does not follow symbolic links in the source", () => {
    const source = tempDir("forge-extract-symlink-");
    const outside = tempDir("forge-extract-outside-");
    write(outside, "secret.txt", "outside content");
    write(source, "src/utils.ts", "export const x = 1;\n");
    fs.symlinkSync(path.join(outside, "secret.txt"), path.join(source, "leak.txt"));
    fs.symlinkSync(outside, path.join(source, "linked-dir"));
    const destination = path.join(tempDir("forge-extract-out-"), "safe-app");
    const result = extractProduct({ source, destination, primaryArchetype: "analyzer" });
    expect(fs.existsSync(path.join(destination, "leak.txt"))).toBe(false);
    expect(fs.existsSync(path.join(destination, "linked-dir"))).toBe(false);
    expect(result.report.warnings.some((warning) => warning.includes("symbolic link"))).toBe(true);
  });

  it("excludes lockfiles, env files and credentials", () => {
    const source = tempDir("forge-extract-env-");
    write(source, "src/utils.ts", "export const x = 1;\n");
    write(source, "package-lock.json", "{}");
    write(source, ".env", "STRIPE_SECRET=sk_live_1234567890abcdef1234");
    write(source, ".env.example", "STRIPE_SECRET=sk_live_xxx");
    write(source, "credentials.json", "{\"private_key\": \"x\"}");
    const destination = path.join(tempDir("forge-extract-out-"), "env-app");
    const result = extractProduct({ source, destination, primaryArchetype: "analyzer" });
    expect(fs.existsSync(path.join(destination, "package-lock.json"))).toBe(false);
    expect(fs.existsSync(path.join(destination, ".env"))).toBe(false);
    expect(fs.existsSync(path.join(destination, "credentials.json"))).toBe(false);
    expect(fs.existsSync(path.join(destination, ".env.example"))).toBe(true);
    expect(result.report.filesExcluded).toContain(".env");
  });

  it("never writes outside the destination (safe path join)", () => {
    const destination = tempDir("forge-extract-safe-");
    expect(() => safeDestinationPath(destination, "../escape.txt")).toThrow(/outside/);
    expect(fs.existsSync(path.join(path.dirname(destination), "escape.txt"))).toBe(false);
  });
});

describe("extract-product CLI", () => {
  const cli = path.resolve("dist/cli.js");

  it("exits 0 for a valid extraction", () => {
    const source = simpleSource();
    const destination = path.join(tempDir("forge-extract-out-"), "cli-app");
    const run = spawnSync(process.execPath, [cli, "--root", process.cwd(), source, destination, "--archetype", "analyzer"], { encoding: "utf8" });
    expect(run.status).toBe(0);
    expect(fs.existsSync(path.join(destination, "product.manifest.ts"))).toBe(true);
  });

  it("exits 2 when arguments are missing", () => {
    const run = spawnSync(process.execPath, [cli], { encoding: "utf8" });
    expect(run.status).toBe(2);
  });

  it("exits 1 for a missing source", () => {
    const source = path.join(tempDir("forge-extract-"), "nope");
    const destination = path.join(tempDir("forge-extract-out-"), "out");
    const run = spawnSync(process.execPath, [cli, source, destination], { encoding: "utf8" });
    expect(run.status).toBe(1);
    expect(fs.existsSync(destination)).toBe(false);
  });
});
