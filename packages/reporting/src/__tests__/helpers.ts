/**
 * Shared fixtures for @forge/reporting tests: a deterministic ReportTemplate
 * implementation (the "product side" of the contract) and sample data.
 */

import type { ReportDocument, ReportTemplate } from "../types.js";
import { ReportFormat } from "../types.js";
import type { Severity } from "@forge/domain";

export interface ScanFinding {
  readonly id: string;
  readonly severity: Severity;
  readonly category: string;
  readonly title: string;
  readonly description: string;
  readonly evidence: unknown;
  readonly recommendation?: string;
}

export interface ScanResultData {
  readonly target: string;
  readonly findings: readonly ScanFinding[];
  readonly score?: number;
}

export const FIXED_GENERATED_AT = "2026-08-11T00:00:00.000Z";

export function buildScanDocument(data: ScanResultData, generatedAt: string = FIXED_GENERATED_AT): ReportDocument {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const finding of data.findings) {
    counts[finding.severity] += 1;
  }
  return {
    title: `Scan results — ${data.target}`,
    subtitle: "Shared reporting infrastructure validation",
    generatedAt,
    summary: {
      totalFindings: data.findings.length,
      findingsBySeverity: counts,
      score: data.score,
      generatedAt,
    },
    findings: data.findings,
    sections: [
      {
        title: "Overview",
        body: `Analyzed ${data.target} and found ${data.findings.length} issue(s).`,
        items: data.findings.map((finding) => ({
          title: finding.title,
          summary: finding.description,
          severity: finding.severity,
        })),
      },
      {
        title: "Next steps",
        items: [{ title: "Review critical findings first", severity: "critical" }],
      },
    ],
    metadata: { target: data.target, generator: "test-fixture" },
  };
}

export const scanResultsTemplate: ReportTemplate<ScanResultData> = {
  name: "scan-results",
  description: "Test fixture template for the shared reporting infrastructure",
  format: ReportFormat.MARKDOWN,
  build: (data) => buildScanDocument(data),
};

export const sampleData: ScanResultData = {
  target: "https://example.com",
  score: 87,
  findings: [
    {
      id: "F-1",
      severity: "critical",
      category: "jwt_alg_confusion",
      title: "Algorithm confusion: HS256 accepted with RSA public key",
      description: "The token was signed with HS256 but verified with an RSA public key.",
      evidence: { header: { alg: "HS256", typ: "JWT" } },
      recommendation: "Pin the expected algorithm per issuer.",
    },
    {
      id: "F-2",
      severity: "low",
      category: "missing_claim",
      title: "Token has no expiration claim",
      description: "Long-lived token without exp claim.",
      evidence: { claims: ["sub", "iat"] },
    },
  ],
};

export const emptyData: ScanResultData = {
  target: "https://clean.example",
  findings: [],
};
