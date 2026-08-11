#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { validateProduct } from "./index.js";
import type { ValidationDiagnostic } from "./index.js";

function usage(): string {
  return [
    "Usage: forge-extraction-validate <product> [options]",
    "",
    "Validates a product after creation or extraction. Exit code 0 when there",
    "are no blocking violations; 1 when there are; 2 for usage errors.",
    "",
    "Options:",
    "  --root <repository>   Repository root (default: current directory)",
    "  --json <path>         Write the machine-readable validation report to a file",
    "  -h, --help            Show this help",
    "",
    "In a repository, architecture enforcement is delegated to pnpm arch-check",
    "and documentation completeness to pnpm validate-docs.",
  ].join("\n");
}

function formatDiagnostic(diagnostic: ValidationDiagnostic): string {
  const location = `${diagnostic.file}:${diagnostic.line}:${diagnostic.column}`;
  return `${diagnostic.severity.toUpperCase()} [${diagnostic.rule}] ${location}\n  ${diagnostic.message}\n  Remediation: ${diagnostic.remediation}`;
}

interface ParsedArguments {
  readonly product?: string;
  readonly root: string;
  readonly jsonPath?: string;
}

function parseArguments(arguments_: readonly string[]): ParsedArguments {
  let root = process.cwd();
  let jsonPath: string | undefined;
  const positionals: string[] = [];
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--root") {
      const value = arguments_[index + 1];
      if (value === undefined) throw new Error("--root requires a repository path");
      root = path.resolve(value);
      index += 1;
    } else if (argument === "--json") {
      const value = arguments_[index + 1];
      if (value === undefined) throw new Error("--json requires an output path");
      jsonPath = path.resolve(value);
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      console.log(usage());
      process.exit(0);
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown argument: ${argument}`);
    } else {
      positionals.push(argument);
    }
  }
  return { product: positionals[0], root, jsonPath };
}

try {
  const parsed = parseArguments(process.argv.slice(2));
  if (parsed.product === undefined) {
    console.error("Error: a product path or name is required.");
    console.error(usage());
    process.exitCode = 2;
  } else {
    const report = validateProduct({ root: parsed.root, product: parsed.product });
    for (const diagnostic of report.diagnostics) {
      if (diagnostic.severity === "warning") console.warn(formatDiagnostic(diagnostic));
      else console.error(formatDiagnostic(diagnostic));
    }

    if (parsed.jsonPath !== undefined) {
      fs.writeFileSync(
        parsed.jsonPath,
        `${JSON.stringify(
          {
            product: report.productPath,
            mode: report.mode,
            errors: report.errors.length,
            warnings: report.warnings.length,
            diagnostics: report.diagnostics,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
    }

    if (report.errors.length > 0) {
      console.error(
        `\nExtraction validation failed: ${report.errors.length} error(s), ${report.warnings.length} warning(s) (mode: ${report.mode}).`,
      );
      process.exitCode = 1;
    } else {
      console.log(
        `Extraction validation passed: ${report.warnings.length} warning(s), 0 errors (mode: ${report.mode}).`,
      );
    }
  }
} catch (error) {
  console.error(`extraction-validate error: ${error instanceof Error ? error.message : String(error)}`);
  console.error(usage());
  process.exitCode = 2;
}
