/**
 * @forge/reporting — structural validation of ReportDocument.
 *
 * Every generator validates its input up front so that invalid input fails with
 * a deterministic, typed ReportValidationError instead of producing
 * partial/garbage output. Unknown extra properties are allowed (forward
 * compatibility); known properties are validated precisely.
 */

import { SEVERITY_VALUES, isSeverity } from "@forge/domain";
import type { BaseFinding, Diagnostic, Metric } from "@forge/domain";
import type { ReportDocument, ReportSection } from "./types.js";
import { ReportValidationError } from "./errors.js";

function fail(message: string): never {
  throw new ReportValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function validateMetadata(metadata: unknown, where: string): void {
  if (metadata === undefined) {
    return;
  }
  if (!isRecord(metadata)) {
    fail(`${where} must be a plain object`);
  }
  for (const value of Object.values(metadata)) {
    if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
      fail(`${where} values must be JSON-serializable (found ${typeof value})`);
    }
  }
}

function validateBaseFinding(finding: unknown, index: number): asserts finding is BaseFinding {
  if (!isRecord(finding)) {
    fail(`findings[${index}] must be a BaseFinding object`);
  }
  if (!isNonEmptyString(finding.id)) {
    fail(`findings[${index}].id must be a non-empty string`);
  }
  if (!isSeverity(finding.severity)) {
    fail(`findings[${index}].severity must be one of ${SEVERITY_VALUES.join(", ")}`);
  }
  if (!isNonEmptyString(finding.category)) {
    fail(`findings[${index}].category must be a non-empty string`);
  }
  if (!isNonEmptyString(finding.title)) {
    fail(`findings[${index}].title must be a non-empty string`);
  }
  if (typeof finding.description !== "string") {
    fail(`findings[${index}].description must be a string`);
  }
  if (finding.recommendation !== undefined && typeof finding.recommendation !== "string") {
    fail(`findings[${index}].recommendation must be a string`);
  }
  if (finding.remediationCode !== undefined && typeof finding.remediationCode !== "string") {
    fail(`findings[${index}].remediationCode must be a string`);
  }
  if (finding.references !== undefined && !isStringArray(finding.references)) {
    fail(`findings[${index}].references must be an array of strings`);
  }
}

function validateMetric(metric: unknown, index: number): asserts metric is Metric {
  if (!isRecord(metric)) {
    fail(`metrics[${index}] must be a Metric object`);
  }
  if (!isNonEmptyString(metric.name)) {
    fail(`metrics[${index}].name must be a non-empty string`);
  }
  if (typeof metric.value !== "number" || !Number.isFinite(metric.value)) {
    fail(`metrics[${index}].value must be a finite number`);
  }
  if (!isNonEmptyString(metric.unit)) {
    fail(`metrics[${index}].unit must be a non-empty string`);
  }
  if (metric.baseline !== undefined && (typeof metric.baseline !== "number" || !Number.isFinite(metric.baseline))) {
    fail(`metrics[${index}].baseline must be a finite number`);
  }
  if (metric.target !== undefined && (typeof metric.target !== "number" || !Number.isFinite(metric.target))) {
    fail(`metrics[${index}].target must be a finite number`);
  }
  if (metric.timestamp !== undefined && typeof metric.timestamp !== "string") {
    fail(`metrics[${index}].timestamp must be a string`);
  }
}

function validateDiagnostic(diagnostic: unknown, index: number): asserts diagnostic is Diagnostic {
  if (!isRecord(diagnostic)) {
    fail(`diagnostics[${index}] must be a Diagnostic object`);
  }
  const level = diagnostic.level;
  if (level !== "info" && level !== "warning" && level !== "error") {
    fail(`diagnostics[${index}].level must be "info" | "warning" | "error"`);
  }
  if (typeof diagnostic.message !== "string") {
    fail(`diagnostics[${index}].message must be a string`);
  }
  if (diagnostic.code !== undefined && typeof diagnostic.code !== "string") {
    fail(`diagnostics[${index}].code must be a string`);
  }
}

function validateSection(section: unknown, index: number): asserts section is ReportSection {
  if (!isRecord(section)) {
    fail(`sections[${index}] must be a ReportSection object`);
  }
  if (!isNonEmptyString(section.title)) {
    fail(`sections[${index}].title must be a non-empty string`);
  }
  if (section.body !== undefined && typeof section.body !== "string") {
    fail(`sections[${index}].body must be a string`);
  }
  if (section.items !== undefined) {
    if (!Array.isArray(section.items)) {
      fail(`sections[${index}].items must be an array`);
    }
    section.items.forEach((item, itemIndex) => {
      if (!isRecord(item)) {
        fail(`sections[${index}].items[${itemIndex}] must be an object`);
      }
      if (!isNonEmptyString(item.title)) {
        fail(`sections[${index}].items[${itemIndex}].title must be a non-empty string`);
      }
      if (item.summary !== undefined && typeof item.summary !== "string") {
        fail(`sections[${index}].items[${itemIndex}].summary must be a string`);
      }
      if (item.severity !== undefined && !isSeverity(item.severity)) {
        fail(`sections[${index}].items[${itemIndex}].severity must be a valid Severity`);
      }
      validateMetadata(item.metadata, `sections[${index}].items[${itemIndex}].metadata`);
    });
  }
}

/**
 * Validates a value against the ReportDocument contract. Throws
 * ReportValidationError on the first violation.
 */
export function validateReportDocument(document: unknown): asserts document is ReportDocument {
  if (!isRecord(document)) {
    fail("report document must be a plain object");
  }
  if (!isNonEmptyString(document.title)) {
    fail("report document title must be a non-empty string");
  }
  if (!isOptionalString(document.subtitle)) {
    fail("report document subtitle must be a string");
  }
  if (!isOptionalString(document.generatedAt)) {
    fail("report document generatedAt must be a string");
  }
  if (!Array.isArray(document.sections)) {
    fail("report document sections must be an array");
  }
  document.sections.forEach(validateSection);

  if (document.summary !== undefined) {
    const summary = document.summary;
    if (!isRecord(summary)) {
      fail("summary must be a ReportSummary object");
    }
    if (!isNonNegativeInteger(summary.totalFindings)) {
      fail("summary.totalFindings must be a non-negative integer");
    }
    if (!isRecord(summary.findingsBySeverity)) {
      fail("summary.findingsBySeverity must be a record of severity -> count");
    }
    for (const [severity, count] of Object.entries(summary.findingsBySeverity)) {
      if (!isSeverity(severity)) {
        fail(`summary.findingsBySeverity key "${severity}" is not a valid Severity`);
      }
      if (!isNonNegativeInteger(count)) {
        fail(`summary.findingsBySeverity["${severity}"] must be a non-negative integer`);
      }
    }
    if (summary.score !== undefined && typeof summary.score !== "number") {
      fail("summary.score must be a number");
    }
    if (!isOptionalString(summary.generatedAt)) {
      fail("summary.generatedAt must be a string");
    }
    validateMetadata(summary.metadata, "summary.metadata");
  }

  if (document.findings !== undefined) {
    if (!Array.isArray(document.findings)) {
      fail("findings must be an array");
    }
    document.findings.forEach(validateBaseFinding);
  }

  if (document.metrics !== undefined) {
    if (!Array.isArray(document.metrics)) {
      fail("metrics must be an array");
    }
    document.metrics.forEach(validateMetric);
  }

  if (document.diagnostics !== undefined) {
    if (!Array.isArray(document.diagnostics)) {
      fail("diagnostics must be an array");
    }
    document.diagnostics.forEach(validateDiagnostic);
  }

  validateMetadata(document.metadata, "metadata");
}
