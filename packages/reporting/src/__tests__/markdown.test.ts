/**
 * Deterministic Markdown generator tests (V3 §20.2 Day 8 gate: "Reporting
 * pipeline produces valid Markdown"; §6: headings/lists/tables, escaping,
 * semantic content).
 */

import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../generators/markdown.js";
import { renderJson } from "../generators/json.js";
import { ReportValidationError } from "../errors.js";
import { buildScanDocument, emptyData, sampleData, scanResultsTemplate } from "./helpers.js";
import type { ReportDocument } from "../types.js";

function renderSample(): string {
  return renderMarkdown(scanResultsTemplate.build(sampleData));
}

describe("renderMarkdown", () => {
  it("produces readable Markdown with ATX headings", () => {
    const output = renderSample();
    const lines = output.split("\n");

    expect(lines[0]).toMatch(/^# /);
    expect(lines[0]).toContain("Scan results");
    expect(output).toContain("## Summary");
    expect(output).toContain("## Findings");
    expect(output).toContain("## Overview");
    expect(output).toContain("## Next steps");
    expect(output).toContain("## Metadata");
    // No Metrics section in the fixture (metrics are optional).
    expect(output.includes("## Metrics")).toBe(false);
  });

  it("renders the summary table in canonical severity order", () => {
    const output = renderSample();
    const summaryBlock = output.split("## Summary")[1].split("## Findings")[0];

    const criticalIndex = summaryBlock.indexOf("critical");
    const highIndex = summaryBlock.indexOf("high");
    const mediumIndex = summaryBlock.indexOf("medium");
    const lowIndex = summaryBlock.indexOf("low");
    const infoIndex = summaryBlock.indexOf("info");
    expect(criticalIndex).toBeLessThan(highIndex);
    expect(highIndex).toBeLessThan(mediumIndex);
    expect(mediumIndex).toBeLessThan(lowIndex);
    expect(lowIndex).toBeLessThan(infoIndex);

    expect(summaryBlock).toContain("| Severity | Count |");
    expect(summaryBlock).toContain("| critical | 1 |");
    expect(summaryBlock).toContain("| low | 1 |");
    expect(summaryBlock).toContain("**Total findings:** 2");
    expect(summaryBlock).toContain("**Score:** 87");
  });

  it("renders findings as a table with semantic content", () => {
    const output = renderSample();
    const findingsBlock = output.split("## Findings")[1].split("## Diagnostics")[0] ?? output;

    expect(findingsBlock).toContain("| ID | Severity | Category | Title |");
    expect(findingsBlock).toContain("| F-1 | critical | jwt_alg_confusion |");
    expect(findingsBlock).toContain("Algorithm confusion: HS256 accepted with RSA public key");
    expect(findingsBlock).toContain("| F-2 | low | missing_claim |");
  });

  it("renders sections with paragraphs and severity-tagged list items", () => {
    const output = renderSample();
    const overview = output.split("## Overview")[1].split("## Next steps")[0];

    expect(overview).toContain("Analyzed https://example.com and found 2 issue(s).");
    expect(overview).toContain("- **[critical]** **Algorithm confusion: HS256 accepted with RSA public key**");
    expect(overview).toContain("- **[low]** **Token has no expiration claim**");
    expect(output).toContain("- **[critical]** **Review critical findings first**");
  });

  it("escapes pipes and collapses newlines so table/list structure cannot break", () => {
    const document = scanResultsTemplate.build(sampleData);
    document.sections = [
      {
        title: "Hostile | section",
        body: "line one\nline two",
        items: [{ title: "pipe | item", summary: "a\nb" }],
      },
    ];
    document.metadata = { "key | one": "value | two" };

    const output = renderMarkdown(document);
    // Pipes inside table cells are escaped (metadata table).
    expect(output).toContain("| key \\| one | value \\| two |");
    // Single-lined body: no raw newline inside a paragraph.
    expect(output).toContain("line one line two");
    // List items are single-lined (pipes are harmless outside tables).
    expect(output).toContain("- **pipe | item** — a b");
  });

  it("renders metrics and diagnostics tables/lists when present", () => {
    const document = scanResultsTemplate.build(sampleData);
    document.metrics = [
      { name: "coverage", value: 92.5, unit: "%", target: 95 },
      { name: "latency", value: 12, unit: "ms" },
    ];
    document.diagnostics = [
      { level: "warning", message: "Some rows skipped", code: "W-1" },
      { level: "info", message: "Full scan completed" },
    ];

    const output = renderMarkdown(document);
    expect(output).toContain("## Metrics");
    expect(output).toContain("| Metric | Value | Unit |");
    expect(output).toContain("| coverage | 92.5 | % |");
    expect(output).toContain("## Diagnostics");
    expect(output).toContain("- **warning** (W-1): Some rows skipped");
    expect(output).toContain("- **info**: Full scan completed");
  });

  it("is deterministic for identical documents", () => {
    expect(renderSample()).toBe(renderSample());
    expect(renderMarkdown(scanResultsTemplate.build(emptyData))).toBe(
      renderMarkdown(scanResultsTemplate.build(emptyData))
    );
  });

  it("supports an empty report gracefully", () => {
    const output = renderMarkdown(buildScanDocument(emptyData));
    expect(output.startsWith("# Scan results — https://clean.example")).toBe(true);
    expect(output).toContain("## Summary");
    expect(output).toContain("| critical | 0 |");
    // No Findings section when there are none.
    expect(output).not.toContain("## Findings");
  });

  it("rejects invalid documents with ReportValidationError", () => {
    expect(() => renderMarkdown({ title: "x" })).toThrow(ReportValidationError);
    expect(() => renderMarkdown({ title: "x", sections: [{ title: "" }] })).toThrow(ReportValidationError);
  });

  it("shares semantics with the JSON generator (same titles/counts)", () => {
    const markdown = renderSample();
    const json = JSON.parse(renderJson(scanResultsTemplate.build(sampleData))) as ReportDocument;

    for (const finding of json.findings ?? []) {
      expect(markdown).toContain(finding.id);
      expect(markdown).toContain(finding.title);
    }
    expect(markdown).toContain(`**Total findings:** ${json.summary?.totalFindings}`);
  });
});
