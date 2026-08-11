/**
 * JWT Scanner report export (V3 §8.3, capability "reporting", Day 13).
 *
 * The report is produced exclusively through @forge/reporting: the product
 * implements the ReportTemplate contract (turning persisted scan data into
 * the format-neutral ReportDocument) and the shared pipeline renders that
 * document as JSON / Markdown / HTML. There is deliberately no second
 * reporting framework and no product-local renderer.
 *
 * Determinism: the template never reads the clock or the environment — every
 * timestamp comes from the persisted job. Identical persisted data therefore
 * always produces byte-identical output (verified by tests).
 *
 * The report is derived from persisted results only (the raw scanned token is
 * never persisted, V3 §11.3); evidence in the report is the decoded
 * header/payload material stored with each finding.
 */

import { ReportFormat, render, validateReportDocument } from "@forge/reporting";
import type { ReportDocument, ReportTemplate } from "@forge/reporting";
import { Severity, SEVERITY_ORDER } from "@forge/domain";
import type { AnalysisJobRow, FindingRow, ProjectRow } from "@/db/schema";
import { JWT_FINDING_CATEGORIES } from "@/domain/types";

/** Data the report template consumes (persisted scan results). */
export interface ScanReportData {
  readonly job: AnalysisJobRow;
  readonly project: ProjectRow;
  readonly findings: readonly FindingRow[];
  readonly organizationName: string;
  /** Engine identity recorded on the job at analysis time. */
  readonly engine: string;
  readonly engineVersion: string;
}

/** Export formats supported by the product (all rendered by @forge/reporting). */
export const EXPORT_FORMATS = [ReportFormat.JSON, ReportFormat.MARKDOWN, ReportFormat.HTML] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export function isExportFormat(value: unknown): value is ExportFormat {
  return (
    typeof value === "string" &&
    (EXPORT_FORMATS as readonly string[]).includes(value)
  );
}

/** jsonb reference arrays arrive as `unknown`; sanitize to string arrays. */
function referencesOf(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function countBySeverity(findings: readonly FindingRow[]): Record<Severity, number> {
  const counts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const finding of findings) {
    counts[finding.severity as Severity] += 1;
  }
  return counts;
}

/** Severity ordering used for the findings table (shared taxonomy order). */
const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

function sortedFindings(findings: readonly FindingRow[]): readonly FindingRow[] {
  return [...findings].sort((left, right) => {
    const bySeverity = SEVERITY_RANK[left.severity as Severity] - SEVERITY_RANK[right.severity as Severity];
    if (bySeverity !== 0) return bySeverity;
    return left.id.localeCompare(right.id);
  });
}

/**
 * The JWT Scanner report template. `build` turns persisted scan data into the
 * canonical ReportDocument consumed by the shared JSON/Markdown/HTML
 * generators.
 */
export const jwtScanReportTemplate: ReportTemplate<ScanReportData> = {
  name: "jwt-scanner-scan-report",
  description: "JWT Scanner analysis report (project, summary, findings, evidence)",
  format: ReportFormat.JSON,
  build(data: ScanReportData): ReportDocument {
    const findings = sortedFindings(data.findings);
    const counts = countBySeverity(findings);
    const completedAt = data.job.completedAt ?? data.job.createdAt;

    return {
      title: `JWT Scanner report — ${data.project.name}`,
      subtitle: `Scan ${data.job.id} · ${data.organizationName}`,
      generatedAt: completedAt.toISOString(),
      summary: {
        totalFindings: findings.length,
        findingsBySeverity: counts,
        generatedAt: completedAt.toISOString(),
        metadata: {
          engine: data.engine,
          engineVersion: data.engineVersion,
          jobId: data.job.id,
          status: data.job.status,
        },
      },
      sections: [
        {
          title: "Scan summary",
          items: [
            { title: "Status", summary: data.job.status },
            { title: "Project", summary: data.project.name },
            { title: "Organization", summary: data.organizationName },
            { title: "Completed at", summary: completedAt.toISOString() },
            {
              title: "Findings by severity",
              metadata: {
                ...counts,
                order: [...SEVERITY_ORDER],
              },
            },
          ],
        },
        {
          title: "Findings",
          body:
            findings.length === 0
              ? "No findings were detected for this scan."
              : `${findings.length} finding(s) detected across ${JWT_FINDING_CATEGORIES.length} categories.`,
          items: findings.map((finding) => ({
            title: finding.title,
            summary: finding.description,
            severity: finding.severity as Severity,
            metadata: {
              id: finding.id,
              category: finding.category,
              ...(finding.recommendation === null ? {} : { recommendation: finding.recommendation }),
              ...(finding.remediationCode === null ? {} : { remediationCode: finding.remediationCode }),
              ...(referencesOf(finding.references).length > 0
                ? { references: referencesOf(finding.references) }
                : {}),
            },
          })),
        },
      ],
      findings: findings.map((finding) => ({
        id: finding.id,
        severity: finding.severity as Severity,
        category: finding.category,
        title: finding.title,
        description: finding.description,
        evidence: finding.evidence,
        recommendation: finding.recommendation ?? undefined,
        remediationCode: finding.remediationCode ?? undefined,
        references: referencesOf(finding.references).length > 0 ? referencesOf(finding.references) : undefined,
      })),
      metadata: {
        reportTemplate: "jwt-scanner-scan-report",
        exportFormat: ReportFormat.JSON,
      },
    };
  },
};

export interface ExportResult {
  readonly format: ExportFormat;
  readonly content: string;
  readonly filename: string;
}

/** Renders a scan report in the requested format through @forge/reporting. */
export function renderScanReport(
  data: ScanReportData,
  format: ExportFormat,
): ExportResult {
  const document = jwtScanReportTemplate.build(data);
  // Structural validation is part of the shared pipeline; calling it here
  // keeps failures deterministic and typed for the feature layer.
  validateReportDocument(document);
  const content = render(jwtScanReportTemplate, data, format);
  return {
    format,
    content,
    filename: `jwt-scanner-${data.job.id}.${format === ReportFormat.JSON ? "json" : format === ReportFormat.MARKDOWN ? "md" : "html"}`,
  };
}
