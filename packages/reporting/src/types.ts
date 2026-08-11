/**
 * @forge/reporting — report model, ReportTemplate contract and ReportFormat enum.
 *
 * Provider-neutral, framework-neutral reporting infrastructure (V3 §3.2, §4.1, §20.2 Day 8).
 * Depends only on @forge/domain (shared report-compatible primitives) and @forge/shared.
 * It must NOT know about payment, authentication, email or job-queue providers, databases,
 * adapters or any product (V3 §4.1: packages/reporting → packages/domain, packages/shared ONLY).
 *
 * The conceptual flow:
 *
 *   Report data/model  →  ReportTemplate  →  pipeline  →  JSON | Markdown | HTML (+ optional PDF)
 *
 * A ReportTemplate turns raw product data into a canonical, format-neutral ReportDocument.
 * The JSON/Markdown/HTML generators all consume that same document, so every format shares
 * exactly the same report semantics.
 */

import type { BaseFinding, Diagnostic, Metric, ReportSummary, Severity } from "@forge/domain";

/**
 * ReportFormat — the output formats the reporting subsystem can produce.
 * V3 §3.2 ("ReportTemplate interface, ReportFormat enum") and docs/ARCHETYPES.md
 * (format: "json" | "markdown" | "html" | "pdf").
 */
export const ReportFormat = {
  JSON: "json",
  MARKDOWN: "markdown",
  HTML: "html",
  PDF: "pdf",
} as const;

export type ReportFormat = (typeof ReportFormat)[keyof typeof ReportFormat];

export const REPORT_FORMAT_VALUES = Object.values(ReportFormat) as readonly ReportFormat[];

/**
 * Type guard for ReportFormat — exact, case-sensitive (no coercion).
 */
export function isReportFormat(value: unknown): value is ReportFormat {
  return typeof value === "string" && (REPORT_FORMAT_VALUES as readonly string[]).includes(value);
}

/**
 * A single list-style item inside a report section.
 * `severity` reuses the shared domain Severity primitive (V3 §9.2/§9.3).
 */
export interface ReportItem {
  readonly title: string;
  readonly summary?: string;
  readonly severity?: Severity;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * A named section of a report document: an optional body paragraph plus an
 * optional list of items.
 */
export interface ReportSection {
  readonly title: string;
  readonly body?: string;
  readonly items?: readonly ReportItem[];
}

/**
 * Canonical, format-neutral report document.
 *
 * One document drives all generators. The shared domain primitives are supported
 * natively because V3 §9.3 states ReportSummary "drives shared HTML/Markdown/JSON
 * generators" and BaseFinding's shared structure "enables shared reporting
 * infrastructure" (this is the shared reporting subsystem).
 *
 * Fields:
 *  - summary:    domain ReportSummary (totalFindings / findingsBySeverity / score)
 *  - findings:   domain BaseFinding records (severity table in md/html)
 *  - metrics:    domain Metric records (table)
 *  - diagnostics: domain Diagnostic records (list)
 *  - sections:   free-form titled sections with paragraphs/items
 *  - metadata:   caller-supplied key/value notes (never environment-derived here)
 *
 * All timestamps are caller-supplied (`generatedAt`); generators never read the
 * clock or the environment, keeping output deterministic.
 */
export interface ReportDocument {
  readonly title: string;
  readonly subtitle?: string;
  readonly generatedAt?: string;
  readonly summary?: ReportSummary;
  readonly sections: readonly ReportSection[];
  readonly findings?: readonly BaseFinding[];
  readonly diagnostics?: readonly Diagnostic[];
  readonly metrics?: readonly Metric[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * ReportTemplate — the reusable contract for rendering a report (V3 §3.2, §8.3).
 *
 * A template declares its identity (`name`) and its default output `format`
 * (per docs/ARCHETYPES.md) and turns product data into the format-neutral
 * ReportDocument via `build`. The same template — and therefore the same report
 * semantics — can be rendered as JSON, Markdown, HTML or (optionally) PDF by the
 * pipeline. Nothing here is vendor-specific; future products implement this
 * contract against their own data shapes.
 */
export interface ReportTemplate<TData = unknown> {
  readonly name: string;
  readonly description?: string;
  /** Default output format used by the pipeline when no format is requested. */
  readonly format: ReportFormat;
  /** Transform raw report data into the canonical format-neutral document. */
  build(data: TData): ReportDocument;
}
