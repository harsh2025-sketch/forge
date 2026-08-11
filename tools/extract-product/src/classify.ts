/**
 * Deterministic file and dependency classification per the frozen Task 010
 * extraction rules (SAFE / REVIEW / MANUAL).
 */

import path from "node:path";
import {
  DATABASE_DEPENDENCIES,
  EXCLUDED_DEPENDENCIES,
  SAFE_EXTERNAL_DEPENDENCIES,
  VENDOR_CATEGORIES,
} from "./model.js";
import type { Classification, DependencyClassification } from "./model.js";
import { dependencyRoot, isBuiltinSpecifier } from "./scan.js";
import type { SourceImport } from "./scan.js";

export const DEEP_VENDOR_COUPLING_THRESHOLD = 3;

const REVIEW_PATH_HINTS = /(?:^|\/)(?:api|auth|billing|checkout|db|email|mailer|middleware|migration|payment|processor|queue|schema|scheduler|storage|tracking|upload|webhook|worker)(?:$|\/)/i;
const DOMAIN_PATH = /(?:^|\/)(?:domain|core|entities|models)(?:$|\/)/i;
const SECRET_PATTERNS = [
  /sk_live_[0-9A-Za-z]{16,}/,
  /sk_test_[0-9A-Za-z]{16,}/,
  /pk_live_[0-9A-Za-z]{16,}/,
  /pk_test_[0-9A-Za-z]{16,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bxox[baprs]-[0-9A-Za-z-]{10,}/,
  /\bservice_role\b/,
  /\beyJ[A-Za-z0-9_-]{10,}\./,
];

export interface ClassificationInput {
  readonly relativePath: string;
  readonly kind: "code" | "documentation" | "config" | "data";
  readonly imports: readonly SourceImport[];
  readonly dynamicSpecifiers: readonly SourceImport[];
  readonly content: string;
}

export interface ClassificationResult {
  readonly classification: Classification;
  readonly vendorImports: readonly string[];
  readonly reasons: readonly string[];
}

function vendorRootsOf(imports: readonly SourceImport[]): string[] {
  const roots = new Set<string>();
  for (const sourceImport of imports) {
    const root = dependencyRoot(sourceImport.specifier);
    if (VENDOR_CATEGORIES[root] !== undefined) roots.add(root);
  }
  return [...roots].sort();
}

/**
 * Classifies a single discovered file. Deterministic: identical input always
 * yields the same classification and reasons.
 */
export function classifyFile(input: ClassificationInput): ClassificationResult {
  const { relativePath } = input;
  const reasons: string[] = [];
  const vendorImports = vendorRootsOf(input.imports);

  // MANUAL: hardcoded secrets — never copy these silently.
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(input.content)) {
      reasons.push("Contains what looks like a hardcoded credential or secret");
      return { classification: "MANUAL", vendorImports, reasons };
    }
  }

  // MANUAL: dynamic code whose semantics cannot be inferred statically.
  if (input.dynamicSpecifiers.length > 0) {
    reasons.push("Contains dynamic import/require with a computed specifier; semantics cannot be inferred");
    return { classification: "MANUAL", vendorImports, reasons };
  }

  // MANUAL: vendor SDK code inside a domain path is an architecture violation.
  if (vendorImports.length > 0 && DOMAIN_PATH.test(relativePath)) {
    reasons.push(`Vendor SDK import(s) inside domain code: ${vendorImports.join(", ")}`);
    return { classification: "MANUAL", vendorImports, reasons };
  }

  // MANUAL: deep vendor coupling — three or more distinct vendor SDKs.
  if (vendorImports.length >= DEEP_VENDOR_COUPLING_THRESHOLD) {
    reasons.push(`Deep vendor coupling (${vendorImports.length} distinct vendor SDKs): ${vendorImports.join(", ")}`);
    return { classification: "MANUAL", vendorImports, reasons };
  }

  if (vendorImports.length > 0) {
    reasons.push(`Vendor SDK import(s): ${vendorImports.join(", ")}`);
    return { classification: "REVIEW", vendorImports, reasons };
  }

  const databaseImports = input.imports
    .map((sourceImport) => dependencyRoot(sourceImport.specifier))
    .filter((root) => DATABASE_DEPENDENCIES.has(root));
  if (databaseImports.length > 0) {
    reasons.push(`Database access: ${databaseImports.join(", ")}`);
    return { classification: "REVIEW", vendorImports, reasons };
  }

  if (input.kind === "config" && path.basename(relativePath) === "package.json") {
    reasons.push("Dependency manifest — reviewed and transformed");
    return { classification: "REVIEW", vendorImports, reasons };
  }

  if (input.kind === "code" && REVIEW_PATH_HINTS.test(relativePath)) {
    reasons.push("Path suggests infrastructure integration (auth, billing, webhook, worker, ...)");
    return { classification: "REVIEW", vendorImports, reasons };
  }

  return { classification: "SAFE", vendorImports, reasons };
}

/**
 * Classifies a dependency root. Builtins and framework-neutral utilities are
 * SAFE; vendor SDKs and database libraries are REVIEW; excluded infrastructure
 * is MANUAL (it cannot be carried into a Forge product).
 */
export function classifyDependency(dependency: string): { classification: Classification; category: string } {
  const root = dependencyRoot(dependency);
  if (isBuiltinSpecifier(root)) return { classification: "SAFE", category: "builtin" };
  if (root.startsWith("@types/")) return { classification: "SAFE", category: "types" };
  if (SAFE_EXTERNAL_DEPENDENCIES.has(root)) return { classification: "SAFE", category: "framework-utility" };
  if (EXCLUDED_DEPENDENCIES.has(root)) {
    return { classification: "MANUAL", category: "excluded-infrastructure" };
  }
  if (DATABASE_DEPENDENCIES.has(root)) return { classification: "REVIEW", category: "database" };
  if (VENDOR_CATEGORIES[root] !== undefined) {
    return { classification: "REVIEW", category: VENDOR_CATEGORIES[root] };
  }
  if (root.startsWith("@forge/")) return { classification: "REVIEW", category: "forge-workspace" };
  return { classification: "REVIEW", category: "unclassified-external" };
}

/**
 * Aggregates per-file import data into dependency classifications.
 * Ordering is deterministic (sorted by dependency name).
 */
export function aggregateDependencies(
  files: readonly { readonly relativePath: string; readonly imports: readonly SourceImport[] }[],
): DependencyClassification[] {
  const byDependency = new Map<string, { classification: Classification; category: string; usedBy: Set<string> }>();
  for (const file of files) {
    for (const sourceImport of file.imports) {
      const specifier = sourceImport.specifier;
      if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("@/")) continue;
      const root = dependencyRoot(specifier);
      const classified = classifyDependency(root);
      let entry = byDependency.get(root);
      if (entry === undefined) {
        entry = { classification: classified.classification, category: classified.category, usedBy: new Set() };
        byDependency.set(root, entry);
      }
      entry.usedBy.add(file.relativePath);
    }
  }
  return [...byDependency.entries()]
    .map(([dependency, entry]) => ({
      dependency,
      classification: entry.classification,
      category: entry.category,
      usedBy: [...entry.usedBy].sort(),
    }))
    .sort((left, right) => left.dependency.localeCompare(right.dependency));
}
