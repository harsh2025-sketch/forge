/**
 * ReportTemplate contract + ReportFormat enum tests (V3 §3.2, docs/ARCHETYPES.md).
 */

import { describe, it, expect } from "vitest";
import {
  REPORT_FORMAT_VALUES,
  ReportFormat,
  isReportFormat,
} from "../types.js";
import { validateReportDocument } from "../validate.js";
import { render } from "../pipeline.js";
import { renderMarkdown } from "../generators/markdown.js";
import { escapeHtml } from "../generators/html.js";
import { ReportValidationError } from "../errors.js";
import { buildScanDocument, emptyData, sampleData, scanResultsTemplate } from "./helpers.js";

describe("ReportFormat", () => {
  it("defines exactly the four frozen formats json/markdown/html/pdf", () => {
    expect(REPORT_FORMAT_VALUES).toHaveLength(4);
    expect(REPORT_FORMAT_VALUES).toEqual(
      expect.arrayContaining([
        ReportFormat.JSON,
        ReportFormat.MARKDOWN,
        ReportFormat.HTML,
        ReportFormat.PDF,
      ])
    );
  });

  it("isReportFormat is exact and case-sensitive", () => {
    for (const format of REPORT_FORMAT_VALUES) {
      expect(isReportFormat(format)).toBe(true);
    }
    expect(isReportFormat("JSON")).toBe(false);
    expect(isReportFormat("yaml")).toBe(false);
    expect(isReportFormat(undefined)).toBe(false);
    expect(isReportFormat(42)).toBe(false);
  });
});

describe("ReportTemplate contract", () => {
  it("declares name/description/format and build() returns a valid ReportDocument", () => {
    expect(scanResultsTemplate.name).toBe("scan-results");
    expect(typeof scanResultsTemplate.description).toBe("string");
    expect(scanResultsTemplate.format).toBe(ReportFormat.MARKDOWN);

    const document = scanResultsTemplate.build(sampleData);
    expect(document.title).toContain("https://example.com");
    expect(document.sections).toHaveLength(2);
    expect(document.sections[0].items).toHaveLength(2);
    expect(document.summary?.totalFindings).toBe(2);
    expect(document.findings).toHaveLength(2);

    expect(() => validateReportDocument(document)).not.toThrow();
  });

  it("build() output is validated by the pipeline (invalid output is rejected)", () => {
    const invalidTemplate = {
      ...scanResultsTemplate,
      build: () => ({ title: "", sections: "not-an-array" }),
    };
    expect(() => render(invalidTemplate, sampleData, ReportFormat.JSON)).toThrow(ReportValidationError);
  });

  it("the same template drives every format with identical semantics", () => {
    const document = scanResultsTemplate.build(sampleData);

    const json = render(scanResultsTemplate, sampleData, ReportFormat.JSON);
    const markdown = render(scanResultsTemplate, sampleData, ReportFormat.MARKDOWN);
    const html = render(scanResultsTemplate, sampleData, ReportFormat.HTML);

    expect(JSON.parse(json).title).toBe(document.title);
    expect(markdown).toContain(document.title);
    expect(html).toContain(escapeHtml(document.title));

    // Every finding appears in every format.
    for (const finding of sampleData.findings) {
      expect(json).toContain(finding.id);
      expect(markdown).toContain(finding.title);
      expect(html).toContain(escapeHtml(finding.title));
    }
  });

  it("the template's declared format is the pipeline default", () => {
    const defaultRender = render(scanResultsTemplate, emptyData);
    expect(defaultRender).toBe(renderMarkdown(scanResultsTemplate.build(emptyData)));
    expect(defaultRender.startsWith("# ")).toBe(true);
  });

  it("supports an empty/minimal report", () => {
    const document = buildScanDocument(emptyData);
    const json = render(scanResultsTemplate, emptyData, ReportFormat.JSON);
    const markdown = render(scanResultsTemplate, emptyData, ReportFormat.MARKDOWN);
    const html = render(scanResultsTemplate, emptyData, ReportFormat.HTML);

    expect(JSON.parse(json).summary.totalFindings).toBe(0);
    expect(markdown).toContain("## Summary");
    expect(html).toContain("<!doctype html>");
    expect(document.sections).toHaveLength(2);
  });
});
