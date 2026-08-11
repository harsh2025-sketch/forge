/**
 * @forge/reporting — deterministic Markdown generator.
 *
 * Renders the same format-neutral ReportDocument consumed by the JSON and HTML
 * generators, so all formats share identical report semantics.
 *
 * Guarantees:
 *  - valid, readable Markdown (ATX headings, tables, lists)
 *  - deterministic output for a given document
 *  - escaping where necessary: table cells escape `|` and newlines; list item
 *    text and headings are single-lined so structure cannot be broken
 *  - no HTML-only assumptions (the output is plain Markdown)
 */

import { SEVERITY_ORDER } from "@forge/domain";
import { validateReportDocument } from "../validate.js";
import { stableStringify } from "./json.js";

/** Collapses newlines/whitespace so a value cannot break out of a Markdown line. */
function singleLine(value: string): string {
  return value.replace(/\s*\n+\s*/g, " ").trim();
}

/** Escapes a cell for a Markdown table (pipes and newlines cannot appear raw). */
function cell(value: string): string {
  return singleLine(value).replace(/\|/g, "\\|");
}

/** Renders a Markdown table (header, separator, rows). */
function table(headers: readonly string[], rows: readonly (readonly string[])[]): string[] {
  const lines: string[] = [];
  lines.push(`| ${headers.map(cell).join(" | ")} |`);
  lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
  for (const row of rows) {
    lines.push(`| ${row.map(cell).join(" | ")} |`);
  }
  return lines;
}

/** Renders a plain value for the metadata table (compact deterministic JSON for non-primitives). */
function metadataValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return singleLine(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return singleLine(stableStringify(value, 0));
}

/**
 * Renders a validated ReportDocument as deterministic Markdown.
 */
export function renderMarkdown(document: unknown): string {
  validateReportDocument(document);
  const lines: string[] = [];

  lines.push(`# ${singleLine(document.title)}`);
  if (document.subtitle) {
    lines.push("", `> ${singleLine(document.subtitle)}`);
  }
  if (document.generatedAt) {
    lines.push("", `_Generated: ${singleLine(document.generatedAt)}_`);
  }

  if (document.summary) {
    const { summary } = document;
    lines.push("", "## Summary");
    const rows: string[][] = [];
    for (const severity of SEVERITY_ORDER) {
      const count = summary.findingsBySeverity[severity] ?? 0;
      rows.push([severity, String(count)]);
    }
    lines.push(...table(["Severity", "Count"], rows));
    lines.push("", `**Total findings:** ${summary.totalFindings}`);
    if (summary.score !== undefined) {
      lines.push("", `**Score:** ${summary.score}`);
    }
  }

  if (document.metrics && document.metrics.length > 0) {
    lines.push("", "## Metrics");
    const rows: string[][] = [];
    for (const metric of document.metrics) {
      rows.push([metric.name, String(metric.value), metric.unit]);
    }
    lines.push(...table(["Metric", "Value", "Unit"], rows));
  }

  if (document.findings && document.findings.length > 0) {
    lines.push("", "## Findings");
    const rows: string[][] = [];
    for (const finding of document.findings) {
      rows.push([finding.id, finding.severity, finding.category, finding.title]);
    }
    lines.push(...table(["ID", "Severity", "Category", "Title"], rows));
  }

  if (document.diagnostics && document.diagnostics.length > 0) {
    lines.push("", "## Diagnostics");
    for (const diagnostic of document.diagnostics) {
      const code = diagnostic.code ? ` (${singleLine(diagnostic.code)})` : "";
      lines.push(`- **${diagnostic.level}**${code}: ${singleLine(diagnostic.message)}`);
    }
  }

  for (const section of document.sections) {
    lines.push("", `## ${singleLine(section.title)}`);
    if (section.body) {
      lines.push("", singleLine(section.body));
    }
    if (section.items && section.items.length > 0) {
      for (const item of section.items) {
        const severityTag = item.severity ? `**[${item.severity}]** ` : "";
        const summary = item.summary ? ` — ${singleLine(item.summary)}` : "";
        lines.push(`- ${severityTag}**${singleLine(item.title)}**${summary}`);
      }
    }
  }

  if (document.metadata && Object.keys(document.metadata).length > 0) {
    lines.push("", "## Metadata");
    const keys = Object.keys(document.metadata).sort(); // deterministic
    const rows: string[][] = keys.map((key) => [key, metadataValue(document.metadata![key])]);
    lines.push(...table(["Key", "Value"], rows));
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}
