/**
 * @forge/extract-product — Forge V3 extraction tool.
 *
 * Imports an existing application into the Forge V3 product structure:
 * inspects the source, classifies every file and dependency (SAFE / REVIEW /
 * MANUAL), copies what is safe, archives what cannot be transformed, isolates
 * provider code behind the composition root, generates the product manifest
 * and required documentation, and produces a deterministic extraction report.
 *
 * The tool NEVER executes source code, NEVER follows symlinks, NEVER writes
 * outside the destination, NEVER deletes anything, and NEVER claims that
 * arbitrary source code can be converted automatically: ambiguous or unsafe
 * items are reported as MANUAL with remediation notes.
 */

import fs from "node:fs";
import path from "node:path";
import { Archetype, isArchetype, isCapability, validateProductManifest } from "@forge/config";
import type { Capability } from "@forge/config";
import {
  BASE_PRODUCT_DEPENDENCIES,
  PRODUCT_DEV_DEPENDENCIES,
  REQUIRED_PRODUCT_DOCUMENTS,
  buildProductFileMap,
  capabilityDependencies,
  defaultTagline,
  isValidProductId,
  slugifyProductId,
  toHumanName,
} from "@forge/create-product";
import type { ProductSpec } from "@forge/create-product";
import { classifyDependency, classifyFile } from "./classify.js";
import {
  DATABASE_DEPENDENCIES,
  PORT_BY_CATEGORY,
  VENDOR_CATEGORIES,
  recommendationFor,
  sortReport,
} from "./model.js";
import type {
  ArchitectureViolation,
  Classification,
  DependencyClassification,
  ExtractionReport,
  FileRecord,
  ManualMigrationItem,
  ProviderIntegration,
} from "./model.js";
import { dependencyRoot, extractImports, isCodeFile, safeDestinationPath, scanSource } from "./scan.js";
import type { SourceImport } from "./scan.js";

export class ExtractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractError";
  }
}

export const TOOL_VERSION = "0.0.1";

// Re-exports for consumers of the extraction model (e.g. extraction-validate).
export { classifyDependency, classifyFile } from "./classify.js";
export {
  DATABASE_DEPENDENCIES,
  EXCLUDED_DEPENDENCIES,
  PORT_BY_CATEGORY,
  SAFE_EXTERNAL_DEPENDENCIES,
  VENDOR_CATEGORIES,
  recommendationFor,
  sortReport,
} from "./model.js";
export type {
  ArchitectureViolation,
  Classification,
  DependencyClassification,
  Disposition,
  ExtractionReport,
  ExtractionStatus,
  FileKind,
  FileRecord,
  ManualMigrationItem,
  ProviderIntegration,
} from "./model.js";
export { dependencyRoot, extractImports, isCodeFile, safeDestinationPath, scanSource } from "./scan.js";
export type { ScannedCodeFile, ScannedFile, SourceImport } from "./scan.js";

export interface ExtractOptions {
  /** Source application directory (untrusted input; never executed). */
  readonly source: string;
  /** Destination product directory (must not exist). */
  readonly destination: string;
  /** Optional Forge repository root, used only for report context. */
  readonly root?: string;
  /** Product id (slug). Derived from the source directory name when absent. */
  readonly productId?: string;
  /** Primary archetype. Defaults to analyzer with a MANUAL review item. */
  readonly primaryArchetype?: string;
  readonly capabilities?: readonly string[];
  readonly requiresWorker?: boolean;
  readonly requiresAIProvider?: boolean;
}

export interface ExtractResult {
  readonly productPath: string;
  readonly report: ExtractionReport;
  readonly reportJsonPath: string;
  readonly reportMarkdownPath: string;
}

interface SourcePackageJson {
  readonly name?: string;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly scripts?: Readonly<Record<string, string>>;
}

const GENERATED_PATHS = new Set([
  "extraction-report.json",
  "extraction-report.md",
  "package.original.json",
  "product.manifest.original.ts",
  "src/providers.original.ts",
]);

function safePrefixResolved(root: string, candidate: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`);
}

/** Reads and parses the source package.json (deterministic; errors reported). */
function readSourcePackageJson(sourceRoot: string): { manifest?: SourcePackageJson; error?: string } {
  const absoluteFile = path.join(sourceRoot, "package.json");
  if (!fs.existsSync(absoluteFile)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(absoluteFile, "utf8")) as SourcePackageJson;
    return { manifest: parsed };
  } catch (error) {
    return { error: `Source package.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Builds the product manifest values for the extracted product. The archetype
 * is never inferred from code — it defaults to analyzer and is flagged MANUAL
 * for human confirmation. The product id comes from --name, then the
 * destination directory name, then the source directory name.
 */
function resolveExtractedSpec(
  options: ExtractOptions,
  sourceRoot: string,
  destinationRoot: string,
): { spec: ProductSpec; archetypeDefaulted: boolean; idDerivation: string } {
  let productId = options.productId?.trim() ?? "";
  let idDerivation = "explicit --name";
  if (productId === "") {
    const fromDestination = slugifyProductId(path.basename(destinationRoot));
    if (fromDestination !== undefined) {
      productId = fromDestination;
      idDerivation = "destination directory name";
    } else {
      const fromSource = slugifyProductId(path.basename(sourceRoot));
      if (fromSource === undefined) {
        throw new ExtractError(
          `Cannot derive a valid product id from the destination or source directory name; pass --name <product-id>.`,
        );
      }
      productId = fromSource;
      idDerivation = "source directory name";
    }
  }
  if (!isValidProductId(productId)) {
    throw new ExtractError(
      `Invalid product id "${productId}": must be a slug matching /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.`,
    );
  }

  const archetypeValue = options.primaryArchetype ?? Archetype.ANALYZER;
  const archetypeDefaulted = options.primaryArchetype === undefined;
  if (!isArchetype(archetypeValue)) {
    throw new ExtractError(
      `Invalid archetype "${archetypeValue}": must be one of ${Object.values(Archetype).join(", ")}.`,
    );
  }

  const capabilities = options.capabilities ?? [];
  for (const capability of capabilities) {
    if (!isCapability(capability)) {
      throw new ExtractError(`Invalid capability "${capability}".`);
    }
  }

  const spec: ProductSpec = {
    id: productId,
    displayName: toHumanName(productId),
    tagline: defaultTagline(archetypeValue),
    primaryArchetype: archetypeValue,
    capabilities: capabilities as Capability[],
    requiresWorker: options.requiresWorker ?? false,
    requiresAIProvider: options.requiresAIProvider ?? false,
  };

  const validated = validateProductManifest({
    id: spec.id,
    displayName: spec.displayName,
    tagline: spec.tagline,
    primaryArchetype: spec.primaryArchetype,
    capabilities: spec.capabilities,
    plans: [],
    requiresWorker: spec.requiresWorker,
    requiresAIProvider: spec.requiresAIProvider,
  });
  if (!validated.ok) {
    throw new ExtractError(`Invalid product definition: ${validated.error.message}`);
  }
  return { spec, archetypeDefaulted, idDerivation };
}

/** Builds the generated package.json for an extracted product. */
function buildExtractedPackageJson(
  spec: ProductSpec,
  sourceManifest: SourcePackageJson | undefined,
): string {
  const dependencies: Record<string, string> = {
    ...BASE_PRODUCT_DEPENDENCIES,
    ...capabilityDependencies(spec),
  };

  const sourceDependencies = sourceManifest?.dependencies ?? {};
  for (const [dependency, version] of Object.entries(sourceDependencies).sort(([a], [b]) => a.localeCompare(b))) {
    if (dependencies[dependency] !== undefined) continue;
    const classified = classifyDependency(dependency);
    if (classified.classification === "SAFE") {
      dependencies[dependency] = version;
    }
  }

  const devDependencies: Record<string, string> = {};
  const sourceDevDependencies = sourceManifest?.devDependencies ?? {};
  for (const [dependency, conventionVersion] of Object.entries(PRODUCT_DEV_DEPENDENCIES)) {
    devDependencies[dependency] = sourceDevDependencies[dependency] ?? conventionVersion;
  }
  for (const dependency of Object.keys(sourceDevDependencies).sort()) {
    if (dependency.startsWith("@types/") && devDependencies[dependency] === undefined) {
      devDependencies[dependency] = sourceDevDependencies[dependency] ?? "";
    }
  }

  return `${JSON.stringify(
    {
      name: spec.id,
      version: "0.0.1",
      description: `${spec.displayName} — Forge V3 product (${spec.primaryArchetype} archetype, extracted)`,
      private: true,
      type: "module",
      scripts: {
        build: "tsc",
        typecheck: "tsc --noEmit",
        lint: "eslint .",
        test: "vitest run",
      },
      dependencies,
      devDependencies,
    },
    null,
    2,
  )}\n`;
}

/**
 * Extracts the source application into a Forge product at the destination.
 * Deterministic for identical inputs; writes only inside the destination.
 */
export function extractProduct(options: ExtractOptions): ExtractResult {
  const sourceRoot = path.resolve(options.source);
  if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) {
    throw new ExtractError(`Source ${options.source} does not exist or is not a directory.`);
  }

  const destinationRoot = path.resolve(options.destination);
  if (fs.existsSync(destinationRoot)) {
    throw new ExtractError(`Destination ${options.destination} already exists; refusing to overwrite.`);
  }
  if (safePrefixResolved(sourceRoot, destinationRoot)) {
    throw new ExtractError("Destination must not be the source directory or inside it.");
  }
  if (safePrefixResolved(destinationRoot, sourceRoot)) {
    throw new ExtractError("Source must not be inside the destination directory.");
  }

  const { spec, archetypeDefaulted, idDerivation } = resolveExtractedSpec(options, sourceRoot, destinationRoot);
  const warnings: string[] = [];
  if (idDerivation !== "explicit --name") {
    warnings.push(`Product id "${spec.id}" derived from the ${idDerivation}; pass --name to set it explicitly.`);
  }
  const errors: string[] = [];

  // 1. Scan the source.
  const scanned = scanSource(sourceRoot);
  const filesExcluded: string[] = [];
  for (const skipped of scanned.skipped) {
    if (skipped.kind === "file") {
      filesExcluded.push(skipped.path);
      warnings.push(`Excluded ${skipped.path}: ${skipped.reason}`);
    } else {
      warnings.push(`Skipped ${skipped.path}: ${skipped.reason}`);
    }
  }
  if (scanned.files.length === 0) {
    warnings.push("No files discovered in the source directory.");
  }

  // 2. Inspect source package.json.
  const sourcePackage = readSourcePackageJson(sourceRoot);
  if (sourcePackage.error !== undefined) errors.push(sourcePackage.error);
  if (sourcePackage.manifest === undefined) {
    warnings.push("Source has no package.json; dependencies are derived from imports only.");
  }

  // 3. Classify every file.
  const records: FileRecord[] = [];
  const providerFiles = new Map<string, Set<string>>(); // vendor root -> files
  const importData: { relativePath: string; imports: readonly SourceImport[] }[] = [];
  let codeFileCount = 0;

  for (const file of scanned.files) {
    const kind = isCodeFile(file.relativePath)
      ? "code"
      : file.relativePath.endsWith(".md")
        ? "documentation"
        : file.relativePath.endsWith(".json")
          ? "config"
          : "data";
    let imports: readonly SourceImport[] = [];
    let dynamicSpecifiers: readonly SourceImport[] = [];
    let content = "";
    if (kind === "code") {
      codeFileCount += 1;
      try {
        const extracted = extractImports(file);
        imports = extracted.imports;
        dynamicSpecifiers = extracted.dynamicSpecifiers;
        content = fs.readFileSync(file.absolutePath, "utf8");
      } catch (error) {
        errors.push(`Cannot read ${file.relativePath}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      importData.push({ relativePath: file.relativePath, imports });
    }

    const classified = classifyFile({
      relativePath: file.relativePath,
      kind,
      imports,
      dynamicSpecifiers,
      content,
    });

    // Destination mapping.
    let destinationPath = file.relativePath;
    let disposition: FileRecord["disposition"] = "COPY";
    let reason = classified.reasons.join("; ") || "Ordinary source file";
    const baseName = path.basename(file.relativePath);

    if (baseName === "package.json" && file.relativePath === "package.json") {
      destinationPath = "package.original.json";
      disposition = "TRANSFORM";
      reason = "Dependency manifest archived; a Forge package.json is generated";
    } else if (baseName === "product.manifest.ts" && file.relativePath === "product.manifest.ts") {
      destinationPath = "product.manifest.original.ts";
      disposition = "TRANSFORM";
      reason = "Existing product manifest archived; a static manifest is generated";
    } else if (baseName === "providers.ts" && file.relativePath === "src/providers.ts") {
      destinationPath = "src/providers.original.ts";
      disposition = "TRANSFORM";
      reason = "Existing providers file archived; the composition root is regenerated";
    } else if (GENERATED_PATHS.has(file.relativePath) || GENERATED_PATHS.has(destinationPath)) {
      disposition = "EXCLUDE";
      reason = "Reserved Forge path; the generated file takes precedence";
    }

    for (const vendorRoot of classified.vendorImports) {
      let files = providerFiles.get(vendorRoot);
      if (files === undefined) {
        files = new Set();
        providerFiles.set(vendorRoot, files);
      }
      files.add(file.relativePath);
    }
    // Database libraries surface as REVIEW integrations behind the special
    // "database" port (PostgreSQL is not swappable, frozen principle P7).
    for (const sourceImport of imports) {
      const root = dependencyRoot(sourceImport.specifier);
      if (DATABASE_DEPENDENCIES.has(root)) {
        let files = providerFiles.get(root);
        if (files === undefined) {
          files = new Set();
          providerFiles.set(root, files);
        }
        files.add(file.relativePath);
      }
    }

    records.push({
      path: file.relativePath,
      destinationPath,
      size: file.size,
      kind,
      classification: classified.classification,
      disposition,
      vendorImports: classified.vendorImports,
      reason,
    });
  }

  if (codeFileCount === 0) {
    warnings.push("Source contains no code files; the product skeleton is generated as-is.");
  }

  // 4. Dependency classification (imports + source package.json).
  const dependencyClassifications: DependencyClassification[] = [];
  {
    const byDependency = new Map<string, { classification: Classification; category: string; usedBy: Set<string> }>();
    for (const entry of importData) {
      for (const sourceImport of entry.imports) {
        const specifier = sourceImport.specifier;
        if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("@/")) continue;
        const root = dependencyRoot(specifier);
        const classified = classifyDependency(root);
        let item = byDependency.get(root);
        if (item === undefined) {
          item = { classification: classified.classification, category: classified.category, usedBy: new Set() };
          byDependency.set(root, item);
        }
        item.usedBy.add(entry.relativePath);
      }
    }
    for (const dependency of Object.keys(sourcePackage.manifest?.dependencies ?? {})) {
      const root = dependencyRoot(dependency);
      if (!byDependency.has(root)) {
        const classified = classifyDependency(root);
        byDependency.set(root, {
          classification: classified.classification,
          category: classified.category,
          usedBy: new Set(["package.json"]),
        });
      }
    }
    for (const [dependency, entry] of byDependency) {
      dependencyClassifications.push({
        dependency,
        classification: entry.classification,
        category: entry.category,
        usedBy: [...entry.usedBy].sort(),
      });
    }
    dependencyClassifications.sort((left, right) => left.dependency.localeCompare(right.dependency));
  }

  // 5. Provider integrations.
  const providerIntegrations: readonly ProviderIntegration[] = sortReport(
    [...providerFiles.entries()].map(([vendor, files]) => {
      const category = VENDOR_CATEGORIES[vendor] ?? (DATABASE_DEPENDENCIES.has(vendor) ? "database" : "unclassified");
      const integrationFiles = [...files].sort();
      return {
        vendor,
        category,
        port: PORT_BY_CATEGORY[category] ?? "none",
        classification: "REVIEW" as const,
        files: integrationFiles,
        recommendation: recommendationFor(category, vendor),
      };
    }),
    (entry) => entry.vendor,
  );

  // 6. Architecture violations (static, deterministic).
  const architectureViolations: ArchitectureViolation[] = [];
  for (const record of records) {
    if (record.classification === "MANUAL") {
      architectureViolations.push({
        file: record.path,
        rule: "MANUAL_MIGRATION_REQUIRED",
        message: record.reason,
        remediation: "Migrate manually; the item is listed in manualMigrationItems with remediation.",
      });
    } else if (record.vendorImports.length > 0) {
      architectureViolations.push({
        file: record.path,
        rule: "VENDOR_IMPORT_IN_PRODUCT",
        message: `Direct vendor SDK import(s): ${record.vendorImports.join(", ")}. Vendor SDKs may only appear inside packages/adapters/*.`,
        remediation: `Move the ${record.vendorImports.join(", ")} integration behind the appropriate Forge port (see providerIntegrations).`,
      });
    }
  }
  architectureViolations.sort((left, right) => left.file.localeCompare(right.file));

  // 7. Manual migration items.
  const manualMigrationItems: ManualMigrationItem[] = [];
  if (archetypeDefaulted) {
    manualMigrationItems.push({
      id: "archetype-review",
      area: "product.manifest.ts",
      description: "The primary archetype cannot be inferred automatically; it defaults to analyzer.",
      remediation: "Confirm or change primaryArchetype in product.manifest.ts before implementation.",
      blocking: false,
    });
  }
  let fileIndex = 0;
  for (const record of records) {
    if (record.classification !== "MANUAL") continue;
    fileIndex += 1;
    manualMigrationItems.push({
      id: `file-${fileIndex}`,
      area: record.path,
      description: record.reason,
      remediation:
        "Review this file manually: remove hardcoded secrets, replace dynamic code with " +
        "static imports, or move vendor integrations behind Forge ports before the " +
        "product can pass arch-check.",
      blocking: true,
    });
  }
  for (const integration of providerIntegrations) {
    manualMigrationItems.push({
      id: `provider-${integration.vendor}`,
      area: integration.category,
      description: `Provider integration ${integration.vendor} (${integration.category}) used by ${integration.files.length} file(s).`,
      remediation: integration.recommendation,
      blocking: false,
    });
  }
  // Archived code files (a pre-existing providers.ts or manifest) need review;
  // the archived package.json is a passive reference artifact and is not a
  // migration item by itself (its dependency reclassification is captured in
  // dependencyClassifications and providerIntegrations).
  for (const record of records) {
    if (record.disposition === "TRANSFORM" && record.destinationPath !== "package.original.json") {
      manualMigrationItems.push({
        id: `archive-${record.destinationPath.replace(/[^a-z0-9.-]+/gi, "-")}`,
        area: record.destinationPath,
        description: `Original ${record.path} archived at ${record.destinationPath} during extraction.`,
        remediation: `Review ${record.destinationPath} and migrate anything still needed into the Forge structure.`,
        blocking: false,
      });
    }
  }
  manualMigrationItems.sort((left, right) => left.id.localeCompare(right.id));

  // 8. Write the product.
  const generatedFiles = buildProductFileMap(spec);
  const generatedDocs: string[] = [];
  const filesCopied: string[] = [];
  const filesTransformed: string[] = [];

  fs.mkdirSync(destinationRoot, { recursive: true });

  const writeGenerated = (relativePath: string, content: string): void => {
    const absoluteFile = safeDestinationPath(destinationRoot, relativePath);
    fs.mkdirSync(path.dirname(absoluteFile), { recursive: true });
    fs.writeFileSync(absoluteFile, content, "utf8");
  };

  // Manifest, composition root, package.json.
  const generatedByPath = new Map(generatedFiles.map((file) => [file.path, file.content]));
  const manifestSource = generatedByPath.get("product.manifest.ts");
  const providersSource = generatedByPath.get("src/providers.ts");
  if (manifestSource === undefined || providersSource === undefined) {
    throw new ExtractError("Internal error: product templates are incomplete.");
  }
  writeGenerated("product.manifest.ts", manifestSource);
  writeGenerated("src/providers.ts", providersSource);
  writeGenerated("package.json", buildExtractedPackageJson(spec, sourcePackage.manifest));
  filesTransformed.push("product.manifest.ts", "src/providers.ts", "package.json");

  // tsconfig: the source's is preserved when present.
  const sourceTsconfig = scanned.files.find((file) => file.relativePath === "tsconfig.json");
  if (sourceTsconfig === undefined) {
    const tsconfigSource = generatedByPath.get("tsconfig.json");
    if (tsconfigSource === undefined) throw new ExtractError("Internal error: tsconfig template is incomplete.");
    writeGenerated("tsconfig.json", tsconfigSource);
    filesTransformed.push("tsconfig.json");
  } else {
    warnings.push("Source tsconfig.json is preserved; verify it matches Forge build conventions.");
  }

  // README and required docs: the source's files win when present.
  const sourceReadme = scanned.files.find((file) => file.relativePath === "README.md");
  if (sourceReadme === undefined) {
    const readmeSource = generatedByPath.get("README.md");
    if (readmeSource === undefined) throw new ExtractError("Internal error: README template is incomplete.");
    writeGenerated("README.md", readmeSource);
  }
  for (const document of REQUIRED_PRODUCT_DOCUMENTS) {
    const sourceDoc = scanned.files.find((file) => file.relativePath === `docs/${document}`);
    if (sourceDoc === undefined) {
      const docSource = generatedByPath.get(`docs/${document}`);
      if (docSource === undefined) throw new ExtractError("Internal error: doc template is incomplete.");
      writeGenerated(`docs/${document}`, docSource);
      generatedDocs.push(`docs/${document}`);
    }
  }

  // Copy every classified file.
  for (const record of records) {
    if (record.disposition === "EXCLUDE") {
      filesExcluded.push(record.path);
      continue;
    }
    const sourceAbsolute = path.join(sourceRoot, record.path);
    const destinationAbsolute = safeDestinationPath(destinationRoot, record.destinationPath);
    try {
      const content = fs.readFileSync(sourceAbsolute);
      fs.mkdirSync(path.dirname(destinationAbsolute), { recursive: true });
      fs.writeFileSync(destinationAbsolute, content);
      if (record.disposition === "COPY") filesCopied.push(record.destinationPath);
      else filesTransformed.push(record.destinationPath);
    } catch (error) {
      errors.push(`Cannot copy ${record.path}: ${error instanceof Error ? error.message : String(error)}`);
      filesExcluded.push(record.path);
    }
  }

  // 9. Report.
  const status: ExtractionReport["status"] = errors.length > 0
    ? "failed"
    : manualMigrationItems.length > 0 || providerIntegrations.length > 0
      ? "complete-with-manual-migration"
      : "complete";

  const report: ExtractionReport = {
    schemaVersion: 1,
    tool: { name: "@forge/extract-product", version: TOOL_VERSION },
    productId: spec.id,
    source: options.source,
    destination: options.destination,
    status,
    filesDiscovered: sortReport(records, (record) => record.path),
    filesCopied: [...filesCopied].sort(),
    filesTransformed: [...filesTransformed].sort(),
    filesExcluded: [...filesExcluded].sort(),
    providerIntegrations,
    dependencyClassifications,
    architectureViolations,
    manualMigrationItems,
    warnings: [...warnings].sort(),
    errors: [...errors].sort(),
    generated: {
      manifest: true,
      providers: true,
      packageJson: true,
      docs: [...generatedDocs].sort(),
    },
  };

  const reportJsonPath = safeDestinationPath(destinationRoot, "extraction-report.json");
  const reportMarkdownPath = safeDestinationPath(destinationRoot, "extraction-report.md");
  fs.writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(reportMarkdownPath, renderReportMarkdown(report), "utf8");

  return { productPath: destinationRoot, report, reportJsonPath, reportMarkdownPath };
}

// ---------------------------------------------------------------------------
// Human-readable report
// ---------------------------------------------------------------------------

function renderReportMarkdown(report: ExtractionReport): string {
  const lines: string[] = [];
  lines.push(`# Extraction Report — ${report.productId}`);
  lines.push("");
  lines.push(`**Status:** ${report.status}`);
  lines.push("");
  lines.push("## Overview");
  lines.push("");
  lines.push(`- **Source:** ${report.source}`);
  lines.push(`- **Destination:** ${report.destination}`);
  lines.push(`- **Product identity:** ${report.productId}`);
  lines.push(`- **Tool:** ${report.tool.name} ${report.tool.version}`);
  lines.push("");
  lines.push("## Files");
  lines.push("");
  lines.push(`- **Discovered:** ${report.filesDiscovered.length}`);
  lines.push(`- **Copied:** ${report.filesCopied.length}`);
  lines.push(`- **Transformed:** ${report.filesTransformed.length}`);
  lines.push(`- **Excluded:** ${report.filesExcluded.length}`);
  lines.push("");
  lines.push("### Classification");
  lines.push("");
  lines.push("| File | Classification | Disposition | Reason |");
  lines.push("| --- | --- | --- | --- |");
  for (const file of report.filesDiscovered) {
    lines.push(`| \`${file.path}\` | ${file.classification} | ${file.disposition} | ${file.reason} |`);
  }
  lines.push("");
  if (report.providerIntegrations.length > 0) {
    lines.push("## Provider integrations");
    lines.push("");
    for (const integration of report.providerIntegrations) {
      lines.push(`### ${integration.vendor} (${integration.category})`);
      lines.push("");
      lines.push(`- **Port:** ${integration.port}`);
      lines.push(`- **Classification:** ${integration.classification}`);
      lines.push(`- **Files:** ${integration.files.map((file) => `\`${file}\``).join(", ")}`);
      lines.push(`- **Recommendation:** ${integration.recommendation}`);
      lines.push("");
    }
  }
  if (report.dependencyClassifications.length > 0) {
    lines.push("## Dependency classification");
    lines.push("");
    lines.push("| Dependency | Classification | Category | Used by |");
    lines.push("| --- | --- | --- | --- |");
    for (const dependency of report.dependencyClassifications) {
      lines.push(
        `| \`${dependency.dependency}\` | ${dependency.classification} | ${dependency.category} | ${dependency.usedBy.length} file(s) |`,
      );
    }
    lines.push("");
  }
  if (report.architectureViolations.length > 0) {
    lines.push("## Architecture violations");
    lines.push("");
    for (const violation of report.architectureViolations) {
      lines.push(`- **\`${violation.file}\`** [${violation.rule}]: ${violation.message}`);
      lines.push(`  Remediation: ${violation.remediation}`);
    }
    lines.push("");
  }
  if (report.manualMigrationItems.length > 0) {
    lines.push("## Manual migration items");
    lines.push("");
    lines.push("Items below are NOT transformed automatically. Work through each one and");
    lines.push("re-run `pnpm extraction-validate` until the product is compliant.");
    lines.push("");
    for (const item of report.manualMigrationItems) {
      lines.push(`- **[${item.blocking ? "BLOCKING" : "advisory"}] ${item.id}** — ${item.description}`);
      lines.push(`  Remediation: ${item.remediation}`);
    }
    lines.push("");
  }
  if (report.warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const warning of report.warnings) lines.push(`- ${warning}`);
    lines.push("");
  }
  if (report.errors.length > 0) {
    lines.push("## Errors");
    lines.push("");
    for (const error of report.errors) lines.push(`- ${error}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
