/**
 * Export a Forge product into a standalone workspace.
 *
 * This is the acquisition direction (P15): Forge product → independent
 * repository. The import direction (legacy app → Forge product) remains in
 * extractProduct().
 *
 * The exporter never follows symlinks, never copies secrets or lockfiles,
 * never writes outside the destination, and never includes other products.
 */

import fs from "node:fs";
import path from "node:path";
import { extractManifestObject } from "@forge/create-product";
import { validateProductManifest } from "@forge/config";
import { ExtractError, TOOL_VERSION } from "./errors.js";
import { isSecretCredentialFile, isSecretEnvFile, safeDestinationPath, scanSource } from "./scan.js";

export interface ExportOptions {
  /** Forge repository root (must contain pnpm-workspace.yaml). */
  readonly root: string;
  /** Product id or path under apps/. */
  readonly product: string;
  /** Destination directory (must not exist). */
  readonly destination: string;
}

export interface ExportReport {
  readonly schemaVersion: 1;
  readonly tool: { readonly name: string; readonly version: string };
  readonly mode: "export";
  readonly productId: string;
  readonly source: string;
  readonly destination: string;
  readonly status: "complete" | "failed";
  readonly filesCopied: readonly string[];
  readonly packagesCopied: readonly string[];
  readonly toolsCopied: readonly string[];
  readonly excluded: readonly string[];
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

export interface ExportResult {
  readonly productPath: string;
  readonly report: ExportReport;
  readonly reportJsonPath: string;
  readonly reportMarkdownPath: string;
}

const FRAMEWORK_ONLY_TOOLS = new Set(["create-product", "extract-product", "extraction-validate"]);
const VALIDATION_TOOLS = ["architecture-check", "validate-docs"] as const;

const ROOT_FILES = [
  "pnpm-workspace.yaml",
  "turbo.json",
  "tsconfig.json",
  "eslint.config.js",
  ".prettierrc.json",
  ".prettierignore",
  ".gitignore",
] as const;

interface PackageJson {
  readonly name?: string;
  readonly version?: string;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly scripts?: Readonly<Record<string, string>>;
  readonly packageManager?: string;
  readonly engines?: Readonly<Record<string, string>>;
}

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

function safePrefixResolved(root: string, candidate: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`);
}

function readJson(file: string): PackageJson | undefined {
  if (!fs.existsSync(file)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as PackageJson;
  } catch {
    return undefined;
  }
}

function packageDirectoryFor(root: string, name: string): string | undefined {
  if (name.startsWith("@forge/adapter-")) {
    const adapter = name.slice("@forge/adapter-".length);
    const directory = path.join(root, "packages", "adapters", adapter);
    return fs.existsSync(directory) ? directory : undefined;
  }
  if (name.startsWith("@forge/")) {
    const id = name.slice("@forge/".length);
    const asPackage = path.join(root, "packages", id);
    if (fs.existsSync(asPackage)) return asPackage;
    const asTool = path.join(root, "tools", id);
    if (fs.existsSync(asTool)) return asTool;
  }
  return undefined;
}

function workspaceDependenciesOf(manifest: PackageJson | undefined): readonly string[] {
  if (manifest === undefined) return [];
  const names = new Set<string>();
  for (const [name, version] of Object.entries({
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {}),
  })) {
    if (name.startsWith("@forge/") && version.startsWith("workspace:")) {
      names.add(name);
    }
  }
  return [...names].sort();
}

function collectWorkspacePackages(root: string, entry: PackageJson): readonly string[] {
  const pending = [...workspaceDependenciesOf(entry)];
  const collected = new Set<string>();
  while (pending.length > 0) {
    const name = pending.pop();
    if (name === undefined || collected.has(name)) continue;
    collected.add(name);
    const directory = packageDirectoryFor(root, name);
    if (directory === undefined) continue;
    for (const dependency of workspaceDependenciesOf(readJson(path.join(directory, "package.json")))) {
      if (!collected.has(dependency)) pending.push(dependency);
    }
  }
  return [...collected].sort();
}

function copyTree(sourceRoot: string, destinationRoot: string, relativePrefix: string): {
  copied: string[];
  excluded: string[];
  warnings: string[];
} {
  const scanned = scanSource(sourceRoot);
  const copied: string[] = [];
  const excluded: string[] = [];
  const warnings: string[] = [];
  for (const skipped of scanned.skipped) {
    const destinationPath = toPosix(path.posix.join(relativePrefix, skipped.path));
    excluded.push(destinationPath);
    if (skipped.kind === "symlink") {
      warnings.push(`Skipped symbolic link ${destinationPath}`);
    }
  }
  for (const file of scanned.files) {
    const destinationPath = toPosix(path.posix.join(relativePrefix, file.relativePath));
    const absoluteDestination = safeDestinationPath(destinationRoot, destinationPath);
    fs.mkdirSync(path.dirname(absoluteDestination), { recursive: true });
    fs.copyFileSync(file.absolutePath, absoluteDestination);
    copied.push(destinationPath);
  }
  return { copied, excluded, warnings };
}

function resolveProduct(root: string, product: string): { id: string; absolutePath: string } {
  const candidates = [path.resolve(root, product), path.resolve(root, "apps", product)];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      const id = path.basename(candidate);
      return { id, absolutePath: candidate };
    }
  }
  throw new ExtractError(`Product "${product}" not found under ${root} (checked apps/${product}).`);
}

function rewriteRootPackageJson(source: PackageJson | undefined, productId: string): string {
  const scripts: Record<string, string> = {
    "arch-check": "pnpm --filter @forge/architecture-check build && pnpm --filter @forge/architecture-check check",
    build: "turbo run build",
    dev: "turbo run dev",
    lint: "turbo run lint",
    typecheck: "turbo run typecheck",
    test: "turbo run test",
    "validate-docs": "pnpm --filter @forge/validate-docs build && pnpm --filter @forge/validate-docs check",
    validate: "pnpm arch-check && pnpm validate-docs && pnpm lint && pnpm typecheck && pnpm test",
    audit: "pnpm audit --audit-level=high",
  };
  return `${JSON.stringify(
    {
      name: `${productId}-standalone`,
      version: source?.version ?? "0.0.1",
      description: `Standalone extraction of ${productId} from the Forge master framework`,
      private: true,
      type: "module",
      engines: source?.engines ?? { node: ">=22.0.0", pnpm: ">=11.21.0" },
      packageManager: source?.packageManager ?? "pnpm@11.21.0",
      scripts,
      devDependencies: source?.devDependencies ?? {},
    },
    null,
    2,
  )}\n`;
}

function renderExportMarkdown(report: ExportReport): string {
  const lines = [
    `# Export Report — ${report.productId}`,
    "",
    `**Status:** ${report.status}`,
    "",
    "## Overview",
    "",
    `- **Source:** ${report.source}`,
    `- **Destination:** ${report.destination}`,
    `- **Product identity:** ${report.productId}`,
    `- **Tool:** ${report.tool.name} ${report.tool.version}`,
    "",
    "## Copied",
    "",
    `- **Files:** ${report.filesCopied.length}`,
    `- **Packages:** ${report.packagesCopied.length === 0 ? "(none)" : report.packagesCopied.join(", ")}`,
    `- **Tools:** ${report.toolsCopied.length === 0 ? "(none)" : report.toolsCopied.join(", ")}`,
    "",
    "Other products, factory tooling (create-product / extract-product), secrets, and lockfiles were not copied.",
    "",
    "## Next steps",
    "",
    "1. `pnpm install` in the destination (a new lockfile is generated; the Forge lockfile is not reused).",
    "2. `pnpm build && pnpm validate`",
    "3. Configure live providers in `apps/<id>/src/providers.ts` if this deployment is not test mode.",
    "",
  ];
  if (report.warnings.length > 0) {
    lines.push("## Warnings", "");
    for (const warning of report.warnings) lines.push(`- ${warning}`);
    lines.push("");
  }
  if (report.errors.length > 0) {
    lines.push("## Errors", "");
    for (const error of report.errors) lines.push(`- ${error}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Exports a Forge product as a standalone workspace at the destination.
 */
export function exportProduct(options: ExportOptions): ExportResult {
  const root = path.resolve(options.root);
  if (!fs.existsSync(path.join(root, "pnpm-workspace.yaml"))) {
    throw new ExtractError(`Repository root ${root} has no pnpm-workspace.yaml; is this a Forge repository?`);
  }

  const destinationRoot = path.resolve(options.destination);
  if (fs.existsSync(destinationRoot)) {
    throw new ExtractError(`Destination ${options.destination} already exists; refusing to overwrite.`);
  }
  if (safePrefixResolved(root, destinationRoot) === false && safePrefixResolved(destinationRoot, root)) {
    throw new ExtractError("Source must not be inside the destination directory.");
  }
  if (destinationRoot === root) {
    throw new ExtractError("Destination must not be the repository root.");
  }

  const product = resolveProduct(root, options.product);
  const productManifestFile = path.join(product.absolutePath, "product.manifest.ts");
  if (!fs.existsSync(productManifestFile)) {
    throw new ExtractError(`Product ${product.id} is missing product.manifest.ts.`);
  }
  const extracted = extractManifestObject(fs.readFileSync(productManifestFile, "utf8"));
  if (!extracted.ok) {
    throw new ExtractError(`Invalid product manifest: ${extracted.message}`);
  }
  const validated = validateProductManifest(extracted.value);
  if (!validated.ok) {
    throw new ExtractError(`Invalid product manifest: ${validated.error.message}`);
  }
  if (validated.value.id !== product.id) {
    throw new ExtractError(`Manifest id "${validated.value.id}" does not match product directory "${product.id}".`);
  }

  const warnings: string[] = [];
  const errors: string[] = [];
  const filesCopied: string[] = [];
  const excluded: string[] = [];
  const packagesCopied: string[] = [];
  const toolsCopied: string[] = [];

  fs.mkdirSync(destinationRoot, { recursive: true });

  const productCopy = copyTree(product.absolutePath, destinationRoot, `apps/${product.id}`);
  filesCopied.push(...productCopy.copied);
  excluded.push(...productCopy.excluded);
  warnings.push(...productCopy.warnings);

  const productPackage = readJson(path.join(product.absolutePath, "package.json"));
  const workspacePackages = collectWorkspacePackages(root, productPackage ?? {});

  for (const name of workspacePackages) {
    const directory = packageDirectoryFor(root, name);
    if (directory === undefined) {
      warnings.push(`Workspace package ${name} is declared but was not found on disk.`);
      continue;
    }
    const relative = toPosix(path.relative(root, directory));
    if (relative.startsWith("tools/")) {
      const toolName = relative.slice("tools/".length);
      if (FRAMEWORK_ONLY_TOOLS.has(toolName)) continue;
    }
    const copied = copyTree(directory, destinationRoot, relative);
    filesCopied.push(...copied.copied);
    excluded.push(...copied.excluded);
    warnings.push(...copied.warnings);
    if (relative.startsWith("tools/")) toolsCopied.push(name);
    else packagesCopied.push(name);
  }

  for (const tool of VALIDATION_TOOLS) {
    const name = `@forge/${tool}`;
    if (packagesCopied.includes(name) || toolsCopied.includes(name)) continue;
    const directory = path.join(root, "tools", tool);
    if (!fs.existsSync(directory)) continue;
    const copied = copyTree(directory, destinationRoot, `tools/${tool}`);
    filesCopied.push(...copied.copied);
    excluded.push(...copied.excluded);
    toolsCopied.push(name);
  }

  for (const relative of ROOT_FILES) {
    const sourceFile = path.join(root, relative);
    if (!fs.existsSync(sourceFile)) {
      warnings.push(`Repository file ${relative} was not present and was not copied.`);
      continue;
    }
    if (isSecretEnvFile(path.basename(relative)) || isSecretCredentialFile(path.basename(relative))) {
      excluded.push(relative);
      continue;
    }
    const destinationFile = safeDestinationPath(destinationRoot, relative);
    fs.mkdirSync(path.dirname(destinationFile), { recursive: true });
    fs.copyFileSync(sourceFile, destinationFile);
    filesCopied.push(relative);
  }

  const rootPackage = readJson(path.join(root, "package.json"));
  const rewritten = rewriteRootPackageJson(rootPackage, product.id);
  fs.writeFileSync(safeDestinationPath(destinationRoot, "package.json"), rewritten, "utf8");
  filesCopied.push("package.json");

  const aiDirectory = path.join(root, ".ai");
  if (fs.existsSync(aiDirectory)) {
    const copied = copyTree(aiDirectory, destinationRoot, ".ai");
    filesCopied.push(...copied.copied);
    excluded.push(...copied.excluded);
  }

  const docsDirectory = path.join(root, "docs");
  if (fs.existsSync(docsDirectory)) {
    const copied = copyTree(docsDirectory, destinationRoot, "docs");
    filesCopied.push(...copied.copied);
    excluded.push(...copied.excluded);
  }

  const standaloneReadme = [
    `# ${validated.value.displayName} (standalone)`,
    "",
    validated.value.tagline,
    "",
    `This repository is a standalone extraction of \`${product.id}\` from the Forge master framework.`,
    "It contains this product, the Forge packages it depends on, and the architecture/documentation gates.",
    "Factory tooling (create-product) and other products were not included.",
    "",
    "## Quick start",
    "",
    "```bash",
    "pnpm install",
    "pnpm build",
    "pnpm validate",
    "```",
    "",
    "Run the product in deterministic test mode:",
    "",
    "```bash",
    `cd apps/${product.id}`,
    "AUTH_MODE=test BILLING_MODE=test DATA_MODE=memory pnpm dev",
    "```",
    "",
  ].join("\n");
  fs.writeFileSync(safeDestinationPath(destinationRoot, "README.md"), `${standaloneReadme}\n`, "utf8");
  filesCopied.push("README.md");

  filesCopied.sort();
  excluded.sort();
  packagesCopied.sort();
  toolsCopied.sort();
  warnings.sort();
  errors.sort();

  const report: ExportReport = {
    schemaVersion: 1,
    tool: { name: "@forge/extract-product", version: TOOL_VERSION },
    mode: "export",
    productId: product.id,
    source: toPosix(path.relative(root, product.absolutePath)) || `apps/${product.id}`,
    destination: options.destination,
    status: errors.length > 0 ? "failed" : "complete",
    filesCopied,
    packagesCopied,
    toolsCopied,
    excluded,
    warnings,
    errors,
  };

  const reportJsonPath = safeDestinationPath(destinationRoot, "extraction-export-report.json");
  const reportMarkdownPath = safeDestinationPath(destinationRoot, "extraction-export-report.md");
  fs.writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(reportMarkdownPath, renderExportMarkdown(report), "utf8");

  return { productPath: destinationRoot, report, reportJsonPath, reportMarkdownPath };
}
