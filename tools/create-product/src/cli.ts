#!/usr/bin/env node

import path from "node:path";
import { CreateProductError, generateProduct } from "./index.js";

function usage(): string {
  return [
    "Usage: forge-create-product <product-name> [options]",
    "",
    "Generates a validated Forge V3 product skeleton at apps/<product-name>/.",
    "",
    "Options:",
    "  --archetype <type>       Primary archetype: analyzer, optimizer, generator,",
    "                           transformer, middleware, gateway (default: analyzer)",
    "  --capabilities <list>    Comma-separated capabilities, e.g. reporting,scheduling",
    "  --display-name <text>    Human-readable product name (default: derived from id)",
    "  --tagline <text>         Product tagline (default: derived from archetype)",
    "  --requires-worker        Declare requiresWorker: true in the manifest",
    "  --requires-ai            Declare requiresAIProvider: true in the manifest",
    "  --manifest <path>        Scaffold from an existing product.manifest.ts",
    "  --root <repository>      Repository root (default: current directory)",
    "  -h, --help               Show this help",
  ].join("\n");
}

interface ParsedArguments {
  readonly root: string;
  readonly name?: string;
  readonly displayName?: string;
  readonly tagline?: string;
  readonly archetype?: string;
  readonly capabilities?: readonly string[];
  readonly requiresWorker?: boolean;
  readonly requiresAIProvider?: boolean;
  readonly manifest?: string;
}

function parseArguments(arguments_: readonly string[]): ParsedArguments {
  let root = process.cwd();
  const positionals: string[] = [];
  const flags: Record<string, string> = {};
  let requiresWorker: boolean | undefined;
  let requiresAIProvider: boolean | undefined;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--root") {
      const value = arguments_[index + 1];
      if (value === undefined) throw new Error("--root requires a repository path");
      root = path.resolve(value);
      index += 1;
    } else if (argument === "--manifest") {
      const value = arguments_[index + 1];
      if (value === undefined) throw new Error("--manifest requires a file path");
      flags.manifest = path.resolve(value);
      index += 1;
    } else if (argument.startsWith("--manifest=")) {
      flags.manifest = path.resolve(argument.slice("--manifest=".length));
    } else if (argument === "--archetype" || argument === "--display-name" || argument === "--tagline" || argument === "--capabilities") {
      const key = argument.slice(2);
      const value = arguments_[index + 1];
      if (value === undefined) throw new Error(`${argument} requires a value`);
      flags[key] = value;
      index += 1;
    } else if (argument.startsWith("--archetype=") || argument.startsWith("--display-name=") || argument.startsWith("--tagline=") || argument.startsWith("--capabilities=")) {
      const equals = argument.indexOf("=");
      flags[argument.slice(2, equals)] = argument.slice(equals + 1);
    } else if (argument === "--requires-worker") {
      requiresWorker = true;
    } else if (argument === "--requires-ai") {
      requiresAIProvider = true;
    } else if (argument === "--help" || argument === "-h") {
      console.log(usage());
      process.exit(0);
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown argument: ${argument}`);
    } else {
      positionals.push(argument);
    }
  }

  if (positionals.length > 1) {
    throw new Error(`Unexpected extra arguments: ${positionals.slice(1).join(", ")}`);
  }

  return {
    root,
    name: positionals[0],
    displayName: flags["display-name"],
    tagline: flags.tagline,
    archetype: flags.archetype,
    capabilities: flags.capabilities === undefined ? undefined : flags.capabilities.split(",").map((item) => item.trim()).filter((item) => item.length > 0),
    requiresWorker,
    requiresAIProvider: requiresAIProvider,
    manifest: flags.manifest,
  };
}

try {
  const parsed = parseArguments(process.argv.slice(2));
  if (parsed.name === undefined && parsed.manifest === undefined) {
    console.error("Error: a product name is required (or --manifest).");
    console.error(usage());
    process.exitCode = 2;
  } else {
    const result = generateProduct({
      root: parsed.root,
      name: parsed.name ?? "",
      displayName: parsed.displayName,
      tagline: parsed.tagline,
      primaryArchetype: parsed.archetype,
      capabilities: parsed.capabilities,
      requiresWorker: parsed.requiresWorker,
      requiresAIProvider: parsed.requiresAIProvider,
      manifestPath: parsed.manifest,
    });
    console.log(`Created product ${result.manifest.id} at ${result.relativeProductPath}`);
    console.log(`  display name: ${result.manifest.displayName}`);
    console.log(`  archetype:    ${result.manifest.primaryArchetype}`);
    console.log(
      `  capabilities: ${result.manifest.capabilities.length === 0 ? "(none)" : result.manifest.capabilities.join(", ")}`,
    );
    console.log(`  files:        ${result.filesWritten.length}`);
    console.log("");
    console.log("Next steps:");
    console.log("  pnpm install");
    console.log(`  pnpm --filter ${result.manifest.id} test`);
    console.log("  pnpm arch-check");
    console.log("  pnpm validate-docs");
    console.log("  pnpm extraction-validate " + result.manifest.id);
  }
} catch (error) {
  if (error instanceof CreateProductError) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  } else {
    console.error(`create-product error: ${error instanceof Error ? error.message : String(error)}`);
    console.error(usage());
    process.exitCode = 2;
  }
}
