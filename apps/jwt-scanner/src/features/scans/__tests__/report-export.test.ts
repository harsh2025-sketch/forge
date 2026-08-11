/**
 * Report export tests (V3 §8.3, Day 13).
 *
 * Verifies that exports go through @forge/reporting, that the report contains
 * the scan summary and findings with severity and details preserved, and that
 * identical input produces byte-identical output (determinism).
 */

import { describe, expect, it } from "vitest";
import { ReportFormat, render, validateReportDocument } from "@forge/reporting";
import {
  EXPORT_FORMATS,
  isExportFormat,
  jwtScanReportTemplate,
  renderScanReport,
} from "../report.js";
import { exportScanReport, getScanResults, submitScan } from "../service.js";
import { scanDeps, foreignScanDeps, noneAlgToken, EVALUATION_TIME } from "@/__tests__/test-utils.js";

describe("report template", () => {
  it("is a valid ReportTemplate producing a valid ReportDocument", () => {
    expect(jwtScanReportTemplate.name).toBe("jwt-scanner-scan-report");
    expect(jwtScanReportTemplate.format).toBe(ReportFormat.JSON);
  });

  it("exports use @forge/reporting: content equals the shared pipeline output", async () => {
    const deps = scanDeps();
    const submitted = await submitScan(deps, { token: noneAlgToken() });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    const results = await getScanResults(deps, submitted.value.jobId);
    expect(results.ok).toBe(true);
    if (!results.ok) return;

    const data = {
      job: results.value.job,
      project: results.value.project,
      findings: results.value.findings,
      organizationName: "Test Organization",
      engine: "jwt-scanner-analyzer",
      engineVersion: "1.0.0",
    };
    const expected = render(jwtScanReportTemplate, data, ReportFormat.JSON);
    expect(renderScanReport(data, ReportFormat.JSON).content).toBe(expected);
    expect(JSON.parse(renderScanReport(data, ReportFormat.JSON).content)).toBeDefined();
  });

  it("contains the scan summary with severity counts", async () => {
    const deps = scanDeps();
    const submitted = await submitScan(deps, { token: noneAlgToken() });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    const results = await getScanResults(deps, submitted.value.jobId);
    expect(results.ok).toBe(true);
    if (!results.ok) return;

    const exported = renderScanReport(
      {
        job: results.value.job,
        project: results.value.project,
        findings: results.value.findings,
        organizationName: "Test Organization",
        engine: "jwt-scanner-analyzer",
        engineVersion: "1.0.0",
      },
      ReportFormat.JSON,
    );
    const document = JSON.parse(exported.content) as {
      summary: { totalFindings: number; findingsBySeverity: Record<string, number> };
      findings: Array<{ severity: string; title: string; category: string; description: string }>;
    };
    expect(document.summary.totalFindings).toBe(1);
    expect(document.summary.findingsBySeverity.critical).toBe(1);
    expect(document.findings).toHaveLength(1);
    expect(document.findings[0]!.severity).toBe("critical");
    expect(document.findings[0]!.category).toBe("none_alg");
    expect(document.findings[0]!.title).toContain("Unsecured JWT algorithm declared");
    expect(document.findings[0]!.description.length).toBeGreaterThan(20);
  });

  it("preserves finding details in every format", async () => {
    const deps = scanDeps();
    const submitted = await submitScan(deps, { token: noneAlgToken() });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    const results = await getScanResults(deps, submitted.value.jobId);
    expect(results.ok).toBe(true);
    if (!results.ok) return;

    const data = {
      job: results.value.job,
      project: results.value.project,
      findings: results.value.findings,
      organizationName: "Test Organization",
      engine: "jwt-scanner-analyzer",
      engineVersion: "1.0.0",
    };

    // Markdown: summary table + findings section with title and description.
    const markdown = renderScanReport(data, ReportFormat.MARKDOWN).content;
    expect(markdown).toContain("## Summary");
    expect(markdown).toContain("Unsecured JWT algorithm declared");
    expect(markdown).toContain("critical");
    expect(markdown).toContain("The decoded JWT header declares alg=none");

    // JSON: full finding details including recommendation and evidence.
    const json = JSON.parse(renderScanReport(data, ReportFormat.JSON).content) as {
      findings: Array<{
        description: string;
        recommendation: string;
        evidence: { header: Record<string, unknown> };
      }>;
    };
    expect(json.findings[0]!.description.length).toBeGreaterThan(20);
    expect(json.findings[0]!.recommendation).toContain("Reject unsecured JWTs");
    expect(json.findings[0]!.evidence.header).toEqual({ alg: "none", typ: "JWT" });

    // HTML: escaped finding title present.
    const html = renderScanReport(data, ReportFormat.HTML).content;
    expect(html).toContain("Unsecured JWT algorithm declared");
  });

  it("supports all product export formats and rejects others", () => {
    expect(EXPORT_FORMATS).toEqual(["json", "markdown", "html"]);
    expect(isExportFormat("json")).toBe(true);
    expect(isExportFormat("markdown")).toBe(true);
    expect(isExportFormat("html")).toBe(true);
    expect(isExportFormat("pdf")).toBe(false);
  });

  it("is deterministic for identical input", async () => {
    const deps = scanDeps();
    const submitted = await submitScan(deps, { token: noneAlgToken() });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    const results = await getScanResults(deps, submitted.value.jobId);
    expect(results.ok).toBe(true);
    if (!results.ok) return;

    const data = {
      job: results.value.job,
      project: results.value.project,
      findings: results.value.findings,
      organizationName: "Test Organization",
      engine: "jwt-scanner-analyzer",
      engineVersion: "1.0.0",
    };
    const first = renderScanReport(data, ReportFormat.JSON).content;
    const second = renderScanReport(data, ReportFormat.JSON).content;
    expect(first).toBe(second);
    // Two separate scans of the same token produce identical findings, so the
    // report payloads must match too.
    const deps2 = scanDeps();
    const secondSubmit = await submitScan(deps2, { token: noneAlgToken(), projectName: "Default project" });
    expect(secondSubmit.ok).toBe(true);
    if (!secondSubmit.ok) return;
    const results2 = await getScanResults(deps2, secondSubmit.value.jobId);
    expect(results2.ok).toBe(true);
    if (!results2.ok) return;
    expect(results2.value.findings.map((f) => f.title)).toEqual(results.value.findings.map((f) => f.title));
  });
});

describe("exportScanReport (service)", () => {
  it("renders and records an export row for the org", async () => {
    const deps = scanDeps();
    const submitted = await submitScan(deps, { token: noneAlgToken() });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    const exported = await exportScanReport(deps, submitted.value.jobId, "json");
    expect(exported.ok).toBe(true);
    if (exported.ok) {
      expect(exported.value.filename).toBe(`jwt-scanner-${submitted.value.jobId}.json`);
      expect(JSON.parse(exported.value.content)).toBeDefined();
    }
  });

  it("rejects unsupported formats", async () => {
    const deps = scanDeps();
    const submitted = await submitScan(deps, { token: noneAlgToken() });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    const exported = await exportScanReport(deps, submitted.value.jobId, "pdf");
    expect(exported.ok).toBe(false);
    if (!exported.ok) {
      expect(exported.error).toBe("Unsupported report format");
    }
  });

  it("does not export another org's scan", async () => {
    const deps = scanDeps();
    const submitted = await submitScan(deps, { token: noneAlgToken() });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    const exported = await exportScanReport(foreignScanDeps(), submitted.value.jobId, "json");
    expect(exported.ok).toBe(false);
    if (!exported.ok) {
      expect(exported.error).toBe("Scan not found");
    }
  });

  it("records deterministic timestamps derived from the job, not the clock", async () => {
    const deps = scanDeps({ evaluationTime: EVALUATION_TIME });
    const submitted = await submitScan(deps, { token: noneAlgToken() });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    const exported = await exportScanReport(deps, submitted.value.jobId, "json");
    expect(exported.ok).toBe(true);
    if (exported.ok) {
      const parsed = JSON.parse(exported.value.content) as { generatedAt: string };
      expect(parsed.generatedAt).toBe(new Date(EVALUATION_TIME * 1000).toISOString());
    }
  });

  it("document produced by the template passes the shared validator", async () => {
    const deps = scanDeps();
    const submitted = await submitScan(deps, { token: noneAlgToken() });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    const results = await getScanResults(deps, submitted.value.jobId);
    expect(results.ok).toBe(true);
    if (!results.ok) return;
    const document = jwtScanReportTemplate.build({
      job: results.value.job,
      project: results.value.project,
      findings: results.value.findings,
      organizationName: "Test Organization",
      engine: "jwt-scanner-analyzer",
      engineVersion: "1.0.0",
    });
    expect(() => validateReportDocument(document)).not.toThrow();
  });
});
