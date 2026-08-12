/**
 * @forge/extraction-validate — Forge V3 extraction validation gate.
 *
 * Validates a product after creation or extraction:
 *
 *   1. product manifest (static, schema-valid, identity)
 *   2. product directory structure
 *   3. required product documents
 *   4. package boundaries            (delegated to @forge/architecture-check)
 *   5. provider isolation
 *   6. forbidden vendor imports
 *   7. Forge package dependency direction (delegated where in a repository)
 *   8. unresolved dependencies
 *   9. required ports (capability -> subsystem packages, provider wiring)
 *  10. adapter/provider access only through providers.ts
 *  11. documentation completeness     (delegated to @forge/validate-docs in a
 *      repository; enforced locally for standalone product directories)
 *  12. extraction classification requirements (extraction-report.json)
 *  13. architecture checker compatibility
 *
 * Generic architecture enforcement is delegated to Task 009's checker — this
 * tool never re-implements it.
 */

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { validateProductManifest } from "@forge/config";
import type { ProductManifest } from "@forge/config";
import { checkRepository } from "@forge/architecture-check";
import { validateDocumentation, REQUIRED_PRODUCT_DOCUMENTS } from "@forge/validate-docs";
import {
  CAPABILITY_DEPENDENCIES,
  REQUIRED_PRODUCT_DOCUMENTS as PRODUCT_DOCUMENT_NAMES,
  extractManifestObject,
} from "@forge/create-product";
import { extractImports, isCodeFile, scanSource } from "@forge/extract-product";
import { VENDOR_CATEGORIES } from "@forge/extract-product";
import type { ExtractionReport } from "@forge/extract-product";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export type Severity = "error" | "warning";

export interface ValidationDiagnostic {
  readonly rule: string;
  readonly severity: Severity;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
  readonly remediation: string;
}

export interface ValidationReport {
  readonly productPath: string;
  readonly mode: "repo" | "standalone";
  readonly diagnostics: readonly ValidationDiagnostic[];
  readonly errors: readonly ValidationDiagnostic[];
  readonly warnings: readonly ValidationDiagnostic[];
}

export interface ValidationOptions {
  /** Repository root (used for repo-mode delegation and path resolution). */
  readonly root?: string;
  /** Product directory path or product name under apps/. */
  readonly product: string;
}

const KNOWN_FORGE_PACKAGES: ReadonlySet<string> = new Set([
  "ai-provider",
  "analytics",
  "auth",
  "billing",
  "config",
  "db",
  "domain",
  "email",
  "jobs",
  "reporting",
  "shared",
  "storage",
  "testing",
  "ui",
]);

const REQUIRED_DOCUMENT_SECTIONS: Readonly<Partial<Record<(typeof REQUIRED_PRODUCT_DOCUMENTS)[number], RegExp>>> = {
  "SETUP.md": /environment/i,
  "DATABASE.md": /schema/i,
  "PROVIDERS.md": /replac|switch|migration/i,
  "SECURITY.md": /security model|threat|authentication|authorization/i,
  "ACQUISITION.md": /extraction|handoff|migration/i,
};

const STUB_MARKERS = /\b(?:FIXME|TBD|TODO)\b|lorem ipsum|to be implemented|placeholder content/i;

function wordCount(markdown: string): number {
  return (markdown.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

function headings(markdown: string): string[] {
  return [...markdown.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => match[1]?.trim() ?? "");
}

function isInside(parent: string, candidate: string): boolean {
  const resolvedParent = path.resolve(parent);
  const resolvedCandidate = path.resolve(candidate);
  return resolvedCandidate === resolvedParent || resolvedCandidate.startsWith(`${resolvedParent}${path.sep}`);
}

// ---------------------------------------------------------------------------
// Manifest checks
// ---------------------------------------------------------------------------

interface ManifestCheckResult {
  readonly manifest?: ProductManifest;
  readonly diagnostics: readonly ValidationDiagnostic[];
}

function checkManifest(productPath: string): ManifestCheckResult {
  const diagnostics: ValidationDiagnostic[] = [];
  const manifestFile = path.join(productPath, "product.manifest.ts");
  const relativeFile = "product.manifest.ts";

  if (!fs.existsSync(manifestFile)) {
    diagnostics.push({
      rule: "MANIFEST_MISSING",
      severity: "error",
      file: relativeFile,
      line: 1,
      column: 1,
      message: "product.manifest.ts is required at the product root (frozen V3 §8.1).",
      remediation: "Create product.manifest.ts with a static defineProductManifest({ ... }) literal.",
    });
    return { diagnostics };
  }

  let sourceText: string;
  try {
    sourceText = fs.readFileSync(manifestFile, "utf8");
  } catch (error) {
    diagnostics.push({
      rule: "MANIFEST_UNREADABLE",
      severity: "error",
      file: relativeFile,
      line: 1,
      column: 1,
      message: `Cannot read product.manifest.ts: ${error instanceof Error ? error.message : String(error)}`,
      remediation: "Make the manifest readable and re-run extraction-validate.",
    });
    return { diagnostics };
  }

  const extraction = extractManifestObject(sourceText);
  if (!extraction.ok) {
    diagnostics.push({
      rule: "MANIFEST_NOT_STATIC",
      severity: "error",
      file: relativeFile,
      line: extraction.line,
      column: extraction.column,
      message: extraction.message,
      remediation:
        "Rewrite product.manifest.ts so the manifest is a plain literal object " +
        "(defineProductManifest({ ... }) with literal values only).",
    });
    return { diagnostics };
  }

  const validated = validateProductManifest(extraction.value);
  if (!validated.ok) {
    diagnostics.push({
      rule: "MANIFEST_INVALID",
      severity: "error",
      file: relativeFile,
      line: 1,
      column: 1,
      message: `Manifest does not satisfy the frozen @forge/config schema: ${validated.error.message}`,
      remediation: "Fix the reported manifest field; the schema is defined in packages/config/src/product-manifest.ts.",
    });
    return { diagnostics };
  }

  return { manifest: validated.value, diagnostics };
}

// ---------------------------------------------------------------------------
// Structure checks
// ---------------------------------------------------------------------------

function checkStructure(productPath: string, diagnostics: ValidationDiagnostic[]): void {
  const requiredFiles: ReadonlyArray<readonly [string, string, string]> = [
    ["package.json", "PACKAGE_MANIFEST_MISSING", "A Forge product must have a package.json."],
    ["tsconfig.json", "TSCONFIG_MISSING", "A Forge product must have a tsconfig.json."],
    ["README.md", "README_MISSING", "A Forge product must have a README.md."],
    ["src/providers.ts", "PROVIDERS_MISSING", "src/providers.ts is the required composition root (frozen rule 2.4)."],
  ];
  const requiredDirectories: ReadonlyArray<readonly [string, string, string]> = [
    ["src", "SRC_DIRECTORY_MISSING", "A Forge product must have a src/ directory."],
    ["docs", "DOCS_DIRECTORY_MISSING", "A Forge product must have a docs/ directory."],
  ];

  for (const [relative, rule, message] of requiredFiles) {
    if (!fs.existsSync(path.join(productPath, relative))) {
      diagnostics.push({
        rule,
        severity: "error",
        file: relative,
        line: 1,
        column: 1,
        message,
        remediation: `Create ${relative}; a generated product provides it, an extracted product may need manual completion.`,
      });
    }
  }
  for (const [relative, rule, message] of requiredDirectories) {
    if (!fs.existsSync(path.join(productPath, relative)) || !fs.statSync(path.join(productPath, relative)).isDirectory()) {
      diagnostics.push({
        rule,
        severity: "error",
        file: relative,
        line: 1,
        column: 1,
        message,
        remediation: `Create the ${relative}/ directory.`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// package.json checks
// ---------------------------------------------------------------------------

interface PackageManifest {
  readonly name?: string;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
}

function readPackageManifest(productPath: string): { manifest?: PackageManifest; diagnostics: ValidationDiagnostic[] } {
  const diagnostics: ValidationDiagnostic[] = [];
  const packageFile = path.join(productPath, "package.json");
  if (!fs.existsSync(packageFile)) {
    return { diagnostics };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(packageFile, "utf8")) as PackageManifest;
    return { manifest: parsed, diagnostics };
  } catch (error) {
    diagnostics.push({
      rule: "PACKAGE_MANIFEST_INVALID",
      severity: "error",
      file: "package.json",
      line: 1,
      column: 1,
      message: `package.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      remediation: "Fix package.json so it parses as JSON.",
    });
    return { diagnostics };
  }
}

// ---------------------------------------------------------------------------
// Capability -> subsystem dependency checks (required ports)
// ---------------------------------------------------------------------------

function checkCapabilityDependencies(
  manifest: ProductManifest,
  packageManifest: PackageManifest | undefined,
  diagnostics: ValidationDiagnostic[],
): void {
  const required: Array<{ reason: string; dependency: string }> = [];
  for (const capability of manifest.capabilities) {
    const dependency = CAPABILITY_DEPENDENCIES[capability];
    if (dependency !== undefined) {
      required.push({ reason: `capability "${capability}"`, dependency });
    }
  }
  if (manifest.requiresWorker) {
    required.push({ reason: "requiresWorker", dependency: "@forge/jobs" });
  }
  if (manifest.requiresAIProvider) {
    required.push({ reason: "requiresAIProvider", dependency: "@forge/ai-provider" });
  }

  const declared = packageManifest?.dependencies ?? {};
  for (const entry of required) {
    if (declared[entry.dependency] === undefined) {
      diagnostics.push({
        rule: "CAPABILITY_DEPENDENCY",
        severity: "error",
        file: "package.json",
        line: 1,
        column: 1,
        message: `${entry.reason} requires ${entry.dependency} to be declared in dependencies.`,
        remediation: `Add "${entry.dependency}": "workspace:*" to the product's dependencies.`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Provider isolation, vendor leakage, forge dependency direction (standalone)
// ---------------------------------------------------------------------------

interface ProvidersImports {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly importedNames: readonly string[];
}

function providersExports(providersPath: string): ReadonlySet<string> {
  const text = fs.readFileSync(providersPath, "utf8");
  const source = ts.createSourceFile(providersPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const exports_ = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isVariableStatement(node) && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) exports_.add(declaration.name.text);
      }
    } else if (
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
      node.name !== undefined &&
      node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      exports_.add(node.name.text);
    } else if (ts.isExportDeclaration(node) && node.exportClause !== undefined && ts.isNamedExports(node.exportClause)) {
      for (const element of node.exportClause.elements) exports_.add(element.name.text);
    } else if (ts.isExportAssignment(node)) {
      exports_.add("default");
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return exports_;
}

function checkProviderIsolation(
  productPath: string,
  mode: "repo" | "standalone",
  diagnostics: ValidationDiagnostic[],
): void {
  const scanned = scanSource(productPath);
  const providersPath = path.join(productPath, "src/providers.ts");
  let providersExportNames: ReadonlySet<string> = new Set();
  if (fs.existsSync(providersPath)) {
    try {
      providersExportNames = providersExports(providersPath);
    } catch (error) {
      diagnostics.push({
        rule: "PROVIDERS_INVALID",
        severity: "error",
        file: "src/providers.ts",
        line: 1,
        column: 1,
        message: `Cannot parse src/providers.ts: ${error instanceof Error ? error.message : String(error)}`,
        remediation: "Fix src/providers.ts so it parses as a TypeScript module.",
      });
    }
  }

  const providersImports: ProvidersImports[] = [];

  for (const file of scanned.files) {
    if (!isCodeFile(file.relativePath)) continue;
    const extracted = extractImports(file);
    for (const sourceImport of extracted.imports) {
      const specifier = sourceImport.specifier;
      const root = specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0] ?? specifier;

      // In repository mode the architecture checker already enforces vendor
      // containment, adapter bypass, and Forge package resolution; only
      // standalone products need the local scan.
      if (mode === "standalone") {
        if (VENDOR_CATEGORIES[root] !== undefined) {
          diagnostics.push({
            rule: "VENDOR_LEAKAGE",
            severity: "error",
            file: file.relativePath,
            line: sourceImport.line,
            column: sourceImport.column,
            message: `Vendor SDK ${root} may only appear inside packages/adapters/*; product code must use Forge ports via src/providers.ts.`,
            remediation: `Remove the direct ${root} import and consume the capability through the matching Forge port (see the extraction report's providerIntegrations).`,
          });
        } else if (specifier.startsWith("@forge/adapter-")) {
          if (file.relativePath !== "src/providers.ts") {
            diagnostics.push({
              rule: "ADAPTER_BYPASS",
              severity: "error",
              file: file.relativePath,
              line: sourceImport.line,
              column: sourceImport.column,
              message: `Adapter package ${root} may only be imported by src/providers.ts (frozen rule 2.4).`,
              remediation: `Import the adapter in src/providers.ts and consume the wired port everywhere else.`,
            });
          }
        } else if (specifier.startsWith("@forge/")) {
          const packageName = root.slice("@forge/".length);
          const declared = readPackageManifest(productPath).manifest?.dependencies ?? {};
          if (!KNOWN_FORGE_PACKAGES.has(packageName) && !packageName.startsWith("adapter-")) {
            diagnostics.push({
              rule: "UNKNOWN_FORGE_PACKAGE",
              severity: "error",
              file: file.relativePath,
              line: sourceImport.line,
              column: sourceImport.column,
              message: `${root} is not a package defined by the frozen V3 package graph.`,
              remediation: `Replace the ${root} import with a frozen Forge package (shared, config, domain, db, ui, reporting, testing, or a port package).`,
            });
          } else if (declared[root] === undefined) {
            diagnostics.push({
              rule: "UNDECLARED_FORGE_DEPENDENCY",
              severity: "error",
              file: file.relativePath,
              line: sourceImport.line,
              column: sourceImport.column,
              message: `${root} is imported but not declared in package.json dependencies.`,
              remediation: `Declare "${root}": "workspace:*" in the product's package.json.`,
            });
          }
        }
      }
    }

    // Named imports from the providers module (checked against its exports).
    if (extracted.imports.some((sourceImport) => isProvidersSpecifier(sourceImport.specifier))) {
      const sourceText = fs.readFileSync(file.absolutePath, "utf8");
      const source = ts.createSourceFile(file.absolutePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const visit = (node: ts.Node): void => {
        if (ts.isImportDeclaration(node) && node.moduleSpecifier !== undefined && ts.isStringLiteralLike(node.moduleSpecifier)) {
          if (!isProvidersSpecifier(node.moduleSpecifier.text)) {
            ts.forEachChild(node, visit);
            return;
          }
          const clause = node.importClause;
          const names: string[] = [];
          if (clause?.namedBindings !== undefined && ts.isNamedImports(clause.namedBindings)) {
            for (const element of clause.namedBindings.elements) names.push(element.name.text);
          }
          if (clause?.name !== undefined) names.push("default");
          const position = source.getLineAndCharacterOfPosition(node.getStart(source));
          providersImports.push({
            file: file.relativePath,
            line: position.line + 1,
            column: position.character + 1,
            importedNames: names,
          });
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  }

  // Provider wiring: every named import from providers must exist as an export.
  for (const providersImport of providersImports) {
    for (const name of providersImport.importedNames) {
      if (!providersExportNames.has(name)) {
        diagnostics.push({
          rule: "PROVIDER_WIRING",
          severity: "error",
          file: providersImport.file,
          line: providersImport.line,
          column: providersImport.column,
          message: `${providersImport.file} imports "${name}" from providers, but src/providers.ts does not export it.`,
          remediation: `Export "${name}" from src/providers.ts (wiring an adapter or a typed placeholder) or remove the import.`,
        });
      }
    }
  }
}

function isProvidersSpecifier(specifier: string): boolean {
  return specifier === "providers" || specifier.endsWith("/providers") || specifier === "@/providers";
}

// ---------------------------------------------------------------------------
// Unresolved dependencies
// ---------------------------------------------------------------------------

function checkUnresolvedDependencies(
  productPath: string,
  root: string,
  mode: "repo" | "standalone",
  packageManifest: PackageManifest | undefined,
  diagnostics: ValidationDiagnostic[],
): void {
  const dependencies = packageManifest?.dependencies ?? {};
  const dependencyNames = Object.keys(dependencies).sort();

  if (mode === "standalone") {
    if (dependencyNames.length > 0) {
      diagnostics.push({
        rule: "RESOLUTION_UNVERIFIABLE",
        severity: "warning",
        file: "package.json",
        line: 1,
        column: 1,
        message:
          "Standalone product directory: dependency resolution cannot be verified outside a workspace. " +
          "Copy the product into apps/ of a Forge repository and run pnpm install.",
        remediation: "Integrate the product into a Forge repository (apps/<id>) and re-run extraction-validate.",
      });
    }
    return;
  }

  const productNodeModules = path.join(productPath, "node_modules");
  const rootNodeModules = path.join(root, "node_modules");
  const canVerify = fs.existsSync(productNodeModules) || fs.existsSync(rootNodeModules);
  if (!canVerify) {
    diagnostics.push({
      rule: "RESOLUTION_UNVERIFIABLE",
      severity: "warning",
      file: "package.json",
      line: 1,
      column: 1,
      message: "node_modules is absent; run pnpm install before dependency resolution can be verified.",
      remediation: "Run pnpm install, then re-run extraction-validate.",
    });
    return;
  }

  for (const dependency of dependencyNames) {
    if (dependency.startsWith("@forge/")) continue; // workspace deps are checked by arch-check
    const rootName = dependency.startsWith("@") ? dependency.split("/").slice(0, 2).join("/") : dependency.split("/")[0] ?? dependency;
    const resolved = fs.existsSync(path.join(productNodeModules, rootName)) || fs.existsSync(path.join(rootNodeModules, rootName));
    if (!resolved) {
      diagnostics.push({
        rule: "UNRESOLVED_DEPENDENCY",
        severity: "error",
        file: "package.json",
        line: 1,
        column: 1,
        message: `Dependency "${dependency}" is declared but cannot be resolved in the workspace installation.`,
        remediation: `Run pnpm install, or remove the dependency from package.json if it is unused.`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Documentation checks
// ---------------------------------------------------------------------------

function checkDocumentation(productPath: string, root: string, mode: "repo" | "standalone", diagnostics: ValidationDiagnostic[]): void {
  if (mode === "repo") {
    const report = validateDocumentation(root);
    for (const error of report.errors) {
      diagnostics.push({
        rule: "DOCUMENTATION",
        severity: "error",
        file: error.file,
        line: 1,
        column: 1,
        message: error.message,
        remediation: "Complete the document per the frozen documentation contract (see tools/validate-docs).",
      });
    }
    return;
  }

  const docsDirectory = path.join(productPath, "docs");
  for (const document of PRODUCT_DOCUMENT_NAMES) {
    const absoluteFile = path.join(docsDirectory, document);
    const relativeFile = `docs/${document}`;
    if (!fs.existsSync(absoluteFile)) {
      diagnostics.push({
        rule: "MISSING_PRODUCT_DOCUMENT",
        severity: "error",
        file: relativeFile,
        line: 1,
        column: 1,
        message: `Required product document ${document} is missing.`,
        remediation: `Write ${relativeFile} (substantive, more than 200 words).`,
      });
      continue;
    }
    const markdown = fs.readFileSync(absoluteFile, "utf8");
    const words = wordCount(markdown);
    if (words <= 200) {
      diagnostics.push({
        rule: "PRODUCT_DOCUMENT_STUB",
        severity: "error",
        file: relativeFile,
        line: 1,
        column: 1,
        message: `${relativeFile} has ${words} words; the frozen contract requires more than 200 words.`,
        remediation: `Expand ${relativeFile} with substantive product-specific content.`,
      });
    }
    if (STUB_MARKERS.test(markdown)) {
      diagnostics.push({
        rule: "PRODUCT_DOCUMENT_STUB",
        severity: "error",
        file: relativeFile,
        line: 1,
        column: 1,
        message: `${relativeFile} contains a stub marker (TODO/TBD/FIXME/placeholder).`,
        remediation: `Replace stub markers in ${relativeFile} with real content.`,
      });
    }
    const documentHeadings = headings(markdown);
    if (!/^#\s+\S/m.test(markdown) || !/^##\s+\S/m.test(markdown)) {
      diagnostics.push({
        rule: "DOCUMENT_STRUCTURE",
        severity: "error",
        file: relativeFile,
        line: 1,
        column: 1,
        message: `${relativeFile} must contain a level-one title and at least one level-two section.`,
        remediation: `Add an H1 title and H2 sections to ${relativeFile}.`,
      });
    }
    const requiredSection = REQUIRED_DOCUMENT_SECTIONS[document];
    if (requiredSection !== undefined && !documentHeadings.some((heading) => requiredSection.test(heading))) {
      diagnostics.push({
        rule: "MISSING_REQUIRED_SECTION",
        severity: "error",
        file: relativeFile,
        line: 1,
        column: 1,
        message: `${relativeFile} is missing a required ${requiredSection.source} section.`,
        remediation: `Add the required section heading to ${relativeFile}.`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Architecture delegation (repo mode only)
// ---------------------------------------------------------------------------

function checkArchitecture(root: string, diagnostics: ValidationDiagnostic[]): void {
  const report = checkRepository({ root });
  for (const error of report.errors) {
    diagnostics.push({
      rule: "ARCHITECTURE_CHECK",
      severity: "error",
      file: error.file,
      line: error.line,
      column: error.column,
      message: `[${error.rule}] ${error.message}`,
      remediation: "Fix the boundary violation per .ai/boundaries.md and .ai/architecture-rules.md, then re-run pnpm arch-check.",
    });
  }
}

// ---------------------------------------------------------------------------
// Extraction report checks (classification requirements)
// ---------------------------------------------------------------------------

function checkExtractionReport(
  productPath: string,
  manifestId: string | undefined,
  diagnostics: ValidationDiagnostic[],
): void {
  const reportFile = path.join(productPath, "extraction-report.json");
  if (!fs.existsSync(reportFile)) return;

  let report: ExtractionReport;
  try {
    report = JSON.parse(fs.readFileSync(reportFile, "utf8")) as ExtractionReport;
  } catch (error) {
    diagnostics.push({
      rule: "EXTRACTION_REPORT_INVALID",
      severity: "error",
      file: "extraction-report.json",
      line: 1,
      column: 1,
      message: `extraction-report.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      remediation: "Re-run pnpm extract-product to regenerate the report, or remove it if the product was not extracted.",
    });
    return;
  }

  if (report.schemaVersion !== 1 || !Array.isArray(report.filesDiscovered) || !Array.isArray(report.manualMigrationItems)) {
    diagnostics.push({
      rule: "EXTRACTION_REPORT_INVALID",
      severity: "error",
      file: "extraction-report.json",
      line: 1,
      column: 1,
      message: "extraction-report.json does not match the extraction report schema (schemaVersion 1).",
      remediation: "Regenerate the report with pnpm extract-product.",
    });
    return;
  }

  if (report.status !== "complete" && report.status !== "complete-with-manual-migration") {
    diagnostics.push({
      rule: "EXTRACTION_STATUS_FAILED",
      severity: "error",
      file: "extraction-report.json",
      line: 1,
      column: 1,
      message: `The extraction report status is "${report.status}"; only complete or complete-with-manual-migration products are compliant.`,
      remediation: "Resolve the errors reported by the extractor and re-run pnpm extract-product.",
    });
  }

  if (manifestId !== undefined && report.productId !== manifestId) {
    diagnostics.push({
      rule: "REPORT_PRODUCT_MISMATCH",
      severity: "error",
      file: "extraction-report.json",
      line: 1,
      column: 1,
      message: `The extraction report identifies product "${report.productId}" but the manifest declares "${manifestId}".`,
      remediation: "Regenerate the report with the same product identity, or fix the manifest id.",
    });
  }

  for (const [index, item] of report.manualMigrationItems.entries()) {
    if (typeof item !== "object" || item === null || typeof item.id !== "string" || typeof item.description !== "string" || typeof item.remediation !== "string" || item.remediation.trim() === "") {
      diagnostics.push({
        rule: "EXTRACTION_MANUAL_ITEM_INVALID",
        severity: "error",
        file: "extraction-report.json",
        line: 1,
        column: 1,
        message: `manualMigrationItems[${index}] must carry a non-empty id, description, and remediation.`,
        remediation: "Regenerate the report with pnpm extract-product.",
      });
    }
  }

  // Classification consistency: files the report calls SAFE must not contain
  // vendor SDK imports; files listed as copied must still exist.
  const classificationByDestination = new Map<string, string>();
  for (const file of report.filesDiscovered) {
    if (file.disposition === "COPY" || file.disposition === "TRANSFORM") {
      classificationByDestination.set(file.destinationPath, file.classification);
    }
  }
  const scanned = scanSource(productPath);
  for (const file of scanned.files) {
    if (!isCodeFile(file.relativePath)) continue;
    const classification = classificationByDestination.get(file.relativePath);
    if (classification === undefined) continue;
    const extracted = extractImports(file);
    const vendorRoots = new Set<string>();
    for (const sourceImport of extracted.imports) {
      const root = sourceImport.specifier.startsWith("@")
        ? sourceImport.specifier.split("/").slice(0, 2).join("/")
        : sourceImport.specifier.split("/")[0] ?? sourceImport.specifier;
      if (VENDOR_CATEGORIES[root] !== undefined) vendorRoots.add(root);
    }
    if (vendorRoots.size > 0 && classification === "SAFE") {
      diagnostics.push({
        rule: "CLASSIFICATION_INCONSISTENT",
        severity: "error",
        file: file.relativePath,
        line: 1,
        column: 1,
        message: `extraction-report.json classifies ${file.relativePath} as SAFE, but it imports vendor SDK(s): ${[...vendorRoots].sort().join(", ")}.`,
        remediation: "Regenerate the extraction report (the extractor classifies this file REVIEW or MANUAL).",
      });
    }
  }
  for (const file of report.filesDiscovered) {
    if (file.disposition !== "COPY") continue;
    const destinationAbsolute = path.join(productPath, file.destinationPath);
    if (!fs.existsSync(destinationAbsolute)) {
      diagnostics.push({
        rule: "REPORTED_FILE_MISSING",
        severity: "warning",
        file: file.destinationPath,
        line: 1,
        column: 1,
        message: `The extraction report lists ${file.destinationPath} as copied, but it no longer exists.`,
        remediation: "Restore the file or regenerate the report if the product evolved deliberately.",
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Discovers product directory names under apps/ of a Forge repository.
 * Deterministic (sorted). A product is an apps/<name> directory that has a
 * package.json — the same rule validate-docs uses. No product id is hardcoded.
 */
export function discoverProducts(root: string): readonly string[] {
  const appsRoot = path.join(path.resolve(root), "apps");
  if (!fs.existsSync(appsRoot) || !fs.statSync(appsRoot).isDirectory()) {
    return [];
  }
  return fs
    .readdirSync(appsRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && fs.existsSync(path.join(appsRoot, entry.name, "package.json")),
    )
    .map((entry) => entry.name)
    .sort();
}

/** Resolves the product argument to an absolute product directory path. */
export function resolveProductPath(root: string, product: string): string {
  const candidates = [path.resolve(root, product), path.resolve(root, "apps", product)];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }
  throw new ValidationError(`Product "${product}" not found under ${root} (checked ${candidates.join(" and ")}).`);
}

/**
 * Validates a product. Deterministic: the same product always produces the
 * same diagnostics.
 */
export function validateProduct(options: ValidationOptions): ValidationReport {
  const root = path.resolve(options.root ?? process.cwd());
  const productPath = resolveProductPath(root, options.product);
  const repoFile = path.join(root, "pnpm-workspace.yaml");
  const mode: "repo" | "standalone" = fs.existsSync(repoFile) && isInside(root, productPath) ? "repo" : "standalone";

  const diagnostics: ValidationDiagnostic[] = [];
  const add = (entry: ValidationDiagnostic): void => {
    diagnostics.push(entry);
  };

  const manifestResult = checkManifest(productPath);
  for (const diagnostic of manifestResult.diagnostics) add(diagnostic);
  const manifest = manifestResult.manifest;

  checkStructure(productPath, diagnostics);
  const packageResult = readPackageManifest(productPath);
  for (const diagnostic of packageResult.diagnostics) add(diagnostic);
  const packageManifest = packageResult.manifest;

  if (manifest !== undefined && packageManifest !== undefined) {
    // Directory identity: in a repository the product directory must match the id.
    const directoryName = path.basename(productPath);
    if (directoryName !== manifest.id) {
      const diagnostic: ValidationDiagnostic = {
        rule: "PRODUCT_DIRECTORY_MISMATCH",
        severity: mode === "repo" ? "error" : "warning",
        file: "product.manifest.ts",
        line: 1,
        column: 1,
        message: `Product directory "${directoryName}" does not match the manifest id "${manifest.id}" (frozen rule: id must match the directory name).`,
        remediation: mode === "repo"
          ? `Move the product to apps/${manifest.id}/ or change the manifest id.`
          : "The destination directory may be a temporary output; rename it to the product id before integrating into a repository.",
      };
      add(diagnostic);
    }
  }

  if (manifest !== undefined && packageManifest !== undefined) {
    checkCapabilityDependencies(manifest, packageManifest, diagnostics);
  }

  checkProviderIsolation(productPath, mode, diagnostics);
  checkUnresolvedDependencies(productPath, root, mode, packageManifest, diagnostics);
  checkDocumentation(productPath, root, mode, diagnostics);

  if (mode === "repo") {
    checkArchitecture(root, diagnostics);
  }

  checkExtractionReport(productPath, manifest?.id, diagnostics);

  diagnostics.sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      left.line - right.line ||
      left.column - right.column ||
      left.rule.localeCompare(right.rule),
  );

  return {
    productPath,
    mode,
    diagnostics,
    errors: diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
    warnings: diagnostics.filter((diagnostic) => diagnostic.severity === "warning"),
  };
}
