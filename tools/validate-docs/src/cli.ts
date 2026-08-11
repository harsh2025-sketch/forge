#!/usr/bin/env node

import path from "node:path";
import { validateDocumentation } from "./index.js";

function usage(): string {
  return "Usage: forge-validate-docs [--root <repository>]";
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

try {
  const report = validateDocumentation(parseRoot(process.argv.slice(2)));
  for (const error of report.errors) {
    console.error(`ERROR [${error.rule}] ${error.file}\n  ${error.message}`);
  }
  if (report.errors.length > 0) {
    console.error(
      `\nDocumentation validation failed: ${report.errors.length} error(s), ${report.productsChecked} product(s), ${report.documentsChecked} document(s) checked.`,
    );
    process.exitCode = 1;
  } else {
    console.log(
      `Documentation validation passed: ${report.productsChecked} product(s), ${report.documentsChecked} document(s) checked.`,
    );
  }
} catch (error) {
  console.error(`Documentation validator error: ${error instanceof Error ? error.message : String(error)}`);
  console.error(usage());
  process.exitCode = 2;
}
