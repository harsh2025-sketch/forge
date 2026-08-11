/**
 * @forge/reporting — deterministic, injection-safe HTML generator.
 *
 * Renders the same format-neutral ReportDocument consumed by the JSON and
 * Markdown generators.
 *
 * Guarantees:
 *  - valid, deterministic HTML document structure (`<!doctype html>` … `</html>`)
 *  - every user-controlled string is HTML-escaped (`& < > " '`); report data is
 *    never interpolated raw, so `<script>` payloads cannot execute
 *  - optional CSS custom properties are escaped and emitted in a `:root` block,
 *    which is the documented bridge to the @forge/ui ThemeTokens system
 *    (products pass `themeToCssVariables(tokens)` — V3 §10 "styling should be
 *    compatible with the UI/theme system"); reporting itself does not depend on
 *    @forge/ui (V3 §4.1)
 */

import { SEVERITY_ORDER } from "@forge/domain";
import type { ReportDocument } from "../types.js";
import { validateReportDocument } from "../validate.js";

export interface HtmlRenderOptions {
  /** `<html lang="...">` attribute; defaults to "en". */
  readonly lang?: string;
  /**
   * Deterministic CSS custom properties emitted as `:root { --x: value; }`.
   * Compatible with @forge/ui `themeToCssVariables(ThemeTokens)` output.
   */
  readonly cssVariables?: Readonly<Record<string, string>>;
}

/** Escapes text for safe inclusion in HTML text and attribute positions. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeCssValue(value: string): string {
  // CSS values are emitted inside a <style> block; escaping the same five
  // characters keeps `</style>`/attribute break-outs inert.
  return escapeHtml(value);
}

function renderCssVariables(cssVariables: Readonly<Record<string, string>>): string {
  const keys = Object.keys(cssVariables).sort(); // deterministic
  const declarations = keys
    .map((key) => `  ${key}: ${escapeCssValue(cssVariables[key])};`)
    .join("\n");
  return `:root {\n${declarations}\n}`;
}

function renderSummary(document: ReportDocument): string {
  const { summary } = document;
  const parts: string[] = ['<dl class="forge-report-summary">'];
  parts.push(`  <dt>Total findings</dt><dd>${summary!.totalFindings}</dd>`);
  if (summary!.score !== undefined) {
    parts.push(`  <dt>Score</dt><dd>${summary!.score}</dd>`);
  }
  for (const severity of SEVERITY_ORDER) {
    const count = summary!.findingsBySeverity[severity] ?? 0;
    parts.push(`  <dt class="forge-severity forge-severity--${severity}">${severity}</dt><dd>${count}</dd>`);
  }
  parts.push("</dl>");
  return parts.join("\n");
}

function renderFindings(document: ReportDocument): string {
  const rows = document
    .findings!.map((finding) => {
      const cells = [
        `      <td>${escapeHtml(finding.id)}</td>`,
        `      <td>${escapeHtml(finding.severity)}</td>`,
        `      <td>${escapeHtml(finding.category)}</td>`,
        `      <td>${escapeHtml(finding.title)}</td>`,
      ];
      // severity is validated against the closed Severity enum, so the
      // data-attribute value is from a safe set (never raw user input).
      return `    <tr data-severity="${finding.severity}">\n${cells.join("\n")}\n    </tr>`;
    })
    .join("\n");
  return [
    '<table class="forge-report-findings">',
    "  <thead>",
    "    <tr><th>ID</th><th>Severity</th><th>Category</th><th>Title</th></tr>",
    "  </thead>",
    "  <tbody>",
    rows,
    "  </tbody>",
    "</table>",
  ].join("\n");
}

function renderMetrics(document: ReportDocument): string {
  const rows = document
    .metrics!.map(
      (metric) =>
        `    <tr><td>${escapeHtml(metric.name)}</td><td>${metric.value}</td><td>${escapeHtml(metric.unit)}</td></tr>`
    )
    .join("\n");
  return [
    '<table class="forge-report-metrics">',
    "  <thead>",
    "    <tr><th>Metric</th><th>Value</th><th>Unit</th></tr>",
    "  </thead>",
    "  <tbody>",
    rows,
    "  </tbody>",
    "</table>",
  ].join("\n");
}

function renderDiagnostics(document: ReportDocument): string {
  const items = document
    .diagnostics!.map((diagnostic) => {
      const code = diagnostic.code ? ` <code>${escapeHtml(diagnostic.code)}</code>` : "";
      return `  <li class="forge-diagnostic forge-diagnostic--${diagnostic.level}"><strong>${escapeHtml(
        diagnostic.level
      )}</strong>${code}: ${escapeHtml(diagnostic.message)}</li>`;
    })
    .join("\n");
  return `<ul class="forge-report-diagnostics">\n${items}\n</ul>`;
}

function renderSections(document: ReportDocument): string {
  return document.sections
    .map((section) => {
      const parts: string[] = [];
      parts.push(`<section class="forge-report-section">`);
      parts.push(`  <h2>${escapeHtml(section.title)}</h2>`);
      if (section.body) {
        parts.push(`  <p>${escapeHtml(section.body)}</p>`);
      }
      if (section.items && section.items.length > 0) {
        parts.push("  <ul>");
        for (const item of section.items) {
          const severity = item.severity
            ? ` <span class="forge-severity forge-severity--${item.severity}">[${escapeHtml(item.severity)}]</span>`
            : "";
          const summary = item.summary ? ` — ${escapeHtml(item.summary)}` : "";
          parts.push(`    <li><strong>${escapeHtml(item.title)}</strong>${severity}${summary}</li>`);
        }
        parts.push("  </ul>");
      }
      parts.push("</section>");
      return parts.join("\n");
    })
    .join("\n");
}

function renderMetadata(document: ReportDocument): string {
  const keys = Object.keys(document.metadata!).sort(); // deterministic
  const rows = keys
    .map(
      (key) =>
        `    <tr><th scope="row">${escapeHtml(key)}</th><td>${escapeHtml(String(document.metadata![key]))}</td></tr>`
    )
    .join("\n");
  return ['<table class="forge-report-metadata">', "  <tbody>", rows, "  </tbody>", "</table>"].join("\n");
}

/**
 * Renders a validated ReportDocument as a complete, deterministic, escaped HTML
 * document.
 */
export function renderHtml(document: unknown, options: HtmlRenderOptions = {}): string {
  validateReportDocument(document);

  const lang = escapeHtml(options.lang ?? "en");
  const css = options.cssVariables ? renderCssVariables(options.cssVariables) : "";

  const bodyParts: string[] = [];
  bodyParts.push('<header class="forge-report-header">');
  bodyParts.push(`  <h1>${escapeHtml(document.title)}</h1>`);
  if (document.subtitle) {
    bodyParts.push(`  <p class="forge-report-subtitle">${escapeHtml(document.subtitle)}</p>`);
  }
  if (document.generatedAt) {
    bodyParts.push(
      `  <p class="forge-report-generated"><time datetime="${escapeHtml(document.generatedAt)}">${escapeHtml(
        document.generatedAt
      )}</time></p>`
    );
  }
  bodyParts.push("</header>");

  if (document.summary) {
    bodyParts.push(renderSummary(document));
  }
  if (document.metrics && document.metrics.length > 0) {
    bodyParts.push(renderMetrics(document));
  }
  if (document.findings && document.findings.length > 0) {
    bodyParts.push(renderFindings(document));
  }
  if (document.diagnostics && document.diagnostics.length > 0) {
    bodyParts.push(renderDiagnostics(document));
  }
  bodyParts.push(renderSections(document));
  if (document.metadata && Object.keys(document.metadata).length > 0) {
    bodyParts.push(renderMetadata(document));
  }

  return [
    "<!doctype html>",
    `<html lang="${lang}">`,
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${escapeHtml(document.title)}</title>`,
    css ? `  <style>\n${css}\n  </style>` : null,
    "</head>",
    "<body>",
    bodyParts.join("\n"),
    "</body>",
    "</html>",
    "",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
