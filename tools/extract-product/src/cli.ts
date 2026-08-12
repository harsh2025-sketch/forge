#!/usr/bin/env node

import path from "node:path";
import { ExtractError, extractProduct } from "./index.js";
import { exportProduct } from "./export-product.js";

function usage(): string {
  return [
    "Usage:",
    "  forge-extract-product <source> <destination> [options]",
    "      Import an existing application into the Forge V3 product structure.",
    "  forge-extract-product --export <product> <destination> [--root <repository>]",
    "      Export a Forge product as a standalone workspace (acquisition direction).",
    "",
    "The destination must not exist; nothing is ever overwritten or deleted.",
    "",
    "Options:",
    "  --export                 Export an existing Forge product instead of importing",
    "  --name <product-id>      Product id (slug; default: derived from source dir name)",
    "  --archetype <type>       Primary archetype (default: analyzer, flagged MANUAL)",
    "  --capabilities <list>    Comma-separated capabilities, e.g. reporting,scheduling",
    "  --requires-worker        Declare requiresWorker: true in the manifest",
    "  --requires-ai            Declare requiresAIProvider: true in the manifest",
    "  --root <repository>      Forge repository root",
    "  -h, --help               Show this help",
    "",
    "The tool never executes source code, never follows symlinks, and reports",
    "items it cannot safely transform as MANUAL with remediation notes.",
  ].join("\n");
}

interface ParsedArguments {
  readonly source?: string;
  readonly destination?: string;
  readonly root?: string;
  readonly productId?: string;
  readonly archetype?: string;
  readonly capabilities?: readonly string[];
  readonly requiresWorker?: boolean;
  readonly requiresAIProvider?: boolean;
  readonly exportMode?: boolean;
}

function parseArguments(arguments_: readonly string[]): ParsedArguments {
  const positionals: string[] = [];
  const flags: Record<string, string> = {};
  let requiresWorker = false;
  let requiresAIProvider = false;
  let exportMode = false;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--root" || argument === "--name" || argument === "--archetype" || argument === "--capabilities") {
      const value = arguments_[index + 1];
      if (value === undefined) throw new Error(`${argument} requires a value`);
      flags[argument.slice(2)] = value;
      index += 1;
    } else if (argument.startsWith("--root=") || argument.startsWith("--name=") || argument.startsWith("--archetype=") || argument.startsWith("--capabilities=")) {
      const equals = argument.indexOf("=");
      flags[argument.slice(2, equals)] = argument.slice(equals + 1);
    } else if (argument === "--requires-worker") {
      requiresWorker = true;
    } else if (argument === "--requires-ai") {
      requiresAIProvider = true;
    } else if (argument === "--export") {
      exportMode = true;
    } else if (argument === "--help" || argument === "-h") {
      console.log(usage());
      process.exit(0);
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown argument: ${argument}`);
    } else {
      positionals.push(argument);
    }
  }

  return {
    source: positionals[0],
    destination: positionals[1],
    root: flags.root === undefined ? undefined : path.resolve(flags.root),
    productId: flags.name,
    archetype: flags.archetype,
    capabilities: flags.capabilities === undefined ? undefined : flags.capabilities.split(",").map((item) => item.trim()).filter((item) => item.length > 0),
    requiresWorker,
    requiresAIProvider,
    exportMode,
  };
}

try {
  const parsed = parseArguments(process.argv.slice(2));
  if (parsed.source === undefined || parsed.destination === undefined) {
    console.error("Error: both <source> and <destination> are required.");
    console.error(usage());
    process.exitCode = 2;
  } else {
    if (parsed.exportMode === true) {
      const exported = exportProduct({
        root: parsed.root ?? process.cwd(),
        product: parsed.source,
        destination: parsed.destination,
      });
      console.log(`Exported product ${exported.report.productId} to ${exported.productPath}`);
      console.log(`  status:        ${exported.report.status}`);
      console.log(`  files copied:  ${exported.report.filesCopied.length}`);
      console.log(`  packages:      ${exported.report.packagesCopied.join(", ") || "(none)"}`);
      console.log(`  tools:         ${exported.report.toolsCopied.join(", ") || "(none)"}`);
      console.log(`  warnings:      ${exported.report.warnings.length}`);
      console.log(`  errors:        ${exported.report.errors.length}`);
      console.log("");
      console.log(`Report: ${exported.reportJsonPath}`);
      if (exported.report.errors.length > 0) {
        for (const error of exported.report.errors) console.error(`ERROR: ${error}`);
        process.exitCode = 1;
      }
    } else {
      const result = extractProduct({
        source: parsed.source,
        destination: parsed.destination,
        root: parsed.root,
        productId: parsed.productId,
        primaryArchetype: parsed.archetype,
        capabilities: parsed.capabilities,
        requiresWorker: parsed.requiresWorker,
        requiresAIProvider: parsed.requiresAIProvider,
      });
      console.log(`Extracted product ${result.report.productId} to ${result.productPath}`);
      console.log(`  status:        ${result.report.status}`);
      console.log(`  files copied:  ${result.report.filesCopied.length}`);
      console.log(`  files transformed: ${result.report.filesTransformed.length}`);
      console.log(`  files excluded: ${result.report.filesExcluded.length}`);
      console.log(`  provider integrations: ${result.report.providerIntegrations.length}`);
      console.log(`  manual migration items: ${result.report.manualMigrationItems.length}`);
      console.log(`  warnings:      ${result.report.warnings.length}`);
      console.log(`  errors:        ${result.report.errors.length}`);
      console.log("");
      console.log(`Report: ${result.reportJsonPath}`);
      console.log(`Human-readable report: ${result.reportMarkdownPath}`);
      if (result.report.errors.length > 0) {
        for (const error of result.report.errors) console.error(`ERROR: ${error}`);
        process.exitCode = 1;
      }
    }
  }
} catch (error) {
  if (error instanceof ExtractError) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  } else {
    console.error(`extract-product error: ${error instanceof Error ? error.message : String(error)}`);
    console.error(usage());
    process.exitCode = 2;
  }
}
