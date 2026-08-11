/**
 * @forge/create-product — Forge V3 product scaffolding tool.
 *
 * Generates a validated product skeleton under apps/<product-id>/ of a Forge
 * repository. The tool is deterministic: the same options always produce
 * byte-identical output. It writes only inside the target product directory
 * and never deletes or overwrites existing files (an existing product is an
 * error).
 */

import fs from "node:fs";
import path from "node:path";
import {
  Archetype,
  Capability,
  isArchetype,
  isCapability,
  validateProductManifest,
} from "@forge/config";
import type { ProductManifest } from "@forge/config";
import { extractManifestObject } from "./manifest.js";
import { isValidProductId, toHumanName } from "./names.js";
import { defaultTagline, buildProductFileMap } from "./templates.js";
import type { ProductSpec } from "./templates.js";

export class CreateProductError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreateProductError";
  }
}

export interface CreateProductOptions {
  /** Repository root that contains the apps/ directory. */
  readonly root: string;
  /** Product id (slug) or a path to an existing product.manifest.ts. */
  readonly name: string;
  readonly displayName?: string;
  readonly tagline?: string;
  readonly primaryArchetype?: string;
  readonly capabilities?: readonly string[];
  readonly requiresWorker?: boolean;
  readonly requiresAIProvider?: boolean;
  /** When provided, the scaffold is derived from an existing manifest file. */
  readonly manifestPath?: string;
}

export interface CreateProductResult {
  /** Absolute path of the generated product directory. */
  readonly productPath: string;
  /** Product directory relative to the repository root (apps/<id>). */
  readonly relativeProductPath: string;
  /** Every file written, sorted, relative to the repository root. */
  readonly filesWritten: readonly string[];
  /** The validated manifest the product was generated from. */
  readonly manifest: ProductManifest;
}

/**
 * Builds the ProductSpec for a scaffold request. Validates every input against
 * the frozen @forge/config manifest schema before anything is written.
 */
export function resolveSpec(options: CreateProductOptions): ProductSpec {
  if (options.manifestPath !== undefined) {
    const absoluteManifest = path.resolve(options.manifestPath);
    let sourceText: string;
    try {
      sourceText = fs.readFileSync(absoluteManifest, "utf8");
    } catch (error) {
      throw new CreateProductError(
        `Cannot read manifest ${options.manifestPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const extraction = extractManifestObject(sourceText);
    if (!extraction.ok) {
      throw new CreateProductError(
        `Invalid manifest ${options.manifestPath}: ${extraction.message}`,
      );
    }
    const validated = validateProductManifest(extraction.value);
    if (!validated.ok) {
      throw new CreateProductError(
        `Invalid manifest ${options.manifestPath}: ${validated.error.message}`,
      );
    }
    return {
      id: validated.value.id,
      displayName: validated.value.displayName,
      tagline: validated.value.tagline,
      primaryArchetype: validated.value.primaryArchetype,
      capabilities: validated.value.capabilities,
      requiresWorker: validated.value.requiresWorker,
      requiresAIProvider: validated.value.requiresAIProvider,
    };
  }

  const id = options.name.trim();
  if (!isValidProductId(id)) {
    throw new CreateProductError(
      `Invalid product name "${id}": must be a slug matching /^[a-z0-9][a-z0-9-]*[a-z0-9]$/ ` +
        "(lowercase letters, digits, hyphens; must start and end alphanumeric).",
    );
  }

  const archetype = options.primaryArchetype ?? Archetype.ANALYZER;
  if (!isArchetype(archetype)) {
    throw new CreateProductError(
      `Invalid archetype "${archetype}": must be one of ${Object.values(Archetype).join(", ")}.`,
    );
  }

  const capabilities: Capability[] = [];
  for (const capability of options.capabilities ?? []) {
    if (!isCapability(capability)) {
      throw new CreateProductError(
        `Invalid capability "${capability}": must be one of ${Object.values(Capability).join(", ")}.`,
      );
    }
    capabilities.push(capability);
  }

  const displayName = options.displayName ?? toHumanName(id);
  const tagline = options.tagline ?? defaultTagline(archetype);

  const spec: ProductSpec = {
    id,
    displayName,
    tagline,
    primaryArchetype: archetype,
    capabilities,
    requiresWorker: options.requiresWorker ?? false,
    requiresAIProvider: options.requiresAIProvider ?? false,
  };

  // Gate the composed spec through the frozen manifest schema.
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
    throw new CreateProductError(`Invalid product definition: ${validated.error.message}`);
  }

  return spec;
}

/**
 * Generates a new product under apps/<id> of the repository root.
 * Refuses to run when the product already exists; writes only inside the new
 * product directory.
 */
export function generateProduct(options: CreateProductOptions): CreateProductResult {
  const root = path.resolve(options.root);
  if (!fs.existsSync(path.join(root, "pnpm-workspace.yaml"))) {
    throw new CreateProductError(
      `Repository root ${root} has no pnpm-workspace.yaml; is this a Forge repository?`,
    );
  }

  const spec = resolveSpec(options);
  const productPath = path.join(root, "apps", spec.id);

  if (fs.existsSync(productPath)) {
    throw new CreateProductError(
      `Product "${spec.id}" already exists at apps/${spec.id}; refusing to overwrite.`,
    );
  }

  const files = buildProductFileMap(spec);
  const filesWritten: string[] = [];
  for (const file of files) {
    const absoluteFile = path.join(productPath, file.path);
    fs.mkdirSync(path.dirname(absoluteFile), { recursive: true });
    fs.writeFileSync(absoluteFile, file.content, "utf8");
    filesWritten.push(`apps/${spec.id}/${file.path}`);
  }
  filesWritten.sort();

  return {
    productPath,
    relativeProductPath: `apps/${spec.id}`,
    filesWritten,
    manifest: {
      id: spec.id,
      displayName: spec.displayName,
      tagline: spec.tagline,
      primaryArchetype: spec.primaryArchetype,
      capabilities: spec.capabilities,
      plans: [],
      requiresWorker: spec.requiresWorker,
      requiresAIProvider: spec.requiresAIProvider,
    },
  };
}

export {
  BASE_PRODUCT_DEPENDENCIES,
  CAPABILITY_DEPENDENCIES,
  PRODUCT_DEV_DEPENDENCIES,
  REQUIRED_PRODUCT_DOCUMENTS,
  buildProductDocs,
  buildProductFileMap,
  capabilityDependencies,
  defaultTagline,
} from "./templates.js";
export type { GeneratedFile, ProductSpec } from "./templates.js";
export { extractManifestObject } from "./manifest.js";
export type { ManifestExtractionResult } from "./manifest.js";
export { isValidProductId, slugifyProductId, toHumanName } from "./names.js";
