import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC_DIR = join(PACKAGE_DIR, "src");
function filesIn(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesIn(path) : entry.endsWith(".ts") ? [path] : [];
  });
}
function imports(source: string): string[] {
  return [...source.matchAll(/(?:import|export)[\s\S]*?from\s+["']([^"']+)["']/g)]
    .map((match) => match[1]);
}
const sourceFiles = filesIn(SRC_DIR);
const manifest = JSON.parse(readFileSync(join(PACKAGE_DIR, "package.json"), "utf8")) as {
  name: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string>;
};

describe("@forge/adapter-stripe boundaries", () => {
  it("contains only the expected implementation files", () => {
    expect(sourceFiles.map((file) => relative(SRC_DIR, file)).sort()).toEqual([
      "adapter.ts", "index.ts", "webhook.ts",
    ]);
  });
  it("imports only BillingPort, Stripe, shared, or relative modules", () => {
    const allowed = ["@forge/billing", "@forge/shared", "stripe"];
    const violations = sourceFiles.flatMap((file) =>
      imports(readFileSync(file, "utf8"))
        .filter((specifier) => !specifier.startsWith(".") && !allowed.includes(specifier))
        .map((specifier) => `${relative(PACKAGE_DIR, file)}: ${specifier}`)
    );
    expect(violations).toEqual([]);
  });
  it("declares exactly the permitted dependencies", () => {
    expect(manifest.name).toBe("@forge/adapter-stripe");
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual([
      "@forge/billing", "@forge/shared", "stripe",
    ]);
    expect(Object.keys(manifest.devDependencies ?? {}).sort()).toEqual([
      "@forge/testing", "typescript", "vitest",
    ]);
  });
  it("does not reference foreign Forge ports or provider stacks", () => {
    const source = sourceFiles.map((file) => readFileSync(file, "utf8")).join("\n");
    expect([...new Set(imports(source).filter((specifier) => specifier.startsWith("@forge/")))])
      .toEqual(["@forge/billing"]);
    expect(source).not.toMatch(/resend|clerk|pg-boss|bullmq|redis|posthog|drizzle|prisma/i);
  });
});
