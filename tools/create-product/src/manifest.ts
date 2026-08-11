/**
 * Static extraction of the product manifest object from a product.manifest.ts
 * source file.
 *
 * Manifests are machine-readable contracts: values must be plain literals so
 * tooling can evaluate them WITHOUT executing the file (source code is treated
 * as untrusted input). Supported forms:
 *
 *   export default defineProductManifest({ ... });
 *   export const productManifest = defineProductManifest({ ... });
 *   export default { ... };
 *   const productManifest = { ... }; export { productManifest };
 */

import ts from "typescript";

export interface ManifestExtraction {
  readonly ok: true;
  readonly value: Record<string, unknown>;
}

export interface ManifestExtractionFailure {
  readonly ok: false;
  readonly message: string;
  readonly line: number;
  readonly column: number;
}

export type ManifestExtractionResult = ManifestExtraction | ManifestExtractionFailure;

function evaluateLiteral(
  node: ts.Expression,
  describe: (node: ts.Node) => string,
): unknown {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((element) => evaluateLiteral(element, describe));
  }
  if (ts.isObjectLiteralExpression(node)) {
    const value: Record<string, unknown> = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) {
        throw new Error(`unsupported property form at ${describe(property)}`);
      }
      const name = ts.isIdentifier(property.name)
        ? property.name.text
        : ts.isStringLiteral(property.name) || ts.isNumericLiteral(property.name)
          ? property.name.text
          : undefined;
      if (name === undefined) {
        throw new Error(`unsupported property name at ${describe(property)}`);
      }
      value[name] = evaluateLiteral(property.initializer, describe);
    }
    return value;
  }
  throw new Error(`non-literal expression at ${describe(node)}`);
}

function positionOf(source: ts.SourceFile, node: ts.Node): { line: number; column: number } {
  const position = source.getLineAndCharacterOfPosition(node.getStart(source));
  return { line: position.line + 1, column: position.character + 1 };
}

function describe(source: ts.SourceFile, node: ts.Node): string {
  const position = positionOf(source, node);
  return `${position.line}:${position.column}`;
}

/**
 * Extracts the manifest object from a product.manifest.ts source file.
 * The file is parsed, never executed.
 */
export function extractManifestObject(sourceText: string): ManifestExtractionResult {
  const source = ts.createSourceFile(
    "product.manifest.ts",
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  let foundObject: ts.ObjectLiteralExpression | undefined;
  let failure: ManifestExtractionFailure | undefined;

  const record = (object: ts.ObjectLiteralExpression): void => {
    if (foundObject === undefined) {
      foundObject = object;
    }
  };

  const visit = (node: ts.Node): void => {
    if (failure !== undefined) return;

    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (
        ts.isIdentifier(expression) &&
        expression.text === "defineProductManifest" &&
        node.arguments.length === 1 &&
        ts.isObjectLiteralExpression(node.arguments[0])
      ) {
        record(node.arguments[0]);
        ts.forEachChild(node, visit);
        return;
      }
    }

    if (ts.isExportAssignment(node) && ts.isObjectLiteralExpression(node.expression)) {
      record(node.expression);
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "productManifest" &&
      node.initializer !== undefined &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      record(node.initializer);
    }

    ts.forEachChild(node, visit);
  };

  visit(source);

  if (failure !== undefined) return failure;
  if (foundObject === undefined) {
    return {
      ok: false,
      message:
        "No static manifest object found. The manifest must define the product " +
        "as a literal object via defineProductManifest({ ... }), an exported " +
        "`productManifest` const, or a default export object.",
      line: 1,
      column: 1,
    };
  }

  try {
    return {
      ok: true,
      value: evaluateLiteral(foundObject, (node) => describe(source, node)) as Record<string, unknown>,
    };
  } catch (error) {
    const position = describe(source, foundObject);
    return {
      ok: false,
      message: `Manifest must contain only static literals: ${error instanceof Error ? error.message : String(error)}`,
      line: position === "" ? 1 : Number(position.split(":")[0] ?? 1),
      column: position === "" ? 1 : Number(position.split(":")[1] ?? 1),
    };
  }
}
