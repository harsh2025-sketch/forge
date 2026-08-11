/**
 * Deterministic JSON generator tests (V3 §20.2 Day 8 gate: "Reporting pipeline
 * produces valid JSON"; §5: deterministic, no undefined surprises, semantic
 * structure preserved, no env-dependent values).
 */

import { describe, it, expect } from "vitest";
import { renderJson, stableStringify } from "../generators/json.js";
import { ReportRenderError } from "../errors.js";
import { ReportValidationError } from "../errors.js";
import { buildScanDocument, emptyData, sampleData, scanResultsTemplate } from "./helpers.js";
import type { ReportDocument } from "../types.js";

function renderSample(): string {
  return renderJson(scanResultsTemplate.build(sampleData));
}

describe("renderJson", () => {
  it("produces parseable JSON with the report's semantic structure", () => {
    const output = renderSample();
    const parsed = JSON.parse(output) as ReportDocument;

    expect(parsed.title).toBe(scanResultsTemplate.build(sampleData).title);
    expect(parsed.subtitle).toBeTypeOf("string");
    expect(parsed.generatedAt).toBe("2026-08-11T00:00:00.000Z");
    expect(parsed.summary?.totalFindings).toBe(2);
    expect(parsed.summary?.findingsBySeverity.critical).toBe(1);
    expect(parsed.findings).toHaveLength(2);
    expect(parsed.findings?.[0]).toMatchObject({
      id: "F-1",
      severity: "critical",
      category: "jwt_alg_confusion",
    });
    expect(parsed.findings?.[0].evidence).toEqual({ header: { alg: "HS256", typ: "JWT" } });
    expect(parsed.sections).toHaveLength(2);
    expect(parsed.sections[0].items).toHaveLength(2);
    expect(parsed.metadata).toEqual({ target: "https://example.com", generator: "test-fixture" });
  });

  it("is deterministic across calls and across key insertion order", () => {
    const first = renderSample();
    const second = renderSample();
    expect(first).toBe(second);

    // Same content, different key insertion order → identical output.
    const document = scanResultsTemplate.build(sampleData);
    const shuffled: ReportDocument = {
      generatedAt: document.generatedAt,
      sections: document.sections,
      title: document.title,
      summary: document.summary,
      findings: document.findings,
      metadata: document.metadata,
      subtitle: document.subtitle,
    };
    expect(renderJson(shuffled)).toBe(first);
  });

  it("sorts object keys so output is stable", () => {
    const output = renderSample();
    // Root-level keys appear in alphabetical order.
    const rootKeys = [...output.matchAll(/\n  "([^"]+)":/g)].map((match) => match[1]);
    expect(rootKeys).toEqual(["findings", "generatedAt", "metadata", "sections", "subtitle", "summary", "title"]);
    expect(rootKeys).toEqual([...rootKeys].sort());
  });

  it("supports an empty report and renders 0 findings consistently", () => {
    const output = renderJson(buildScanDocument(emptyData));
    const parsed = JSON.parse(output) as ReportDocument;
    expect(parsed.findings).toEqual([]);
    expect(parsed.summary?.totalFindings).toBe(0);
    expect(parsed.summary?.findingsBySeverity.critical).toBe(0);
  });

  it("drops undefined object properties instead of surprising output", () => {
    const document = scanResultsTemplate.build(sampleData);
    document.metadata = { present: 1, absent: undefined, nested: { a: undefined, b: "kept" } };
    const parsed = JSON.parse(renderJson(document)) as { metadata: Record<string, unknown> };
    expect(Object.keys(parsed.metadata).sort()).toEqual(["nested", "present"]);
    expect(parsed.metadata.nested).toEqual({ b: "kept" });
  });

  it("renders undefined array entries as null (JSON.stringify semantics)", () => {
    expect(stableStringify([1, undefined, 3])).toBe("[\n  1,\n  null,\n  3\n]");
  });

  it("preserves numbers/booleans/nulls exactly", () => {
    expect(stableStringify({ n: 1.5, b: false, nil: null, s: "x" })).toBe(
      '{\n  "b": false,\n  "n": 1.5,\n  "nil": null,\n  "s": "x"\n}'
    );
  });

  it("throws a typed error for non-finite numbers instead of silently emitting null", () => {
    expect(() => stableStringify({ score: NaN })).toThrow(ReportRenderError);
    expect(() => stableStringify({ score: Infinity })).toThrow(ReportRenderError);
  });

  it("throws a typed error for BigInt values", () => {
    expect(() => stableStringify({ n: 10n })).toThrow(ReportRenderError);
  });

  it("throws a typed error for function/symbol values in objects and arrays", () => {
    expect(() => stableStringify({ fn: () => 1 })).toThrow(ReportRenderError);
    expect(() => stableStringify({ sym: Symbol("x") })).toThrow(ReportRenderError);
    expect(() => stableStringify([() => 1])).toThrow(ReportRenderError);
  });

  it("throws a typed error for circular structures (no infinite recursion)", () => {
    const circular: Record<string, unknown> = { name: "loop" };
    circular.self = circular;
    const document = scanResultsTemplate.build(sampleData);
    document.metadata = circular;
    expect(() => renderJson(document)).toThrow(ReportRenderError);
    expect(() => renderJson(document)).toThrow(/circular/i);
  });

  it("supports toJSON (e.g. Date) like JSON.stringify", () => {
    const output = stableStringify({ when: new Date("2026-08-11T00:00:00.000Z") });
    expect(output).toContain('"2026-08-11T00:00:00.000Z"');
  });

  it("rejects structurally invalid documents with ReportValidationError", () => {
    expect(() => renderJson({ title: 42 })).toThrow(ReportValidationError);
    expect(() => renderJson(null)).toThrow(ReportValidationError);
    expect(() => renderJson({ title: "x", sections: "nope" })).toThrow(ReportValidationError);
  });

  it("contains no environment-derived values (fixed timestamp round-trips)", () => {
    const output = renderSample();
    expect(output).toContain("2026-08-11T00:00:00.000Z");
    expect(output).not.toMatch(/\$\{process\.env|\bprocess\.env\b/);
  });
});
