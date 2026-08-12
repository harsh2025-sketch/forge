import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { checkRepository } from "../src/index.js";

interface FixturePackageOptions {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly source?: string;
  readonly sourceFile?: string;
}

const temporaryRoots: string[] = [];

function createRepository(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-architecture-check-"));
  temporaryRoots.push(root);
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "fixture", private: true }, null, 2));
  fs.writeFileSync(
    path.join(root, "pnpm-workspace.yaml"),
    'packages:\n  - "apps/*"\n  - "packages/*"\n  - "packages/adapters/*"\n  - "tools/*"\n',
  );
  return root;
}

function addPackage(
  root: string,
  relativePath: string,
  name: string,
  options: FixturePackageOptions = {},
): void {
  const packageRoot = path.join(root, relativePath);
  const sourceFile = options.sourceFile ?? "src/index.ts";
  fs.mkdirSync(path.join(packageRoot, path.dirname(sourceFile)), { recursive: true });
  fs.writeFileSync(
    path.join(packageRoot, "package.json"),
    JSON.stringify(
      {
        name,
        version: "0.0.1",
        type: "module",
        ...(options.dependencies === undefined ? {} : { dependencies: options.dependencies }),
        ...(options.devDependencies === undefined ? {} : { devDependencies: options.devDependencies }),
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(path.join(packageRoot, sourceFile), options.source ?? "export {};\n");
}

function rules(root: string): string[] {
  return checkRepository({ root }).errors.map((error) => error.rule);
}

function workspace(...names: string[]): Record<string, string> {
  return Object.fromEntries(names.map((name) => [name, "workspace:*"]));
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("valid frozen V3 dependency relationships", () => {
  it("allows domain and other lower layers to consume shared", () => {
    const root = createRepository();
    addPackage(root, "packages/shared", "@forge/shared");
    addPackage(root, "packages/domain", "@forge/domain", {
      dependencies: workspace("@forge/shared"),
      source: 'import type { Result } from "@forge/shared";\nexport type DomainResult = Result<string, string>;\n',
    });
    expect(checkRepository({ root }).errors).toEqual([]);
  });

  it("allows an adapter to consume its own port, shared, and vendor SDK", () => {
    const root = createRepository();
    addPackage(root, "packages/shared", "@forge/shared");
    addPackage(root, "packages/billing", "@forge/billing");
    addPackage(root, "packages/adapters/stripe", "@forge/adapter-stripe", {
      dependencies: {
        ...workspace("@forge/billing", "@forge/shared"),
        stripe: "1.0.0",
      },
      source:
        'import type { BillingPort } from "@forge/billing";\nimport type { Result } from "@forge/shared";\nimport Stripe from "stripe";\nexport type Adapter = BillingPort & Result<Stripe, string>;\n',
    });
    expect(checkRepository({ root }).errors).toEqual([]);
  });

  it("allows testing to consume every port package and shared", () => {
    const root = createRepository();
    addPackage(root, "packages/shared", "@forge/shared");
    const ports = ["ai-provider", "analytics", "auth", "billing", "email", "jobs", "storage"];
    for (const port of ports) addPackage(root, `packages/${port}`, `@forge/${port}`);
    addPackage(root, "packages/testing", "@forge/testing", {
      dependencies: workspace("@forge/shared", ...ports.map((port) => `@forge/${port}`)),
      source: ports.map((port) => `import type {} from "@forge/${port}";`).join("\n"),
    });
    expect(checkRepository({ root }).errors).toEqual([]);
  });

  it("allows reporting to consume domain and shared", () => {
    const root = createRepository();
    addPackage(root, "packages/shared", "@forge/shared");
    addPackage(root, "packages/domain", "@forge/domain");
    addPackage(root, "packages/reporting", "@forge/reporting", {
      dependencies: workspace("@forge/domain", "@forge/shared"),
      source: 'import type {} from "@forge/domain";\nimport type {} from "@forge/shared";\n',
    });
    expect(checkRepository({ root }).errors).toEqual([]);
  });

  it("allows UI to consume React and React DOM", () => {
    const root = createRepository();
    addPackage(root, "packages/ui", "@forge/ui", {
      dependencies: { react: "18.0.0", "react-dom": "18.0.0" },
      source: 'import React from "react";\nimport { renderToString } from "react-dom/server";\nexport const render = () => renderToString(React.createElement("div"));\n',
    });
    expect(checkRepository({ root }).errors).toEqual([]);
  });
});

describe("invalid frozen V3 dependency relationships", () => {
  it("rejects a port importing an adapter", () => {
    const root = createRepository();
    addPackage(root, "packages/auth", "@forge/auth", {
      dependencies: workspace("@forge/adapter-clerk"),
      source: 'import type {} from "@forge/adapter-clerk";\n',
    });
    addPackage(root, "packages/adapters/clerk", "@forge/adapter-clerk");
    expect(rules(root)).toContain("PORT_TO_ADAPTER");
  });

  it("rejects one adapter importing another adapter", () => {
    const root = createRepository();
    addPackage(root, "packages/adapters/clerk", "@forge/adapter-clerk", {
      dependencies: workspace("@forge/adapter-stripe"),
      source: 'import type {} from "@forge/adapter-stripe";\n',
    });
    addPackage(root, "packages/adapters/stripe", "@forge/adapter-stripe");
    expect(rules(root)).toContain("ADAPTER_TO_ADAPTER");
  });

  it("rejects an adapter importing a foreign port", () => {
    const root = createRepository();
    addPackage(root, "packages/billing", "@forge/billing");
    addPackage(root, "packages/adapters/clerk", "@forge/adapter-clerk", {
      dependencies: workspace("@forge/billing"),
      source: 'import type {} from "@forge/billing";\n',
    });
    expect(rules(root)).toContain("ADAPTER_TO_FOREIGN_PORT");
  });

  it("rejects vendor SDK leakage outside its owning adapter", () => {
    const root = createRepository();
    addPackage(root, "packages/domain", "@forge/domain", {
      dependencies: { stripe: "1.0.0" },
      source: 'import Stripe from "stripe";\nexport type Leaked = Stripe;\n',
    });
    expect(rules(root)).toContain("VENDOR_LEAKAGE");
  });

  it("rejects a vendor SDK in the testing package", () => {
    const root = createRepository();
    addPackage(root, "packages/testing", "@forge/testing", {
      dependencies: { "@clerk/backend": "1.0.0" },
      source: 'import { createClerkClient } from "@clerk/backend";\nexport { createClerkClient };\n',
    });
    expect(rules(root)).toContain("VENDOR_LEAKAGE");
  });

  it("rejects database access from the testing package", () => {
    const root = createRepository();
    addPackage(root, "packages/db", "@forge/db");
    addPackage(root, "packages/testing", "@forge/testing", {
      dependencies: workspace("@forge/db"),
      source: 'import type {} from "@forge/db";\n',
    });
    expect(rules(root)).toContain("TESTING_INFRASTRUCTURE");
  });

  it("rejects reporting importing an adapter", () => {
    const root = createRepository();
    addPackage(root, "packages/adapters/stripe", "@forge/adapter-stripe");
    addPackage(root, "packages/reporting", "@forge/reporting", {
      dependencies: workspace("@forge/adapter-stripe"),
      source: 'import type {} from "@forge/adapter-stripe";\n',
    });
    expect(rules(root)).toContain("REPORTING_BOUNDARY");
  });

  it("rejects reporting importing a provider SDK", () => {
    const root = createRepository();
    addPackage(root, "packages/reporting", "@forge/reporting", {
      dependencies: { resend: "1.0.0" },
      source: 'import { Resend } from "resend";\nexport { Resend };\n',
    });
    expect(rules(root)).toContain("VENDOR_LEAKAGE");
  });

  it("rejects UI importing a Forge backend port", () => {
    const root = createRepository();
    addPackage(root, "packages/auth", "@forge/auth");
    addPackage(root, "packages/ui", "@forge/ui", {
      dependencies: workspace("@forge/auth"),
      source: 'import type {} from "@forge/auth";\n',
    });
    expect(rules(root)).toContain("UI_BOUNDARY");
  });

  it("rejects UI importing a provider adapter", () => {
    const root = createRepository();
    addPackage(root, "packages/adapters/clerk", "@forge/adapter-clerk");
    addPackage(root, "packages/ui", "@forge/ui", {
      dependencies: workspace("@forge/adapter-clerk"),
      source: 'import type {} from "@forge/adapter-clerk";\n',
    });
    expect(rules(root)).toContain("UI_BOUNDARY");
  });

  it("rejects prohibited infrastructure", () => {
    const root = createRepository();
    addPackage(root, "packages/config", "@forge/config", {
      dependencies: { ioredis: "1.0.0" },
      source: 'import Redis from "ioredis";\nexport { Redis };\n',
    });
    expect(rules(root)).toContain("PROHIBITED_INFRASTRUCTURE");
  });

  it("rejects an invalid package dependency direction", () => {
    const root = createRepository();
    addPackage(root, "packages/domain", "@forge/domain");
    addPackage(root, "packages/config", "@forge/config", {
      dependencies: workspace("@forge/domain"),
      source: 'import type {} from "@forge/domain";\n',
    });
    expect(rules(root)).toContain("INVALID_DEPENDENCY_DIRECTION");
  });

  it("rejects packages importing applications", () => {
    const root = createRepository();
    addPackage(root, "apps/alpha", "@forge/product-alpha");
    addPackage(root, "packages/reporting", "@forge/reporting", {
      dependencies: workspace("@forge/product-alpha"),
      source: 'import type {} from "@forge/product-alpha";\n',
    });
    expect(rules(root)).toContain("PACKAGE_TO_APPLICATION");
  });

  it("allows providers.ts but rejects adapter bypass elsewhere in an app", () => {
    const root = createRepository();
    addPackage(root, "packages/adapters/clerk", "@forge/adapter-clerk");
    addPackage(root, "apps/alpha", "@forge/product-alpha", {
      dependencies: workspace("@forge/adapter-clerk"),
      sourceFile: "src/providers.ts",
      source: 'import type {} from "@forge/adapter-clerk";\n',
    });
    fs.writeFileSync(
      path.join(root, "apps/alpha/src/feature.ts"),
      'import type {} from "@forge/adapter-clerk";\n',
    );
    const report = checkRepository({ root });
    const bypasses = report.errors.filter((error) => error.rule === "ADAPTER_BYPASS");
    expect(bypasses).toHaveLength(1);
    expect(bypasses[0]?.file).toBe("apps/alpha/src/feature.ts");
  });

  it("detects circular workspace dependencies", () => {
    const root = createRepository();
    addPackage(root, "packages/config", "@forge/config", {
      dependencies: workspace("@forge/domain"),
      source: 'import type {} from "@forge/domain";\n',
    });
    addPackage(root, "packages/domain", "@forge/domain", {
      dependencies: workspace("@forge/config"),
      source: 'import type {} from "@forge/config";\n',
    });
    expect(rules(root)).toContain("CIRCULAR_PACKAGE_DEPENDENCY");
  });

  it("rejects package manifests outside frozen workspace locations", () => {
    const root = createRepository();
    addPackage(root, "libs/rogue", "@forge/rogue");
    expect(rules(root)).toContain("WORKSPACE_PLACEMENT");
  });

  it("rejects unresolved Forge imports", () => {
    const root = createRepository();
    addPackage(root, "packages/config", "@forge/config", {
      source: 'import type {} from "@forge/not-a-package";\n',
    });
    expect(rules(root)).toContain("UNKNOWN_INTERNAL_IMPORT");
  });

  it("rejects an undeclared cross-workspace source import", () => {
    const root = createRepository();
    addPackage(root, "packages/shared", "@forge/shared");
    addPackage(root, "packages/domain", "@forge/domain", {
      source: 'import type {} from "@forge/shared";\n',
    });
    expect(rules(root)).toContain("UNDECLARED_WORKSPACE_IMPORT");
  });

  it("allows a tool to depend on another developer tool (Task 010 delegation contract)", () => {
    const root = createRepository();
    addPackage(root, "tools/architecture-check", "@forge/architecture-check");
    addPackage(root, "tools/extraction-validate", "@forge/extraction-validate", {
      dependencies: workspace("@forge/architecture-check"),
      source: 'import { checkRepository } from "@forge/architecture-check";\nexport const check = checkRepository;\n',
    });
    const toolErrors = checkRepository({ root }).errors.filter(
      (error) => error.rule === "TOOL_IMPORT_DIRECTION",
    );
    expect(toolErrors).toEqual([]);
  });

  it("still rejects application and package imports of tools", () => {
    const root = createRepository();
    addPackage(root, "tools/architecture-check", "@forge/architecture-check");
    addPackage(root, "packages/config", "@forge/config", {
      dependencies: workspace("@forge/architecture-check"),
      source: 'import type {} from "@forge/architecture-check";\n',
    });
    expect(rules(root)).toContain("TOOL_IMPORT_DIRECTION");
  });

  it("requires every adapter to declare its own port and shared at runtime", () => {
    const root = createRepository();
    addPackage(root, "packages/adapters/stripe", "@forge/adapter-stripe");
    const contractErrors = checkRepository({ root }).errors.filter(
      (error) => error.rule === "ADAPTER_CONTRACT_DEPENDENCY",
    );
    expect(contractErrors.map((error) => error.specifier).sort()).toEqual([
      "@forge/billing",
      "@forge/shared",
    ]);
  });
});

describe("CLI behavior", () => {
  it("exits non-zero and identifies the offending package, file, and import", () => {
    const root = createRepository();
    addPackage(root, "packages/auth", "@forge/auth", {
      dependencies: { stripe: "1.0.0" },
      source: 'import Stripe from "stripe";\nexport type Leak = Stripe;\n',
    });
    const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
    const result = spawnSync(process.execPath, [cli, "--root", root], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("[VENDOR_LEAKAGE]");
    expect(result.stderr).toContain("packages/auth/src/index.ts");
    expect(result.stderr).toContain("package=@forge/auth");
    expect(result.stderr).toContain('import="stripe"');
  }, 15_000);
});
