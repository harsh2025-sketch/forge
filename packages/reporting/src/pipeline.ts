/**
 * @forge/reporting — reporting pipeline / orchestrator (V3 §3.2 pipeline.ts).
 *
 * One coherent entry point for generating the supported formats from the same
 * ReportTemplate:
 *
 *   render(report, data, "json")      → deterministic JSON string
 *   render(report, data, "markdown")  → deterministic Markdown string
 *   render(report, data, "html")      → deterministic, escaped HTML string
 *   renderPdfReport(report, data)     → optional async HTML→PDF wrapper (Result)
 *
 * Because every format renders the SAME document produced by report.build(data),
 * it is impossible to accidentally use different report semantics per format.
 *
 * There is intentionally no plugin registry, no DI container and no extra
 * abstraction layer: the pipeline is a small switch over the frozen format enum.
 */

import type { Result } from "@forge/shared";
import type { ReportFormat, ReportTemplate } from "./types.js";
import { ReportFormat as ReportFormatValues, isReportFormat } from "./types.js";
import { renderJson } from "./generators/json.js";
import { renderMarkdown } from "./generators/markdown.js";
import { renderHtml } from "./generators/html.js";
import type { HtmlRenderOptions } from "./generators/html.js";
import { renderPdf } from "./generators/pdf.js";
import type { PdfRenderOptions } from "./generators/pdf.js";
import { ReportRenderError } from "./errors.js";

export interface RenderOptions {
  readonly html?: HtmlRenderOptions;
}

export interface PdfReportOptions {
  readonly html?: HtmlRenderOptions;
  readonly pdf?: PdfRenderOptions;
}

/**
 * Renders a report template's data in the requested format.
 *
 * @param report template that turns `data` into a format-neutral ReportDocument
 * @param data   raw report data (product-owned shape)
 * @param format output format; defaults to the template's declared format
 * @param options per-format options (html CSS variables, ...)
 * @returns the rendered string (json/markdown/html)
 * @throws ReportRenderError for unknown formats or invalid template output
 */
export function render(
  report: ReportTemplate<unknown>,
  data: unknown,
  format: ReportFormat = report.format,
  options: RenderOptions = {}
): string {
  if (!isReportFormat(format)) {
    throw new ReportRenderError(`Unknown report format: ${String(format)}`);
  }
  switch (format) {
    case ReportFormatValues.JSON:
      return renderJson(report.build(data));
    case ReportFormatValues.MARKDOWN:
      return renderMarkdown(report.build(data));
    case ReportFormatValues.HTML:
      return renderHtml(report.build(data), options.html);
    case ReportFormatValues.PDF:
      throw new ReportRenderError(
        "PDF output is not available from the synchronous pipeline; use renderPdfReport() / renderPdf() (optional Puppeteer wrapper)"
      );
    default:
      throw new ReportRenderError(`Unsupported report format: ${String(format)}`);
  }
}

/**
 * Renders a report template's data to PDF (optional): builds the document,
 * renders escaped HTML, then wraps it through the optional Puppeteer renderer.
 * Returns a Result — browser operations are fallible — and never throws.
 */
export async function renderPdfReport(
  report: ReportTemplate<unknown>,
  data: unknown,
  options: PdfReportOptions = {}
): Promise<Result<Uint8Array, string>> {
  const html = renderHtml(report.build(data), options.html);
  return renderPdf(html, options.pdf);
}
