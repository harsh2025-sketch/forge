/**
 * @forge/reporting — deterministic JSON generator.
 *
 * Guarantees:
 *  - output is always valid JSON (parseable)
 *  - deterministic: object keys are serialized in sorted order, so two documents
 *    with the same content in different key-insertion orders render identically
 *  - no accidental undefined surprises: `undefined` object properties are dropped
 *    (matching JSON.stringify) and `undefined` array entries become `null`
 *    (matching JSON.stringify) — never a half-serialized document
 *  - explicit errors for values JSON cannot faithfully represent (functions,
 *    symbols, bigint, NaN/Infinity, circular references) instead of silent
 *    coercion to `null`
 *  - preserves the report's semantic structure; no vendor metadata, no
 *    environment-derived values (all timestamps are caller-supplied)
 */

import { ReportRenderError } from "../errors.js";
import { validateReportDocument } from "../validate.js";

function serializePrimitive(value: string | number | boolean): string {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new ReportRenderError(
      `Cannot serialize non-finite number (${String(value)}) to JSON — JSON has no representation for it`
    );
  }
  return JSON.stringify(value);
}

function serializeValue(value: unknown, space: number, seen: WeakSet<object>, depth: number): string {
  if (value === null) {
    return "null";
  }

  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean") {
    return serializePrimitive(value as string | number | boolean);
  }
  if (type === "bigint") {
    throw new ReportRenderError("Cannot serialize BigInt values to JSON — convert them to a number or string first");
  }
  if (type === "undefined" || type === "function" || type === "symbol") {
    throw new ReportRenderError(
      `Cannot serialize ${type} value to JSON at the root — report data must be JSON-compatible`
    );
  }

  const object = value as Record<string, unknown>;
  const toJSON = (object as { toJSON?: unknown }).toJSON;
  if (typeof toJSON === "function") {
    return serializeValue((toJSON as () => unknown).call(object), space, seen, depth);
  }

  if (seen.has(object)) {
    throw new ReportRenderError("Cannot serialize circular structure to JSON");
  }
  seen.add(object);

  const indent = " ".repeat(space * depth);
  const childIndent = " ".repeat(space * (depth + 1));
  let result: string;

  if (Array.isArray(object)) {
    const parts: string[] = [];
    for (const item of object) {
      if (item === undefined) {
        // JSON.stringify(array with undefined) → null; keep that semantic exactly.
        parts.push("null");
        continue;
      }
      if (typeof item === "function" || typeof item === "symbol") {
        seen.delete(object);
        throw new ReportRenderError("Cannot serialize function/symbol values inside JSON arrays");
      }
      parts.push(serializeValue(item, space, seen, depth + 1));
    }
    if (parts.length === 0) {
      result = "[]";
    } else if (space > 0) {
      result = `[\n${parts.map((part) => childIndent + part).join(",\n")}\n${indent}]`;
    } else {
      result = `[${parts.join(",")}]`;
    }
  } else {
    const keys = Object.keys(object).sort(); // deterministic output
    const parts: string[] = [];
    for (const key of keys) {
      const item = object[key];
      if (item === undefined) {
        // JSON.stringify drops undefined object properties; keep that semantic.
        continue;
      }
      if (typeof item === "function" || typeof item === "symbol") {
        seen.delete(object);
        throw new ReportRenderError(
          `Cannot serialize ${typeof item} value for key "${key}" to JSON — report data must be JSON-compatible`
        );
      }
      const serialized = serializeValue(item, space, seen, depth + 1);
      parts.push(`${JSON.stringify(key)}:${space > 0 ? " " : ""}${serialized}`);
    }
    if (parts.length === 0) {
      result = "{}";
    } else if (space > 0) {
      result = `{\n${parts.map((part) => childIndent + part).join(",\n")}\n${indent}}`;
    } else {
      result = `{${parts.join(",")}}`;
    }
  }

  // Allow the same object to appear multiple times (DAG), only cycles are errors.
  seen.delete(object);
  return result;
}

/**
 * Stable, deterministic JSON serialization. Sorted keys, explicit errors for
 * non-JSON values, no environment-derived values.
 */
export function stableStringify(value: unknown, space = 2): string {
  return serializeValue(value, space, new WeakSet<object>(), 0);
}

/**
 * Renders a validated ReportDocument as deterministic, parseable JSON
 * (2-space pretty-printed, keys sorted).
 */
export function renderJson(document: unknown): string {
  validateReportDocument(document);
  return stableStringify(document);
}
