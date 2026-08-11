import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { validateProductManifest } from "@forge/config";
import { generateProduct, resolveSpec } from "../src/index.js";
import { buildProductFileMap, REQUIRED_PRODUCT_DOCUMENTS } from "../src/templates.js";

const temporaryRoots: string[] = [];

function createRepository(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-create-product-"));
  temporaryRoots.push(root);
  fs.mkdirSync(path.join(root, "apps"));
  fs.mkdirSync(path.join(root, "packages"));
  fs.writeFileSync(path.join(root, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n  - "packages/*"\n  - "packages/adapters/*"\n  - "tools/*"\n');
  return root;
}

function manifestOf(root: string, product: string): Record<string, unknown> {
  const source = fs.readFileSync(path.join(root, "apps", product, "product.manifest.ts"), "utf8");
  // Minimal extraction for tests: find the object literal between the first
  // "{" after defineProductManifest and its matching "}".
  const start = source.indexOf("defineProductManifest(") + "defineProductManifest(".length;
  const body = source.slice(start);
  const open = body.indexOf("{");
  const close = body.lastIndexOf("}");
  const literal = body.slice(open, close + 1);
  // eslint-disable-next-line no-eval
  return eval(`(${literal})`) as Record<string, unknown>;
}

function wordCount(markdown: string): number {
  return (markdown.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("create-product name validation", () => {
  it("accepts a valid slug product name", () => {
    const spec = resolveSpec({ root: createRepository(), name: "jwt-scanner" });
    expect(spec.id).toBe("jwt-scanner");
    expect(spec.displayName).toBe("Jwt Scanner");
  });

  it("rejects invalid product names", () => {
    const root = createRepository();
    for (const name of ["", "Bad Name", "-leading", "trailing-", "UPPER", "under_score", "name!"]) {
      expect(() => resolveSpec({ root, name })).toThrow(/Invalid product name/);
    }
  });

  it("rejects an invalid archetype", () => {
    const root = createRepository();
    expect(() => resolveSpec({ root, name: "demo", primaryArchetype: "compiler" })).toThrow(/Invalid archetype/);
  });

  it("rejects an invalid capability", () => {
    const root = createRepository();
    expect(() => resolveSpec({ root, name: "demo", capabilities: ["magic"] })).toThrow(/Invalid capability/);
  });
});

describe("create-product generation", () => {
  it("generates the required directory structure", () => {
    const root = createRepository();
    const result = generateProduct({ root, name: "demo" });
    expect(result.relativeProductPath).toBe("apps/demo");
    const product = result.productPath;
    for (const file of [
      "product.manifest.ts",
      "README.md",
      "package.json",
      "tsconfig.json",
      "src/providers.ts",
      "src/domain/engine.ts",
      "src/domain/types.ts",
      "src/domain/schemas.ts",
      "src/domain/__tests__/engine.test.ts",
      "src/app/README.md",
      "src/features/README.md",
      "src/db/README.md",
      "src/theme/README.md",
    ]) {
      expect(fs.existsSync(path.join(product, file)), file).toBe(true);
    }
    expect(fs.existsSync(path.join(product, "src/worker"))).toBe(false);
    expect(result.filesWritten.length).toBeGreaterThan(20);
  });

  it("generates a valid product manifest", () => {
    const root = createRepository();
    generateProduct({ root, name: "demo", capabilities: ["reporting"], requiresWorker: true });
    const manifest = manifestOf(root, "demo");
    const validated = validateProductManifest(manifest);
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      expect(validated.value.id).toBe("demo");
      expect(validated.value.primaryArchetype).toBe("analyzer");
      expect(validated.value.capabilities).toEqual(["reporting"]);
      expect(validated.value.requiresWorker).toBe(true);
    }
  });

  it("reflects archetype and capability flags in the manifest", () => {
    const root = createRepository();
    generateProduct({ root, name: "opt", primaryArchetype: "optimizer", capabilities: ["reporting", "scheduling"] });
    const manifest = manifestOf(root, "opt");
    expect(manifest.primaryArchetype).toBe("optimizer");
    expect(manifest.capabilities).toEqual(["reporting", "scheduling"]);
  });

  it("generates providers.ts as the isolated composition root", () => {
    const root = createRepository();
    generateProduct({ root, name: "demo" });
    const providers = fs.readFileSync(path.join(root, "apps/demo/src/providers.ts"), "utf8");
    expect(providers).toMatch(/composition root/);
    // The skeleton must contain no actual adapter import statement (the
    // template's doc comment may show an example).
    expect(providers).not.toMatch(/^import[^\n]*from\s+["']@forge\/adapter-/m);
  });

  it("generates useful documentation for all ten required documents", () => {
    const root = createRepository();
    generateProduct({ root, name: "demo" });
    for (const document of REQUIRED_PRODUCT_DOCUMENTS) {
      const content = fs.readFileSync(path.join(root, "apps/demo/docs", document), "utf8");
      expect(wordCount(content), `${document} word count`).toBeGreaterThan(200);
      expect(content).toMatch(/^#\s+\S/m);
      expect(content).toMatch(/^##\s+\S/m);
      expect(content).not.toMatch(/\b(?:FIXME|TBD|TODO)\b|lorem ipsum|to be implemented|placeholder content/i);
    }
    expect(fs.existsSync(path.join(root, "apps/demo/docs/ARCHITECTURE.md"))).toBe(true);
  });

  it("contains no vendor SDK dependency by default", () => {
    const root = createRepository();
    generateProduct({ root, name: "demo", capabilities: ["reporting"] });
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, "apps/demo/package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    const vendors = ["stripe", "@clerk/nextjs", "resend", "posthog", "pg-boss", "bullmq", "openai", "@anthropic-ai/sdk", "@supabase/storage-js"];
    for (const vendor of vendors) {
      expect(packageJson.dependencies[vendor], vendor).toBeUndefined();
    }
    expect(packageJson.dependencies["@forge/config"]).toBe("workspace:*");
  });

  it("declares capability dependencies in package.json", () => {
    const root = createRepository();
    generateProduct({ root, name: "demo", capabilities: ["reporting", "scheduling"], requiresWorker: true });
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, "apps/demo/package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(packageJson.dependencies["@forge/reporting"]).toBe("workspace:*");
    expect(packageJson.dependencies["@forge/jobs"]).toBe("workspace:*");
  });

  it("refuses to overwrite a duplicate product", () => {
    const root = createRepository();
    generateProduct({ root, name: "demo" });
    expect(() => generateProduct({ root, name: "demo" })).toThrow(/already exists/);
  });

  it("is deterministic: identical options produce identical bytes", () => {
    const rootA = createRepository();
    const rootB = createRepository();
    generateProduct({ root: rootA, name: "demo", displayName: "Demo Product", capabilities: ["reporting"] });
    generateProduct({ root: rootB, name: "demo", displayName: "Demo Product", capabilities: ["reporting"] });
    const filesA = fs.readdirSync(path.join(rootA, "apps/demo"), { recursive: true }) as string[];
    for (const relative of filesA) {
      const absoluteA = path.join(rootA, "apps/demo", relative);
      if (!fs.statSync(absoluteA).isFile()) continue;
      const absoluteB = path.join(rootB, "apps/demo", relative);
      expect(fs.existsSync(absoluteB), relative).toBe(true);
      expect(fs.readFileSync(absoluteA, "utf8"), relative).toBe(fs.readFileSync(absoluteB, "utf8"));
    }
  });

  it("scaffolds from an existing manifest via --manifest", () => {
    const root = createRepository();
    const manifestPath = path.join(root, "product.manifest.ts");
    fs.writeFileSync(
      manifestPath,
      [
        'import { defineProductManifest } from "@forge/config";',
        "export default defineProductManifest({",
        '  id: "from-manifest",',
        '  displayName: "From Manifest",',
        '  tagline: "Tagline from manifest.",',
        '  primaryArchetype: "gateway",',
        "  capabilities: [\"ai-assisted\"],",
        "  plans: [],",
        "  requiresWorker: false,",
        "  requiresAIProvider: true,",
        "});",
        "",
      ].join("\n"),
    );
    const result = generateProduct({ root, name: "unused", manifestPath });
    expect(result.manifest.id).toBe("from-manifest");
    expect(result.manifest.primaryArchetype).toBe("gateway");
    expect(fs.existsSync(path.join(root, "apps/from-manifest/product.manifest.ts"))).toBe(true);
  });

  it("rejects a manifest that is not static", () => {
    const root = createRepository();
    const manifestPath = path.join(root, "product.manifest.ts");
    fs.writeFileSync(
      manifestPath,
      'export default defineProductManifest({ id: "x", displayName: process.env.NAME ?? "X", tagline: "t", primaryArchetype: "analyzer", capabilities: [], plans: [], requiresWorker: false, requiresAIProvider: false });\n',
    );
    expect(() => generateProduct({ root, name: "x", manifestPath })).toThrow(/static/);
  });
});

describe("create-product CLI", () => {
  const cli = path.resolve("dist/cli.js");

  it("exits 0 and writes the product for a valid invocation", () => {
    const root = createRepository();
    const run = spawnSync(process.execPath, [cli, "--root", root, "cli-demo"], { encoding: "utf8" });
    expect(run.status).toBe(0);
    expect(fs.existsSync(path.join(root, "apps/cli-demo/product.manifest.ts"))).toBe(true);
  });

  it("exits non-zero for an invalid product name", () => {
    const root = createRepository();
    const run = spawnSync(process.execPath, [cli, "--root", root, "Bad Name"], { encoding: "utf8" });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/Invalid product name/);
  });

  it("exits non-zero for a duplicate product", () => {
    const root = createRepository();
    generateProduct({ root, name: "dup" });
    const run = spawnSync(process.execPath, [cli, "--root", root, "dup"], { encoding: "utf8" });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/already exists/);
  });

  it("exits 2 for usage errors", () => {
    const root = createRepository();
    const run = spawnSync(process.execPath, [cli, "--root", root], { encoding: "utf8" });
    expect(run.status).toBe(2);
  });
});

describe("buildProductFileMap", () => {
  it("produces a stable sorted file map", () => {
    const spec = resolveSpec({ root: createRepository(), name: "demo" });
    const first = buildProductFileMap(spec).map((file) => file.path);
    const second = buildProductFileMap(spec).map((file) => file.path);
    expect(first).toEqual(second);
    expect(first).toEqual([...first].sort());
  });
});
