#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { discoverProducts, validateProduct } from "./index.js";
import type { ValidationDiagnostic, ValidationReport } from "./index.js";

function usage(): string {
  return [
    "Usage: forge-extraction-validate [product] [options]",
    "",
    "Validates a product after creation or extraction. When <product> is omitted,",
    "every product under apps/ is validated. Exit code 0 when there are no",
    "blocking violations; 1 when there are; 2 for usage errors.",
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

function emitReport(report: ValidationReport, label?: string): void {
  const prefix = label === undefined ? "" : `${label}: `;
  for (const diagnostic of report.diagnostics) {
    const formatted = formatDiagnostic(diagnostic);
    if (diagnostic.severity === "warning") console.warn(`${prefix}${formatted}`);
    else console.error(`${prefix}${formatted}`);
  }
}

try {
  const parsed = parseArguments(process.argv.slice(2));
  const products =
    parsed.product === undefined ? [...discoverProducts(parsed.root)] : [parsed.product];

  if (products.length === 0) {
    console.error("Error: no products found under apps/. Pass a product name or path.");
    console.error(usage());
    process.exitCode = 2;
  } else {
    const reports: ValidationReport[] = [];
    for (const product of products) {
      const report = validateProduct({ root: parsed.root, product });
      console.log(`Validating ${path.basename(report.productPath)} (${report.mode})`);
      emitReport(report, parsed.product === undefined ? path.basename(report.productPath) : undefined);
      reports.push(report);
    }

    if (parsed.jsonPath !== undefined) {
      const payload =
        reports.length === 1
          ? {
              product: reports[0]!.productPath,
              mode: reports[0]!.mode,
              errors: reports[0]!.errors.length,
              warnings: reports[0]!.warnings.length,
              diagnostics: reports[0]!.diagnostics,
            }
          : {
              products: reports.map((report) => ({
                product: report.productPath,
                mode: report.mode,
                errors: report.errors.length,
                warnings: report.warnings.length,
                diagnostics: report.diagnostics,
              })),
            };
      fs.writeFileSync(parsed.jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    }

    const errorCount = reports.reduce((sum, report) => sum + report.errors.length, 0);
    const warningCount = reports.reduce((sum, report) => sum + report.warnings.length, 0);
    if (errorCount > 0) {
      console.error(
        `\nExtraction validation failed: ${errorCount} error(s), ${warningCount} warning(s), ${reports.length} product(s).`,
      );
      process.exitCode = 1;
    } else {
      console.log(
        `Extraction validation passed: ${warningCount} warning(s), 0 errors, ${reports.length} product(s).`,
      );
    }
  }
} catch (error) {
  console.error(`extraction-validate error: ${error instanceof Error ? error.message : String(error)}`);
  console.error(usage());
  process.exitCode = 2;
}
