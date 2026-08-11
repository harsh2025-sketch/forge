import fs from "node:fs";
import path from "node:path";
import { builtinModules } from "node:module";
import ts from "typescript";
import {
  ADAPTER_RULES,
  DATABASE_IMPORTS,
  DEVELOPMENT_DEPENDENCIES,
  FROZEN_PACKAGE_DIRECTORIES,
  PORT_DIRECTORIES,
  PROHIBITED_INFRASTRUCTURE,
  REQUIRED_WORKSPACE_PATTERNS,
  VENDOR_OWNERS,
} from "./rules.js";
import type {
  ArchitectureDiagnostic,
  ArchitectureReport,
  CheckOptions,
} from "./types.js";

interface PackageJson {
  readonly name?: string;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
}

type PackageKind =
  | "adapter"
  | "app"
  | "config"
  | "db"
  | "domain"
  | "port"
  | "reporting"
  | "shared"
  | "testing"
  | "tool"
  | "ui"
  | "unknown";

interface PackageInfo {
  readonly name: string;
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly manifestPath: string;
  readonly manifestText: string;
  readonly manifest: PackageJson;
  readonly kind: PackageKind;
  readonly adapterName?: string;
  readonly portName?: string;
  readonly appName?: string;
}

interface SourceImport {
  readonly file: string;
  readonly absoluteFile: string;
  readonly line: number;
  readonly column: number;
  readonly specifier: string;
  readonly packageInfo: PackageInfo;
  readonly isTest: boolean;
}

interface DependencyContext {
  readonly isDevelopment: boolean;
  readonly isTest: boolean;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly specifier: string;
}

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);

const SOURCE_EXTENSION = /\.(?:[cm]?[jt]sx?)$/;
const PORT_SET = new Set<string>(PORT_DIRECTORIES);
const BUILTINS = new Set(
  builtinModules.flatMap((moduleName) => [moduleName, `node:${moduleName}`]),
);

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

function dependencyRoot(specifier: string): string {
  if (specifier.startsWith("@")) {
    return specifier.split("/").slice(0, 2).join("/");
  }
  return specifier.split("/")[0] ?? specifier;
}

function isTestPath(file: string): boolean {
  return (
    /(?:^|\/)(?:__tests__|test|tests)(?:\/|$)/.test(file) ||
    /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(file)
  );
}

function walkFiles(directory: string, visitor: (file: string) => void): void {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walkFiles(entryPath, visitor);
    else if (entry.isFile()) visitor(entryPath);
  }
}

function classifyPackage(relativePath: string): Omit<PackageInfo, "name" | "absolutePath" | "relativePath" | "manifestPath" | "manifestText" | "manifest"> {
  const parts = relativePath.split("/");
  if (parts.length === 2 && parts[0] === "apps") {
    return { kind: "app", appName: parts[1] };
  }
  if (parts.length === 2 && parts[0] === "tools") return { kind: "tool" };
  if (parts.length === 3 && parts[0] === "packages" && parts[1] === "adapters") {
    return { kind: "adapter", adapterName: parts[2] };
  }
  if (parts.length === 2 && parts[0] === "packages") {
    const packageDirectory = parts[1] ?? "";
    if (PORT_SET.has(packageDirectory)) return { kind: "port", portName: packageDirectory };
    if (packageDirectory === "shared") return { kind: "shared" };
    if (packageDirectory === "config") return { kind: "config" };
    if (packageDirectory === "domain") return { kind: "domain" };
    if (packageDirectory === "db") return { kind: "db" };
    if (packageDirectory === "reporting") return { kind: "reporting" };
    if (packageDirectory === "testing") return { kind: "testing" };
    if (packageDirectory === "ui") return { kind: "ui" };
  }
  return { kind: "unknown" };
}

function locationOf(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, Math.max(0, offset));
  const lines = before.split("\n");
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

function dependencyLocation(manifestText: string, dependency: string): { line: number; column: number } {
  const index = manifestText.indexOf(`"${dependency}"`);
  return locationOf(manifestText, index < 0 ? 0 : index);
}

function scriptKindFor(file: string): ts.ScriptKind {
  if (/\.tsx$/.test(file)) return ts.ScriptKind.TSX;
  if (/\.jsx$/.test(file)) return ts.ScriptKind.JSX;
  if (/\.[cm]ts$/.test(file)) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

function extractImports(root: string, packageInfo: PackageInfo): SourceImport[] {
  const imports: SourceImport[] = [];
  walkFiles(packageInfo.absolutePath, (absoluteFile) => {
    if (!SOURCE_EXTENSION.test(absoluteFile)) return;
    const text = fs.readFileSync(absoluteFile, "utf8");
    const source = ts.createSourceFile(
      absoluteFile,
      text,
      ts.ScriptTarget.Latest,
      true,
      scriptKindFor(absoluteFile),
    );
    const add = (literal: ts.StringLiteralLike): void => {
      const position = source.getLineAndCharacterOfPosition(literal.getStart(source));
      const file = toPosix(path.relative(root, absoluteFile));
      imports.push({
        file,
        absoluteFile,
        line: position.line + 1,
        column: position.character + 1,
        specifier: literal.text,
        packageInfo,
        isTest: isTestPath(file),
      });
    };
    const visit = (node: ts.Node): void => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier !== undefined &&
        ts.isStringLiteralLike(node.moduleSpecifier)
      ) {
        add(node.moduleSpecifier);
      } else if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression !== undefined &&
        ts.isStringLiteralLike(node.moduleReference.expression)
      ) {
        add(node.moduleReference.expression);
      } else if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === "require")) &&
        node.arguments.length > 0 &&
        ts.isStringLiteralLike(node.arguments[0]!)
      ) {
        add(node.arguments[0]! as ts.StringLiteralLike);
      } else if (
        ts.isImportTypeNode(node) &&
        ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteralLike(node.argument.literal)
      ) {
        add(node.argument.literal);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  });
  return imports;
}

function packageForAbsolutePath(packages: readonly PackageInfo[], candidate: string): PackageInfo | undefined {
  const normalized = path.resolve(candidate);
  return [...packages]
    .sort((left, right) => right.absolutePath.length - left.absolutePath.length)
    .find(
      (packageInfo) =>
        normalized === packageInfo.absolutePath ||
        normalized.startsWith(`${packageInfo.absolutePath}${path.sep}`),
    );
}

function sourceTarget(
  sourceImport: SourceImport,
  packages: readonly PackageInfo[],
  byName: ReadonlyMap<string, PackageInfo>,
): PackageInfo | undefined {
  const { specifier } = sourceImport;
  if (specifier.startsWith(".")) {
    return packageForAbsolutePath(
      packages,
      path.resolve(path.dirname(sourceImport.absoluteFile), specifier),
    );
  }
  if (specifier.startsWith("apps/")) {
    const appName = specifier.split("/")[1];
    return packages.find((packageInfo) => packageInfo.kind === "app" && packageInfo.appName === appName);
  }
  for (const [name, packageInfo] of byName) {
    if (specifier === name || specifier.startsWith(`${name}/`)) return packageInfo;
  }
  return undefined;
}

function relationDiagnostic(
  source: PackageInfo,
  target: PackageInfo,
  context: DependencyContext,
): { rule: string; message: string } | undefined {
  if (source.relativePath === target.relativePath) return undefined;

  if (target.kind === "app") {
    if (source.kind === "app") {
      return {
        rule: "CROSS_PRODUCT_IMPORT",
        message: `Product ${source.appName} may not depend on product ${target.appName}.`,
      };
    }
    return {
      rule: "PACKAGE_TO_APPLICATION",
      message: `${source.relativePath} may not depend on application package ${target.relativePath}.`,
    };
  }

  if (target.kind === "tool") {
    // Tools are developer utilities. Task 010's frozen contract explicitly
    // allows tooling to depend on architecture/document validation tooling
    // (extraction-validate delegates to arch-check and validate-docs), so a
    // tool may compose another tool. Applications and packages still may not.
    if (source.kind === "tool") return undefined;
    return {
      rule: "TOOL_IMPORT_DIRECTION",
      message: `${source.relativePath} may not depend on development tool ${target.relativePath}.`,
    };
  }

  if (target.kind === "adapter") {
    if (source.kind === "adapter") {
      return {
        rule: "ADAPTER_TO_ADAPTER",
        message: `Adapter ${source.adapterName} may not depend on adapter ${target.adapterName}.`,
      };
    }
    if (source.kind === "app") {
      const allowedFile = `apps/${source.appName}/src/providers.ts`;
      // The application manifest must declare the adapter used by providers.ts;
      // file-level scanning enforces that no other application file imports it.
      if (context.file === source.manifestPath || context.file === allowedFile) return undefined;
      return {
        rule: "ADAPTER_BYPASS",
        message: `Adapter imports in an application are allowed only in ${allowedFile}.`,
      };
    }
    if (source.kind === "port") {
      return {
        rule: "PORT_TO_ADAPTER",
        message: `Port package ${source.name} may not depend on an adapter implementation.`,
      };
    }
    if (source.kind === "reporting") {
      return {
        rule: "REPORTING_BOUNDARY",
        message: "Reporting may depend only on domain and shared Forge packages, never adapters/providers.",
      };
    }
    if (source.kind === "ui") {
      return {
        rule: "UI_BOUNDARY",
        message: "UI may not depend on Forge backend or provider adapter packages.",
      };
    }
    return {
      rule: "ADAPTER_BYPASS",
      message: "Adapter packages may be consumed only by an application's src/providers.ts.",
    };
  }

  if (source.kind === "app") {
    const isProductDomain = context.file.startsWith(`apps/${source.appName}/src/domain/`);
    if (isProductDomain && target.kind !== "shared" && target.kind !== "domain") {
      return {
        rule: "DOMAIN_INFRASTRUCTURE",
        message: `Product domain code may import only @forge/shared, @forge/domain, Zod, and local domain files; found ${target.name}.`,
      };
    }
    if (target.kind === "testing" && !(context.isDevelopment || context.isTest)) {
      return {
        rule: "APPLICATION_TESTING_BOUNDARY",
        message: "Applications may import @forge/testing only from tests or development dependencies.",
      };
    }
    return undefined;
  }

  if (source.kind === "tool") return undefined;

  if (source.kind === "adapter") {
    if (target.kind === "testing" && (context.isDevelopment || context.isTest)) return undefined;
    const adapterRule = source.adapterName === undefined ? undefined : ADAPTER_RULES[source.adapterName];
    if (target.kind === "port" && target.portName !== adapterRule?.port) {
      return {
        rule: "ADAPTER_TO_FOREIGN_PORT",
        message: `Adapter ${source.adapterName} implements ${adapterRule?.port ?? "no registered port"} and may not depend on port ${target.portName}.`,
      };
    }
    if (target.kind === "port" && target.portName === adapterRule?.port) return undefined;
    if (target.kind === "shared") return undefined;
    return {
      rule: "ADAPTER_BOUNDARY",
      message: `Adapter ${source.adapterName} may depend only on its own port, @forge/shared, its vendor SDK, and @forge/testing in tests.`,
    };
  }

  if (source.kind === "shared") {
    return {
      rule: "SHARED_KERNEL_BOUNDARY",
      message: "@forge/shared is layer zero and may not depend on another workspace package.",
    };
  }

  if (source.kind === "domain") {
    if (target.kind === "shared") return undefined;
    return {
      rule: "DOMAIN_INFRASTRUCTURE",
      message: "@forge/domain may depend only on @forge/shared and Zod.",
    };
  }

  if (source.kind === "config") {
    if (target.kind === "shared") return undefined;
    return {
      rule: "INVALID_DEPENDENCY_DIRECTION",
      message: "@forge/config may depend only on @forge/shared and Zod.",
    };
  }

  if (source.kind === "port") {
    if (target.kind === "shared") return undefined;
    return {
      rule: "PORT_BOUNDARY",
      message: `Port package ${source.name} may depend only on @forge/shared and Zod.`,
    };
  }

  if (source.kind === "db") {
    if (target.kind === "shared") return undefined;
    return {
      rule: "DATABASE_BOUNDARY",
      message: "@forge/db may depend only on @forge/shared, Drizzle, and the postgres driver.",
    };
  }

  if (source.kind === "testing") {
    if (target.kind === "shared" || target.kind === "port") return undefined;
    if (target.kind === "db") {
      return {
        rule: "TESTING_INFRASTRUCTURE",
        message: "@forge/testing must remain provider-neutral and may not depend on the database layer.",
      };
    }
    return {
      rule: "TESTING_NEUTRALITY",
      message: "@forge/testing may depend only on port packages, @forge/shared, and test libraries.",
    };
  }

  if (source.kind === "reporting") {
    if (target.kind === "domain" || target.kind === "shared") return undefined;
    return {
      rule: "REPORTING_BOUNDARY",
      message: "@forge/reporting may depend only on @forge/domain and @forge/shared.",
    };
  }

  if (source.kind === "ui") {
    if (target.kind === "shared") return undefined;
    return {
      rule: "UI_BOUNDARY",
      message: "@forge/ui may not depend on Forge backend, domain, port, or provider packages.",
    };
  }

  return {
    rule: "INVALID_DEPENDENCY_DIRECTION",
    message: `${source.relativePath} may not depend on ${target.relativePath}.`,
  };
}

function externalDiagnostic(
  source: PackageInfo,
  context: DependencyContext,
): { rule: string; message: string } | undefined {
  const root = dependencyRoot(context.specifier);
  const isBuiltin = BUILTINS.has(context.specifier) || BUILTINS.has(root);

  if (source.kind === "testing" && (DATABASE_IMPORTS.has(root) || root === "@forge/db")) {
    return {
      rule: "TESTING_INFRASTRUCTURE",
      message: `@forge/testing may not import database dependency ${root}.`,
    };
  }

  if (PROHIBITED_INFRASTRUCTURE.has(root)) {
    return {
      rule: "PROHIBITED_INFRASTRUCTURE",
      message: `${root} is prohibited by the frozen PostgreSQL/Drizzle/no-Redis infrastructure model.`,
    };
  }

  const vendorOwner = VENDOR_OWNERS.get(root);
  if (vendorOwner !== undefined && !(source.kind === "adapter" && source.adapterName === vendorOwner)) {
    return {
      rule: "VENDOR_LEAKAGE",
      message: `Vendor SDK ${root} is contained by packages/adapters/${vendorOwner} and may not appear in ${source.relativePath}.`,
    };
  }

  if (isBuiltin) {
    if (source.kind === "app" && context.file.startsWith(`apps/${source.appName}/src/domain/`)) {
      return {
        rule: "DOMAIN_FRAMEWORK_IMPORT",
        message: `Product domain code may not import Node API ${context.specifier}.`,
      };
    }
    return undefined;
  }

  if (
    (context.isDevelopment || context.isTest || source.kind === "testing") &&
    (DEVELOPMENT_DEPENDENCIES.has(root) || root.startsWith("@types/"))
  ) {
    return undefined;
  }

  if (source.kind === "app") {
    if (context.file.startsWith(`apps/${source.appName}/src/domain/`)) {
      if (root === "zod") return undefined;
      return {
        rule: "DOMAIN_FRAMEWORK_IMPORT",
        message: `Product domain code may import only Zod, @forge/shared, @forge/domain, and local domain files; found ${root}.`,
      };
    }
    return undefined;
  }

  if (source.kind === "tool") return undefined;

  const allowedByKind: Partial<Record<PackageKind, ReadonlySet<string>>> = {
    shared: new Set(["zod"]),
    config: new Set(["zod"]),
    domain: new Set(["zod"]),
    port: new Set(["zod"]),
    db: new Set(["drizzle-orm", "postgres"]),
    reporting: new Set(["puppeteer-core"]),
    ui: new Set(["clsx", "framer-motion", "react", "react-dom", "tailwindcss"]),
    testing: DEVELOPMENT_DEPENDENCIES,
  };

  if (source.kind === "adapter") {
    const allowedVendors = source.adapterName === undefined ? [] : ADAPTER_RULES[source.adapterName]?.vendors ?? [];
    if (allowedVendors.includes(root)) return undefined;
    return {
      rule: "ADAPTER_EXTERNAL_DEPENDENCY",
      message: `Adapter ${source.adapterName} may not import external dependency ${root}; only its registered vendor SDK is allowed.`,
    };
  }

  if (allowedByKind[source.kind]?.has(root)) return undefined;

  if (["shared", "config", "domain", "port", "testing"].includes(source.kind)) {
    return {
      rule: "PROVIDER_NEUTRALITY",
      message: `${source.name} must remain provider-neutral; external dependency ${root} is not allowed.`,
    };
  }

  return {
    rule: "PACKAGE_EXTERNAL_DEPENDENCY",
    message: `${source.name} is not permitted to depend on external package ${root}.`,
  };
}

function manifestSections(manifest: PackageJson): ReadonlyArray<{
  name: string;
  dependencies: Readonly<Record<string, string>>;
  isDevelopment: boolean;
}> {
  return [
    { name: "dependencies", dependencies: manifest.dependencies ?? {}, isDevelopment: false },
    { name: "optionalDependencies", dependencies: manifest.optionalDependencies ?? {}, isDevelopment: false },
    { name: "peerDependencies", dependencies: manifest.peerDependencies ?? {}, isDevelopment: false },
    { name: "devDependencies", dependencies: manifest.devDependencies ?? {}, isDevelopment: true },
  ];
}

function cycleDiagnostics(
  packages: readonly PackageInfo[],
  graph: ReadonlyMap<string, ReadonlySet<string>>,
): ArchitectureDiagnostic[] {
  const diagnostics: ArchitectureDiagnostic[] = [];
  const state = new Map<string, "active" | "done">();
  const stack: string[] = [];
  const emitted = new Set<string>();
  const packageByPath = new Map(packages.map((packageInfo) => [packageInfo.relativePath, packageInfo]));

  const visit = (node: string): void => {
    if (state.get(node) === "done") return;
    if (state.get(node) === "active") {
      const start = stack.indexOf(node);
      const cycle = [...stack.slice(start), node];
      const canonical = [...new Set(cycle.slice(0, -1))].sort().join("|");
      if (!emitted.has(canonical)) {
        emitted.add(canonical);
        const owner = packageByPath.get(node);
        diagnostics.push({
          severity: "error",
          rule: "CIRCULAR_PACKAGE_DEPENDENCY",
          message: `Circular workspace dependency: ${cycle.join(" -> ")}.`,
          file: owner?.manifestPath ?? "package.json",
          line: 1,
          column: 1,
          packageName: owner?.name,
          packagePath: owner?.relativePath,
        });
      }
      return;
    }
    state.set(node, "active");
    stack.push(node);
    for (const target of graph.get(node) ?? []) visit(target);
    stack.pop();
    state.set(node, "done");
  };

  for (const packageInfo of packages) visit(packageInfo.relativePath);
  return diagnostics;
}

function checkDatabaseInvariants(root: string, packages: readonly PackageInfo[]): ArchitectureDiagnostic[] {
  const dbPackage = packages.find((packageInfo) => packageInfo.kind === "db");
  if (dbPackage === undefined) return [];
  const diagnostics: ArchitectureDiagnostic[] = [];
  const requiredFiles = ["usage-records.ts", "audit-events.ts"];
  for (const fileName of requiredFiles) {
    const absoluteFile = path.join(dbPackage.absolutePath, "src", "schema", fileName);
    const relativeFile = toPosix(path.relative(root, absoluteFile));
    if (!fs.existsSync(absoluteFile)) {
      diagnostics.push({
        severity: "error",
        rule: "PRODUCT_ISOLATION",
        message: `${relativeFile} is required to enforce product-scoped platform records.`,
        file: relativeFile,
        line: 1,
        column: 1,
        packageName: dbPackage.name,
        packagePath: dbPackage.relativePath,
      });
      continue;
    }
    const text = fs.readFileSync(absoluteFile, "utf8");
    const invariant = /productId\s*:\s*uuid\(["']product_id["']\)[\s\S]*?\.notNull\(\)[\s\S]*?\.references\(\(\)\s*=>\s*products\.id/;
    if (!invariant.test(text)) {
      diagnostics.push({
        severity: "error",
        rule: "PRODUCT_ISOLATION",
        message: `${relativeFile} must define a non-null product_id foreign key to platform.products.id.`,
        file: relativeFile,
        line: 1,
        column: 1,
        packageName: dbPackage.name,
        packagePath: dbPackage.relativePath,
      });
    }
  }
  return diagnostics;
}

function checkApplicationDatabaseScoping(root: string, packages: readonly PackageInfo[]): ArchitectureDiagnostic[] {
  const diagnostics: ArchitectureDiagnostic[] = [];
  for (const app of packages.filter((packageInfo) => packageInfo.kind === "app")) {
    const schemaDirectory = path.join(app.absolutePath, "src", "db");
    const tenantTables = new Set<string>();
    walkFiles(schemaDirectory, (file) => {
      if (!SOURCE_EXTENSION.test(file)) return;
      const text = fs.readFileSync(file, "utf8");
      const tablePattern = /export\s+const\s+(\w+)\s*=\s*[\s\S]*?table\([\s\S]*?organizationId\s*:/g;
      let match: RegExpExecArray | null;
      while ((match = tablePattern.exec(text)) !== null) {
        if (match[1] !== undefined) tenantTables.add(match[1]);
      }
    });
    if (tenantTables.size === 0) continue;
    walkFiles(path.join(app.absolutePath, "src"), (absoluteFile) => {
      if (!SOURCE_EXTENSION.test(absoluteFile) || absoluteFile.startsWith(`${schemaDirectory}${path.sep}`)) return;
      const text = fs.readFileSync(absoluteFile, "utf8");
      const queriesTenantTable = [...tenantTables].some((table) => new RegExp(`\\b${table}\\b`).test(text));
      const performsQuery = /\b(?:db|tx)\s*\.\s*(?:select|update|delete|query)\b/.test(text);
      if (queriesTenantTable && performsQuery && !/\bwithOrg\s*\(/.test(text)) {
        diagnostics.push({
          severity: "error",
          rule: "UNSCOPED_DB_ACCESS",
          message: `Query of a tenant-scoped table must use withOrg() in ${toPosix(path.relative(root, absoluteFile))}.`,
          file: toPosix(path.relative(root, absoluteFile)),
          line: 1,
          column: 1,
          packageName: app.name,
          packagePath: app.relativePath,
        });
      }
    });
  }
  return diagnostics;
}

function discoverPackages(root: string, add: (diagnostic: ArchitectureDiagnostic) => void): PackageInfo[] {
  const manifests: string[] = [];
  walkFiles(root, (file) => {
    if (path.basename(file) === "package.json" && path.resolve(file) !== path.join(root, "package.json")) {
      manifests.push(file);
    }
  });

  const packages: PackageInfo[] = [];
  const seenNames = new Map<string, string>();
  for (const absoluteManifest of manifests.sort()) {
    const absolutePath = path.dirname(absoluteManifest);
    const relativePath = toPosix(path.relative(root, absolutePath));
    const manifestPath = `${relativePath}/package.json`;
    const manifestText = fs.readFileSync(absoluteManifest, "utf8");
    let manifest: PackageJson;
    try {
      manifest = JSON.parse(manifestText) as PackageJson;
    } catch (error) {
      add({
        severity: "error",
        rule: "INVALID_PACKAGE_MANIFEST",
        message: `Cannot parse ${manifestPath}: ${error instanceof Error ? error.message : String(error)}.`,
        file: manifestPath,
        line: 1,
        column: 1,
        packagePath: relativePath,
      });
      continue;
    }
    const name = manifest.name ?? `<unnamed:${relativePath}>`;
    const classification = classifyPackage(relativePath);
    const packageInfo: PackageInfo = {
      name,
      absolutePath,
      relativePath,
      manifestPath,
      manifestText,
      manifest,
      ...classification,
    };
    packages.push(packageInfo);

    const expectedName =
      classification.kind === "adapter"
        ? `@forge/adapter-${classification.adapterName}`
        : relativePath.startsWith("packages/") && !relativePath.startsWith("packages/adapters/")
          ? `@forge/${relativePath.split("/")[1]}`
          : classification.kind === "tool"
            ? `@forge/${relativePath.split("/")[1]}`
            : undefined;
    if (expectedName !== undefined && name !== expectedName) {
      add({
        severity: "error",
        rule: "PACKAGE_NAMING",
        message: `${relativePath} must use frozen workspace package name ${expectedName}; found ${name}.`,
        file: manifestPath,
        line: 1,
        column: 1,
        packageName: name,
        packagePath: relativePath,
      });
    }
    if (classification.kind === "app" && !fs.existsSync(path.join(absolutePath, "product.manifest.ts"))) {
      add({
        severity: "error",
        rule: "PRODUCT_PLACEMENT",
        message: `${relativePath} must contain product.manifest.ts at its package root.`,
        file: `${relativePath}/product.manifest.ts`,
        line: 1,
        column: 1,
        packageName: name,
        packagePath: relativePath,
      });
    }

    if (classification.kind === "unknown") {
      add({
        severity: "error",
        rule: "WORKSPACE_PLACEMENT",
        message: `${manifestPath} is outside the frozen apps/*, packages/*, packages/adapters/*, or tools/* package locations.`,
        file: manifestPath,
        line: 1,
        column: 1,
        packageName: name,
        packagePath: relativePath,
      });
    }
    if (
      relativePath.startsWith("packages/") &&
      classification.kind !== "adapter" &&
      classification.kind !== "unknown" &&
      !FROZEN_PACKAGE_DIRECTORIES.has(relativePath.split("/")[1] ?? "")
    ) {
      add({
        severity: "error",
        rule: "UNKNOWN_FRAMEWORK_PACKAGE",
        message: `${relativePath} is not a package defined by the frozen V3 package graph.`,
        file: manifestPath,
        line: 1,
        column: 1,
        packageName: name,
        packagePath: relativePath,
      });
    }
    if (classification.kind === "adapter" && ADAPTER_RULES[classification.adapterName ?? ""] === undefined) {
      add({
        severity: "error",
        rule: "UNKNOWN_ADAPTER_SLOT",
        message: `${relativePath} is not one of the provider adapter slots frozen in V3.`,
        file: manifestPath,
        line: 1,
        column: 1,
        packageName: name,
        packagePath: relativePath,
      });
    }
    const previous = seenNames.get(name);
    if (previous !== undefined) {
      add({
        severity: "error",
        rule: "DUPLICATE_PACKAGE_NAME",
        message: `Package name ${name} is used by both ${previous} and ${relativePath}.`,
        file: manifestPath,
        line: 1,
        column: 1,
        packageName: name,
        packagePath: relativePath,
      });
    } else {
      seenNames.set(name, relativePath);
    }
  }
  return packages;
}

export function checkRepository(options: CheckOptions = {}): ArchitectureReport {
  const root = path.resolve(options.root ?? process.cwd());
  const diagnostics: ArchitectureDiagnostic[] = [];
  const diagnosticKeys = new Set<string>();
  const add = (diagnostic: ArchitectureDiagnostic): void => {
    const key = [diagnostic.severity, diagnostic.rule, diagnostic.file, diagnostic.line, diagnostic.specifier ?? "", diagnostic.message].join("|");
    if (!diagnosticKeys.has(key)) {
      diagnosticKeys.add(key);
      diagnostics.push(diagnostic);
    }
  };

  const workspaceFile = path.join(root, "pnpm-workspace.yaml");
  if (!fs.existsSync(workspaceFile)) {
    add({
      severity: "error",
      rule: "WORKSPACE_CONFIGURATION",
      message: "pnpm-workspace.yaml is required by frozen principle P2.",
      file: "pnpm-workspace.yaml",
      line: 1,
      column: 1,
    });
  } else {
    const workspaceText = fs.readFileSync(workspaceFile, "utf8");
    for (const pattern of REQUIRED_WORKSPACE_PATTERNS) {
      if (!workspaceText.includes(`"${pattern}"`) && !workspaceText.includes(`'${pattern}'`) && !workspaceText.includes(`- ${pattern}`)) {
        add({
          severity: "error",
          rule: "WORKSPACE_CONFIGURATION",
          message: `pnpm-workspace.yaml must include the frozen workspace pattern ${pattern}.`,
          file: "pnpm-workspace.yaml",
          line: 1,
          column: 1,
          specifier: pattern,
        });
      }
    }
  }

  const packages = discoverPackages(root, add);
  const byName = new Map(packages.map((packageInfo) => [packageInfo.name, packageInfo]));
  const graph = new Map(packages.map((packageInfo) => [packageInfo.relativePath, new Set<string>()]));
  const importedRoots = new Map(packages.map((packageInfo) => [packageInfo.relativePath, new Set<string>()]));

  for (const packageInfo of packages.filter((candidate) => candidate.kind === "adapter")) {
    const adapterRule = packageInfo.adapterName === undefined ? undefined : ADAPTER_RULES[packageInfo.adapterName];
    if (adapterRule === undefined) continue;
    const runtimeDependencies = {
      ...(packageInfo.manifest.dependencies ?? {}),
      ...(packageInfo.manifest.optionalDependencies ?? {}),
      ...(packageInfo.manifest.peerDependencies ?? {}),
    };
    for (const requiredDependency of [`@forge/${adapterRule.port}`, "@forge/shared"]) {
      if (runtimeDependencies[requiredDependency] === undefined) {
        add({
          severity: "error",
          rule: "ADAPTER_CONTRACT_DEPENDENCY",
          message: `Adapter ${packageInfo.adapterName} must declare runtime dependency ${requiredDependency}.`,
          file: packageInfo.manifestPath,
          line: 1,
          column: 1,
          packageName: packageInfo.name,
          packagePath: packageInfo.relativePath,
          specifier: requiredDependency,
        });
      }
    }
  }

  for (const packageInfo of packages) {
    for (const section of manifestSections(packageInfo.manifest)) {
      for (const [dependency, version] of Object.entries(section.dependencies)) {
        const location = dependencyLocation(packageInfo.manifestText, dependency);
        const context: DependencyContext = {
          isDevelopment: section.isDevelopment,
          isTest: section.isDevelopment,
          file: packageInfo.manifestPath,
          line: location.line,
          column: location.column,
          specifier: dependency,
        };
        const target = byName.get(dependency);
        if (target !== undefined) {
          graph.get(packageInfo.relativePath)?.add(target.relativePath);
          if (!version.startsWith("workspace:")) {
            add({
              severity: "error",
              rule: "WORKSPACE_PROTOCOL",
              message: `Workspace dependency ${dependency} must use the workspace: protocol, found ${version}.`,
              file: packageInfo.manifestPath,
              line: location.line,
              column: location.column,
              packageName: packageInfo.name,
              packagePath: packageInfo.relativePath,
              specifier: dependency,
            });
          }
          const violation = relationDiagnostic(packageInfo, target, context);
          if (violation !== undefined) {
            add({
              severity: "error",
              ...violation,
              file: packageInfo.manifestPath,
              line: location.line,
              column: location.column,
              packageName: packageInfo.name,
              packagePath: packageInfo.relativePath,
              specifier: dependency,
            });
          }
        } else {
          if (dependency.startsWith("@forge/")) {
            add({
              severity: "error",
              rule: "UNKNOWN_INTERNAL_DEPENDENCY",
              message: `${dependency} is declared as a Forge dependency but does not resolve to a workspace package.`,
              file: packageInfo.manifestPath,
              line: location.line,
              column: location.column,
              packageName: packageInfo.name,
              packagePath: packageInfo.relativePath,
              specifier: dependency,
            });
          } else {
            const violation = externalDiagnostic(packageInfo, context);
            if (violation !== undefined) {
              add({
                severity: "error",
                ...violation,
                file: packageInfo.manifestPath,
                line: location.line,
                column: location.column,
                packageName: packageInfo.name,
                packagePath: packageInfo.relativePath,
                specifier: dependency,
              });
            }
          }
        }
      }
    }
  }

  const sourceImports = packages.flatMap((packageInfo) => extractImports(root, packageInfo));
  for (const sourceImport of sourceImports) {
    const { packageInfo } = sourceImport;
    const context: DependencyContext = {
      isDevelopment: sourceImport.isTest,
      isTest: sourceImport.isTest,
      file: sourceImport.file,
      line: sourceImport.line,
      column: sourceImport.column,
      specifier: sourceImport.specifier,
    };
    const target = sourceTarget(sourceImport, packages, byName);
    if (target !== undefined) {
      if (target.relativePath !== packageInfo.relativePath) {
        graph.get(packageInfo.relativePath)?.add(target.relativePath);
        importedRoots.get(packageInfo.relativePath)?.add(target.name);
        const declaredDependencies = Object.assign(
          {},
          packageInfo.manifest.dependencies,
          packageInfo.manifest.devDependencies,
          packageInfo.manifest.optionalDependencies,
          packageInfo.manifest.peerDependencies,
        ) as Record<string, string>;
        if (declaredDependencies[target.name] === undefined) {
          add({
            severity: "error",
            rule: "UNDECLARED_WORKSPACE_IMPORT",
            message: `${sourceImport.specifier} resolves to ${target.name}, which is not declared in ${packageInfo.manifestPath}.`,
            file: sourceImport.file,
            line: sourceImport.line,
            column: sourceImport.column,
            packageName: packageInfo.name,
            packagePath: packageInfo.relativePath,
            specifier: sourceImport.specifier,
          });
        }
      }
      const violation = relationDiagnostic(packageInfo, target, context);
      if (violation !== undefined) {
        add({
          severity: "error",
          ...violation,
          file: sourceImport.file,
          line: sourceImport.line,
          column: sourceImport.column,
          packageName: packageInfo.name,
          packagePath: packageInfo.relativePath,
          specifier: sourceImport.specifier,
        });
      }
      continue;
    }

    if (sourceImport.specifier.startsWith(".") || sourceImport.specifier.startsWith("/") || sourceImport.specifier.startsWith("@/")) {
      continue;
    }
    const rootSpecifier = dependencyRoot(sourceImport.specifier);
    importedRoots.get(packageInfo.relativePath)?.add(rootSpecifier);
    if (rootSpecifier.startsWith("@forge/")) {
      add({
        severity: "error",
        rule: "UNKNOWN_INTERNAL_IMPORT",
        message: `${sourceImport.specifier} does not resolve to a workspace package.`,
        file: sourceImport.file,
        line: sourceImport.line,
        column: sourceImport.column,
        packageName: packageInfo.name,
        packagePath: packageInfo.relativePath,
        specifier: sourceImport.specifier,
      });
      continue;
    }
    const violation = externalDiagnostic(packageInfo, context);
    if (violation !== undefined) {
      add({
        severity: "error",
        ...violation,
        file: sourceImport.file,
        line: sourceImport.line,
        column: sourceImport.column,
        packageName: packageInfo.name,
        packagePath: packageInfo.relativePath,
        specifier: sourceImport.specifier,
      });
    }
  }

  for (const diagnostic of cycleDiagnostics(packages, graph)) add(diagnostic);
  for (const diagnostic of checkDatabaseInvariants(root, packages)) add(diagnostic);
  for (const diagnostic of checkApplicationDatabaseScoping(root, packages)) add(diagnostic);

  for (const packageInfo of packages) {
    const used = importedRoots.get(packageInfo.relativePath) ?? new Set<string>();
    const runtimeDependencies = {
      ...(packageInfo.manifest.dependencies ?? {}),
      ...(packageInfo.manifest.optionalDependencies ?? {}),
    };
    for (const dependency of Object.keys(runtimeDependencies)) {
      if (dependency === packageInfo.name || used.has(dependency)) continue;
      const location = dependencyLocation(packageInfo.manifestText, dependency);
      add({
        severity: "warning",
        rule: "UNUSED_DEPENDENCY",
        message: `${dependency} is declared but no static import was found; verify dynamic or configuration-only usage.`,
        file: packageInfo.manifestPath,
        line: location.line,
        column: location.column,
        packageName: packageInfo.name,
        packagePath: packageInfo.relativePath,
        specifier: dependency,
      });
    }
  }

  diagnostics.sort((left, right) =>
    left.file.localeCompare(right.file) ||
    left.line - right.line ||
    left.column - right.column ||
    left.rule.localeCompare(right.rule),
  );
  return {
    root,
    packagesChecked: packages.length,
    filesChecked: new Set(sourceImports.map((sourceImport) => sourceImport.file)).size,
    errors: diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
    warnings: diagnostics.filter((diagnostic) => diagnostic.severity === "warning"),
  };
}

export type { ArchitectureDiagnostic, ArchitectureReport, CheckOptions, Severity } from "./types.js";
