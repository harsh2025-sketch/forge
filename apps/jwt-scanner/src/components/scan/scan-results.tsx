/**
 * Scan results view (V3 §20.2 Day 13 — results display).
 *
 * Pure presentational component: consumes persisted/domain results passed as
 * props (never re-analyzes, never fabricates findings). Shows scan status,
 * overall summary, severity counts, finding list with severity badges, and
 * metadata. Empty/error states are handled by the caller (page) using
 * @forge/ui EmptyState.
 */

import type { ReactNode } from "react";
import { Card, EmptyState, SeverityBadge, StatusBadge, Table } from "@forge/ui";
import type { FindingRow } from "@/db/schema";
import type { ScanResults } from "@/features/scans/service";

export interface ScanResultsViewProps {
  readonly results: ScanResults;
  /** Renders a link to a finding (injected so the component stays framework-neutral). */
  readonly renderFindingLink?: (finding: FindingRow) => ReactNode;
}

export function ScanResultsView({
  results,
  renderFindingLink,
}: ScanResultsViewProps): ReactNode {
  const { job, project, findings, summary } = results;

  if (findings.length === 0) {
    return (
      <div>
        <Card>
          <StatusBadge status={job.status} tone={job.status === "completed" ? "success" : "info"} />
        </Card>
        <EmptyState
          title="No findings"
          description={`The scan completed with no findings in ${summary.totalFindings} categories checked.`}
        />
      </div>
    );
  }

  const rows = findings.map((finding) => ({
    id: finding.id,
    severity: finding.severity,
    category: finding.category,
    title: finding.title,
    recommendation: finding.recommendation ?? "",
    _finding: finding,
  }));

  return (
    <div className="scan-results">
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: "calc(var(--forge-spacing-unit) * 3)", flexWrap: "wrap" }}>
          <StatusBadge status={job.status} tone={job.status === "completed" ? "success" : "info"} />
          <span>
            <strong>{summary.totalFindings}</strong> finding{summary.totalFindings === 1 ? "" : "s"}
          </span>
          {(["critical", "high", "medium", "low", "info"] as const).map((severity) =>
            summary.findingsBySeverity[severity] > 0 ? (
              <SeverityBadge key={severity} severity={severity} label={`${severity}: ${summary.findingsBySeverity[severity]}`} />
            ) : null,
          )}
        </div>
      </Card>

      <Table<{ id: string; severity: string; category: string; title: string; recommendation: string; _finding: FindingRow }>
        caption={`Findings for scan ${job.id} — project “${project.name}”`}
        variant="striped"
        columns={[
          { key: "severity", header: "Severity", render: (row) => <SeverityBadge severity={row.severity} /> },
          { key: "category", header: "Category", render: (row) => <span style={{ fontFamily: "var(--forge-typography-font-family-mono)" }}>{row.category}</span> },
          { key: "title", header: "Finding", render: (row) => (
            renderFindingLink !== undefined
              ? renderFindingLink(row._finding)
              : <span>{row.title}</span>
          ) },
          { key: "recommendation", header: "Recommendation" },
        ]}
        rows={rows}
      />
    </div>
  );
}
