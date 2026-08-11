/**
 * Results display tests (V3 §20.2 Day 13).
 *
 * Server-rendered component assertions via react-dom/server (the same
 * technique @forge/ui uses), covering successful rendering, empty results,
 * severity display and token-driven styling.
 */

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ScanResultsView } from "@/components/scan/scan-results.js";
import type { AnalysisJobRow, FindingRow, ProjectRow } from "@/db/schema";
import type { ScanResults } from "../service.js";

function findingRow(overrides: Partial<FindingRow> = {}): FindingRow {
  return {
    id: "memory_finding_0001",
    organizationId: "org_test_0001",
    jobId: "memory_job_0001",
    severity: "critical",
    category: "none_alg",
    title: "Unsecured JWT algorithm declared",
    description: "The decoded JWT header declares alg=none.",
    evidence: {
      header: { alg: "none" },
      payload: { sub: "1234567890" },
      signaturePresent: false,
      decoded: true,
    },
    recommendation: "Reject unsecured JWTs.",
    remediationCode: null,
    references: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function jobRow(overrides: Partial<AnalysisJobRow> = {}): AnalysisJobRow {
  return {
    id: "memory_job_0001",
    organizationId: "org_test_0001",
    projectId: "memory_project_0001",
    status: "completed",
    error: null,
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
    completedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function projectRow(overrides: Partial<ProjectRow> = {}): ProjectRow {
  return {
    id: "memory_project_0001",
    organizationId: "org_test_0001",
    name: "Default project",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function results(overrides: Partial<ScanResults> = {}): ScanResults {
  const job = jobRow();
  const findings = [findingRow()];
  return {
    job,
    project: projectRow(),
    findings,
    summary: {
      totalFindings: findings.length,
      findingsBySeverity: {
        critical: 1,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      },
    },
    ...overrides,
  };
}

describe("ScanResultsView", () => {
  it("renders scan status, summary and finding list", () => {
    const html = renderToString(<ScanResultsView results={results()} />);
    expect(html).toContain("completed");
    expect(html).toContain("<strong>1</strong> finding");
    expect(html).toContain("Unsecured JWT algorithm declared");
    expect(html).toContain("none_alg");
    expect(html).toContain("memory_job_0001");
  });

  it("renders severity badges for each severity bucket", () => {
    const html = renderToString(
      <ScanResultsView
        results={results({
          findings: [
            findingRow({ id: "f1", severity: "critical", title: "A" }),
            findingRow({ id: "f2", severity: "high", title: "B" }),
            findingRow({ id: "f3", severity: "medium", title: "C" }),
            findingRow({ id: "f4", severity: "low", title: "D" }),
            findingRow({ id: "f5", severity: "info", title: "E" }),
          ],
          summary: {
            totalFindings: 5,
            findingsBySeverity: { critical: 1, high: 1, medium: 1, low: 1, info: 1 },
          },
        })}
      />,
    );
    expect(html).toContain("critical");
    expect(html).toContain("high");
    expect(html).toContain("medium");
    expect(html).toContain("low");
    expect(html).toContain("info");
    expect(html).toContain("forge-severity-badge");
  });

  it("renders an empty state when there are no findings", () => {
    const html = renderToString(
      <ScanResultsView
        results={results({
          findings: [],
          summary: {
            totalFindings: 0,
            findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
          },
        })}
      />,
    );
    expect(html).toContain("No findings");
  });

  it("renders finding links through the injected renderer", () => {
    const html = renderToString(
      <ScanResultsView
        results={results()}
        renderFindingLink={(finding) => <a href={`/findings/${finding.id}`}>{finding.title}</a>}
      />,
    );
    expect(html).toContain('href="/findings/memory_finding_0001"');
  });

  it("consumes theme tokens instead of hard-coded product colors", () => {
    const html = renderToString(<ScanResultsView results={results()} />);
    expect(html).toContain("var(--forge-colors-surface-border)");
    expect(html).not.toContain("#ff0000");
  });
});
