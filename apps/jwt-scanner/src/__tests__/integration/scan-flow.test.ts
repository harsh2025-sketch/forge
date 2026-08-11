/**
 * JWT Scanner integration test — the actual product flow (V3 §20.2 Day 13).
 *
 *   signup/authenticated state (AuthPort mock)
 *     → submit JWT (feature service + domain engine)
 *     → analysis (ProductEngine)
 *     → persist results (memory persistence, org-scoped)
 *     → load results (org-scoped)
 *     → open finding (org-scoped)
 *     → export report (@forge/reporting)
 *
 * External services are not required: auth and billing are @forge/testing /
 * dev-mode port implementations and persistence is the deterministic
 * in-memory seam. The test exercises the real feature wiring (service →
 * port → engine → persistence → reporting), not isolated React components.
 */

import { describe, expect, it } from "vitest";
import { getBillingStatus } from "@/features/billing/service.js";
import {
  exportScanReport,
  getFindingDetail,
  getScanResults,
  submitScan,
} from "@/features/scans/service.js";
import { scanDeps, foreignScanDeps, noneAlgToken, EVALUATION_TIME } from "@/__tests__/test-utils.js";
import { billingDepsWithStore } from "@/__tests__/test-utils.js";

describe("JWT Scanner product flow (integration)", () => {
  it("runs signup-state → scan → view findings → finding detail → export report", async () => {
    // 1. Authenticated state (signup simulated through the AuthPort).
    const deps = scanDeps();

    // 2. Submit a JWT for analysis.
    const submitted = await submitScan(deps, { token: noneAlgToken() });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    const { jobId } = submitted.value;

    // 3. Analysis ran and persisted results (engine + persistence wiring).
    const results = await getScanResults(deps, jobId);
    expect(results.ok).toBe(true);
    if (!results.ok) return;
    expect(results.value.job.status).toBe("completed");
    expect(results.value.job.completedAt?.toISOString()).toBe(
      new Date(EVALUATION_TIME * 1000).toISOString(),
    );
    expect(results.value.findings.length).toBeGreaterThan(0);
    expect(results.value.summary.totalFindings).toBe(results.value.findings.length);
    const finding = results.value.findings[0]!;

    // 4. Open the finding detail (org-scoped).
    const detail = await getFindingDetail(deps, jobId, finding.id);
    expect(detail.ok).toBe(true);
    if (detail.ok) {
      expect(detail.value.finding.title).toBe(finding.title);
      expect(detail.value.finding.category).toBe("none_alg");
      expect(detail.value.job.id).toBe(jobId);
    }

    // 5. Export the report through @forge/reporting and record the export.
    const exported = await exportScanReport(deps, jobId, "json");
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const document = JSON.parse(exported.value.content) as {
      title: string;
      summary: { totalFindings: number; findingsBySeverity: Record<string, number> };
      findings: Array<{ severity: string; category: string; title: string }>;
    };
    expect(document.title).toContain("JWT Scanner report");
    expect(document.summary.totalFindings).toBeGreaterThan(0);
    expect(document.findings[0]!.severity).toBe("critical");
    expect(document.findings[0]!.category).toBe("none_alg");
    expect(document.findings[0]!.title).toBe(finding.title);
    expect(exported.value.filename).toBe(`jwt-scanner-${jobId}.json`);
  });

  it("keeps every step tenant-scoped (IDOR-style check)", async () => {
    const deps = scanDeps();
    const submitted = await submitScan(deps, { token: noneAlgToken(), projectName: "private-project" });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    // Another org's authenticated user must not see the scan, its findings,
    // or export its report.
    const foreign = foreignScanDeps();
    const results = await getScanResults(foreign, submitted.value.jobId);
    expect(results.ok).toBe(false);

    const exported = await exportScanReport(foreign, submitted.value.jobId, "json");
    expect(exported.ok).toBe(false);
    if (!exported.ok) {
      expect(exported.error).toBe("Scan not found");
    }
  });

  it("wires billing through the BillingPort seam in the same authenticated context", async () => {
    const { deps: billing } = billingDepsWithStore();
    const scan = scanDeps();

    // Scan works and billing status is available for the same org.
    const submitted = await submitScan(scan, { token: noneAlgToken() });
    expect(submitted.ok).toBe(true);

    const status = await getBillingStatus(billing);
    expect(status.ok).toBe(true);
    if (status.ok) {
      expect(status.value.status).toBe("none");
    }
  });

  it("produces deterministic reports for identical input", async () => {
    const first = scanDeps();
    const second = scanDeps();
    const firstSubmit = await submitScan(first, { token: noneAlgToken() });
    const secondSubmit = await submitScan(second, { token: noneAlgToken() });
    expect(firstSubmit.ok && secondSubmit.ok).toBe(true);
    if (!firstSubmit.ok || !secondSubmit.ok) return;

    const firstReport = await exportScanReport(first, firstSubmit.value.jobId, "json");
    const secondReport = await exportScanReport(second, secondSubmit.value.jobId, "json");
    expect(firstReport.ok && secondReport.ok).toBe(true);
    if (!firstReport.ok || !secondReport.ok) return;

    // Same token + same config → identical report payloads (job ids are the
    // only difference; the report template serializes them as metadata, so
    // normalize by removing the job id before comparing).
    const stripJob = (content: string): string =>
      content.replace(/memory_job_\d+/g, "<job>").replace(/memory_finding_\d+/g, "<finding>");
    expect(stripJob(firstReport.value.content)).toBe(stripJob(secondReport.value.content));
  });
});
