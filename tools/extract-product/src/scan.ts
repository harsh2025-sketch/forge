/**
 * Secure source scanning and static import extraction.
 *
 * The source application is treated as UNTRUSTED INPUT:
 * - symbolic links are never followed
 * - no source code is executed
 * - only regular files are read
 * - directories that would drag in build artifacts or dependencies are skipped
 */

import fs from "node:fs";
import path from "node:path";
import { builtinModules } from "node:module";
import ts from "typescript";

export interface ScannedFile {
  readonly absolutePath: string;
  /** Path relative to the source root (posix). */
  readonly relativePath: string;
  readonly size: number;
}

export interface SkippedEntry {
  /** Path relative to the source root (posix). */
  readonly path: string;
  readonly reason: string;
  /** symlink entries are not files and are reported as warnings only. */
  readonly kind: "symlink" | "directory" | "file";
}

export interface SourceImport {
  readonly specifier: string;
  readonly line: number;
  readonly column: number;
}

export interface ScannedCodeFile {
  readonly file: ScannedFile;
  readonly imports: readonly SourceImport[];
  /** The file content (code files are re-read by the classifier). */
  readonly content: string;
}

export const EXCLUDED_DIRECTORIES: ReadonlySet<string> = new Set([
  ".cache",
  ".git",
  ".next",
  ".serverless",
  ".turbo",
  ".vercel",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "target",
]);

export const EXCLUDED_FILES: ReadonlySet<string> = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "npm-shrinkwrap.json",
  ".DS_Store",
]);

/** Returns true for env files that may contain secrets (.env, .env.local, ...). */
export function isSecretEnvFile(fileName: string): boolean {
  return fileName.startsWith(".env") && fileName !== ".env.example";
}

/** Returns true for private key / credential files. */
export function isSecretCredentialFile(fileName: string): boolean {
  return /\.(?:pem|key|p12|pfx)$/i.test(fileName) || /(?:credentials|service-account|secrets?)[^/]*\.json$/i.test(fileName);
}

const BUILTIN_SPECIFIERS = new Set<string>(
  builtinModules.flatMap((moduleName) => [moduleName, `node:${moduleName}`]),
);

/** True when the specifier refers to a Node.js builtin module. */
export function isBuiltinSpecifier(specifier: string): boolean {
  return BUILTIN_SPECIFIERS.has(specifier);
}

/** The root package name of a specifier ("@scope/pkg" stays two segments). */
export function dependencyRoot(specifier: string): string {
  if (specifier.startsWith("@")) {
    return specifier.split("/").slice(0, 2).join("/");
  }
  return specifier.split("/")[0] ?? specifier;
}

const CODE_EXTENSION = /\.(?:[cm]?[jt]sx?)$/;

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

/**
 * Recursively scans the source root. Deterministic (sorted) and safe:
 * symlinks are skipped, only regular files are collected.
 */
export function scanSource(sourceRoot: string): { readonly files: readonly ScannedFile[]; readonly skipped: readonly SkippedEntry[] } {
  const files: ScannedFile[] = [];
  const skipped: SkippedEntry[] = [];

  const visit = (directory: string): void => {
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      skipped.push({
        path: toPosix(path.relative(sourceRoot, directory)),
        reason: `unreadable directory: ${error instanceof Error ? error.message : String(error)}`,
        kind: "directory",
      });
      return;
    }
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      const relativePath = toPosix(path.relative(sourceRoot, entryPath));
      if (entry.isSymbolicLink()) {
        skipped.push({ path: relativePath, reason: "symbolic link, not followed", kind: "symlink" });
        continue;
      }
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRECTORIES.has(entry.name)) {
          skipped.push({ path: relativePath, reason: "excluded directory", kind: "directory" });
          continue;
        }
        visit(entryPath);
        continue;
      }
      if (entry.isFile()) {
        if (EXCLUDED_FILES.has(entry.name) || isSecretEnvFile(entry.name) || isSecretCredentialFile(entry.name)) {
          skipped.push({ path: relativePath, reason: "excluded file (secrets/lockfiles are never copied)", kind: "file" });
          continue;
        }
        const stat = fs.statSync(entryPath);
        files.push({
          absolutePath: entryPath,
          relativePath,
          size: stat.size,
        });
      }
    }
  };

  visit(sourceRoot);
  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  return { files, skipped };
}

function scriptKindFor(file: string): ts.ScriptKind {
  if (/\.tsx$/.test(file)) return ts.ScriptKind.TSX;
  if (/\.jsx$/.test(file)) return ts.ScriptKind.JSX;
  if (/\.mts$/.test(file)) return ts.ScriptKind.TS;
  return ts.ScriptKind.TS;
}

/** True when the file is a code file the import extractor understands. */
export function isCodeFile(file: string): boolean {
  return CODE_EXTENSION.test(file);
}

/**
 * Extracts every static import/export specifier from a code file using the
 * TypeScript compiler API. The file is parsed, never executed. Dynamic
 * imports with computed specifiers are reported separately (MANUAL).
 */
export function extractImports(file: ScannedFile): { readonly imports: readonly SourceImport[]; readonly dynamicSpecifiers: readonly SourceImport[] } {
  const text = fs.readFileSync(file.absolutePath, "utf8");
  const source = ts.createSourceFile(
    file.absolutePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(file.absolutePath),
  );
  const imports: SourceImport[] = [];
  const dynamicSpecifiers: SourceImport[] = [];

  const add = (literal: ts.StringLiteralLike): void => {
    const position = source.getLineAndCharacterOfPosition(literal.getStart(source));
    imports.push({ specifier: literal.text, line: position.line + 1, column: position.character + 1 });
  };

  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      add(node.moduleSpecifier);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression !== undefined &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      add(node.moduleReference.expression);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      const argument = node.arguments[0];
      if (argument !== undefined && ts.isStringLiteralLike(argument)) {
        add(argument);
      } else if (argument !== undefined) {
        const position = source.getLineAndCharacterOfPosition(node.getStart(source));
        dynamicSpecifiers.push({
          specifier: node.getText(source).slice(0, 120),
          line: position.line + 1,
          column: position.character + 1,
        });
      }
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      add(node.argument.literal);
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return { imports, dynamicSpecifiers };
}

/**
 * Resolves the destination path for a source-relative path inside the
 * destination root, refusing any traversal outside the destination.
 */
export function safeDestinationPath(destinationRoot: string, relativePath: string): string {
  const resolvedRoot = path.resolve(destinationRoot);
  const target = path.resolve(resolvedRoot, relativePath);
  const prefix = resolvedRoot + path.sep;
  if (target !== resolvedRoot && !target.startsWith(prefix)) {
    throw new Error(`Refusing to write outside destination: ${relativePath}`);
  }
  return target;
}
