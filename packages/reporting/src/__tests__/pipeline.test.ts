/**
 * Pipeline / orchestrator tests (V3 §3.2 pipeline.ts, §20.2 Day 8 gate).
 * One coherent entry point; same template semantics across formats; typed
 * errors; optional PDF path.
 */

import { describe, it, expect, vi } from "vitest";
import { render, renderPdfReport } from "../pipeline.js";
import { ReportFormat, REPORT_FORMAT_VALUES } from "../types.js";
import { ReportRenderError } from "../errors.js";
import type { PdfLauncher } from "../generators/pdf.js";
import { sampleData, scanResultsTemplate } from "./helpers.js";

const FAKE_BYTES = new Uint8Array([37, 80, 68, 70]);

function fakeLauncher(): PdfLauncher {
  const page = {
    setContent: vi.fn(async () => undefined),
    pdf: vi.fn(async () => FAKE_BYTES),
  };
  const browser = {
    newPage: async () => page,
    close: async () => undefined,
  };
  return {
    launch: vi.fn(async () => browser),
    page,
  } as unknown as PdfLauncher & { page: typeof page };
}

describe("pipeline render", () => {
  it("renders json/markdown/html from one template", () => {
    const json = render(scanResultsTemplate, sampleData, ReportFormat.JSON);
    const markdown = render(scanResultsTemplate, sampleData, ReportFormat.MARKDOWN);
    const html = render(scanResultsTemplate, sampleData, ReportFormat.HTML);

    expect(() => JSON.parse(json)).not.toThrow();
    expect(markdown).toContain("## Findings");
    expect(html).toContain("<!doctype html>");
  });

  it("keeps report semantics identical across formats", () => {
    const formats = [ReportFormat.JSON, ReportFormat.MARKDOWN, ReportFormat.HTML] as const;
    const outputs = formats.map((format) => render(scanResultsTemplate, sampleData, format));

    for (const finding of sampleData.findings) {
      for (const output of outputs) {
        expect(output).toContain(finding.id);
      }
    }
    // Same count everywhere.
    expect(JSON.parse(outputs[0]).findings.length).toBe(sampleData.findings.length);
    expect((outputs[1].match(/F-\d/g) ?? []).length).toBe(sampleData.findings.length);
    expect((outputs[2].match(/F-\d/g) ?? []).length).toBe(sampleData.findings.length);
  });

  it("defaults to the template's declared format", () => {
    expect(scanResultsTemplate.format).toBe(ReportFormat.MARKDOWN);
    const output = render(scanResultsTemplate, sampleData);
    expect(output.startsWith("# ")).toBe(true);
  });

  it("throws a typed error for unknown formats", () => {
    expect(() => render(scanResultsTemplate, sampleData, "yaml" as ReportFormat)).toThrow(ReportRenderError);
    expect(() => render(scanResultsTemplate, sampleData, "yaml" as ReportFormat)).toThrow(/Unknown report format/);
  });

  it("throws a typed hint for pdf from the synchronous pipeline", () => {
    expect(() => render(scanResultsTemplate, sampleData, ReportFormat.PDF)).toThrow(ReportRenderError);
    expect(() => render(scanResultsTemplate, sampleData, ReportFormat.PDF)).toThrow(/renderPdf/);
  });

  it("validates the frozen format set is fully handled", () => {
    // Every enum value must be handled by the pipeline switch (json/md/html
    // render, pdf throws the documented hint).
    for (const format of REPORT_FORMAT_VALUES) {
      if (format === ReportFormat.PDF) {
        expect(() => render(scanResultsTemplate, sampleData, format)).toThrow(ReportRenderError);
      } else {
        expect(typeof render(scanResultsTemplate, sampleData, format)).toBe("string");
      }
    }
  });
});

describe("renderPdfReport", () => {
  it("builds, renders escaped HTML and wraps it through the optional PDF renderer", async () => {
    const launcher = fakeLauncher();
    const result = await renderPdfReport(scanResultsTemplate, sampleData, { pdf: { launcher } });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value).toEqual(FAKE_BYTES);

    // The HTML handed to the PDF renderer is the escaped report HTML.
    const htmlArg = (launcher.page?.setContent as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(htmlArg.startsWith("<!doctype html>")).toBe(true);
    expect(htmlArg).toContain("Scan results");
    expect(htmlArg).not.toContain("<script>");
  });

  it("returns a typed error when the PDF renderer fails", async () => {
    const failing: PdfLauncher = {
      launch: async () => {
        throw new Error("no browser");
      },
    };
    const result = await renderPdfReport(scanResultsTemplate, sampleData, { pdf: { launcher: failing } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("no browser");
    }
  });
});
