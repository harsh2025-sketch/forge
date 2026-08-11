#!/usr/bin/env node

import path from "node:path";
import { checkRepository } from "./index.js";
import type { ArchitectureDiagnostic } from "./types.js";

function usage(): string {
  return "Usage: forge-architecture-check [--root <repository>]";
}

function parseRoot(arguments_: readonly string[]): string {
  let root = process.cwd();
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--root") {
      const value = arguments_[index + 1];
      if (value === undefined) throw new Error("--root requires a repository path");
      root = path.resolve(value);
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument ?? ""}`);
    }
  }
  return root;
}

function formatDiagnostic(diagnostic: ArchitectureDiagnostic): string {
  const packageLabel = diagnostic.packageName === undefined ? "repository" : diagnostic.packageName;
  const importLabel = diagnostic.specifier === undefined ? "" : ` import=${JSON.stringify(diagnostic.specifier)}`;
  return `${diagnostic.severity.toUpperCase()} [${diagnostic.rule}] ${diagnostic.file}:${diagnostic.line}:${diagnostic.column} package=${packageLabel}${importLabel}\n  ${diagnostic.message}`;
}

try {
  const root = parseRoot(process.argv.slice(2));
  const report = checkRepository({ root });
  for (const warning of report.warnings) console.warn(formatDiagnostic(warning));
  for (const error of report.errors) console.error(formatDiagnostic(error));

  if (report.errors.length > 0) {
    console.error(
      `\nArchitecture check failed: ${report.errors.length} error(s), ${report.warnings.length} warning(s), ${report.packagesChecked} package(s), ${report.filesChecked} source file(s).`,
    );
    process.exitCode = 1;
  } else {
    console.log(
      `Architecture check passed: ${report.packagesChecked} package(s), ${report.filesChecked} source file(s), ${report.warnings.length} warning(s).`,
    );
  }
} catch (error) {
  console.error(`Architecture checker error: ${error instanceof Error ? error.message : String(error)}`);
  console.error(usage());
  process.exitCode = 2;
}
