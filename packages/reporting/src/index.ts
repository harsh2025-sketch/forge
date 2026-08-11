/**
 * @forge/reporting — public surface (V3 §3.2).
 *
 * Exports the ReportTemplate contract, the ReportFormat enum, the
 * deterministic JSON/Markdown/HTML generators, the optional Puppeteer PDF
 * wrapper and the pipeline orchestrator.
 */

// Report model + template contract
export type {
  ReportDocument,
  ReportItem,
  ReportSection,
  ReportTemplate,
} from "./types.js";
export {
  REPORT_FORMAT_VALUES,
  ReportFormat,
  isReportFormat,
} from "./types.js";

// Typed errors
export {
  ReportRenderError,
  ReportValidationError,
  isReportRenderError,
  isReportValidationError,
} from "./errors.js";

// Structural validation
export { validateReportDocument } from "./validate.js";

// Generators
export { renderJson, stableStringify } from "./generators/json.js";
export { renderMarkdown } from "./generators/markdown.js";
export { renderHtml, escapeHtml } from "./generators/html.js";
export type { HtmlRenderOptions } from "./generators/html.js";
export { renderPdf } from "./generators/pdf.js";
export type {
  PdfBrowser,
  PdfLauncher,
  PdfMargin,
  PdfPage,
  PdfRenderOptions,
} from "./generators/pdf.js";

// Pipeline / orchestrator
export { render, renderPdfReport } from "./pipeline.js";
export type { PdfReportOptions, RenderOptions } from "./pipeline.js";
