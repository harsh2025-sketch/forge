/**
 * Finding detail tests (V3 §20.2 Day 13).
 *
 * SSR assertions for the finding detail view: data display, evidence and
 * recommendation handling, and missing-finding behavior at the service
 * layer.
 */

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { FindingDetailView } from "@/components/scan/finding-detail-view.js";
import { getFindingDetail, submitScan } from "../service.js";
import { scanDeps, foreignScanDeps, noneAlgToken } from "@/__tests__/test-utils.js";
import type { FindingRow } from "@/db/schema";

function findingRow(overrides: Partial<FindingRow> = {}): FindingRow {
  return {
    id: "memory_finding_0001",
    organizationId: "org_test_0001",
    jobId: "memory_job_0001",
    severity: "high",
    category: "alg_confusion",
    title: "Declared algorithm conflicts with verification policy",
    description: "The decoded JWT header declares alg=HS256.",
    evidence: {
      header: { alg: "HS256", typ: "JWT" },
      payload: { sub: "1234567890" },
      signaturePresent: true,
      decoded: true,
    },
    recommendation: "Enforce an algorithm allow-list.",
    remediationCode: null,
    references: ["https://www.rfc-editor.org/rfc/rfc7518"],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("FindingDetailView", () => {
  it("displays finding data: severity, category, id, title, description", () => {
    const html = renderToString(
      <FindingDetailView finding={findingRow()} jobId="memory_job_0001" />,
    );
    expect(html).toContain("Declared algorithm conflicts with verification policy");
    expect(html).toContain("memory_finding_0001");
    expect(html).toContain("alg_confusion");
    expect(html).toContain("The decoded JWT header declares alg=HS256.");
  });

  it("displays evidence (decoded header/payload) and recommendation", () => {
    const html = renderToString(
      <FindingDetailView finding={findingRow()} jobId="memory_job_0001" />,
    );
    expect(html).toContain("Evidence");
    // React SSR escapes quotes inside the JSON pre blocks.
    expect(html).toContain("&quot;alg&quot;: &quot;HS256&quot;");
    expect(html).toContain("&quot;sub&quot;: &quot;1234567890&quot;");
    expect(html).toContain("Enforce an algorithm allow-list.");
    expect(html).toContain("https://www.rfc-editor.org/rfc/rfc7518");
  });

  it("never exposes the raw token", () => {
    const html = renderToString(
      <FindingDetailView finding={findingRow()} jobId="memory_job_0001" />,
    );
    expect(html).not.toContain("eyJhbGciOi");
    expect(html).not.toContain("signature");
  });

  it("falls back gracefully when recommendation is missing", () => {
    const html = renderToString(
      <FindingDetailView
        finding={findingRow({ recommendation: null, remediationCode: "fix-it", references: [] })}
        jobId="memory_job_0001"
      />,
    );
    expect(html).toContain("No recommendation provided.");
    expect(html).toContain("fix-it");
  });

  it("renders a back link through the injected renderer", () => {
    const html = renderToString(
      <FindingDetailView
        finding={findingRow()}
        jobId="memory_job_0001"
        renderBackLink={(jobId) => <a href={`/scans/${jobId}`}>Back</a>}
      />,
    );
    expect(html).toContain('href="/scans/memory_job_0001"');
  });
});

describe("getFindingDetail (service)", () => {
  it("returns the persisted finding for the org", async () => {
    const deps = scanDeps();
    const submitted = await submitScan(deps, { token: noneAlgToken() });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    const results = await import("../service.js").then((m) =>
      m.getScanResults(deps, submitted.value.jobId),
    );
    expect(results.ok).toBe(true);
    if (!results.ok) return;
    const finding = results.value.findings[0]!;

    const detail = await getFindingDetail(deps, submitted.value.jobId, finding.id);
    expect(detail.ok).toBe(true);
    if (detail.ok) {
      expect(detail.value.finding.id).toBe(finding.id);
      expect(detail.value.finding.category).toBe("none_alg");
      expect(detail.value.job.id).toBe(submitted.value.jobId);
    }
  });

  it("returns Finding not found for unknown finding ids", async () => {
    const deps = scanDeps();
    const submitted = await submitScan(deps, { token: noneAlgToken() });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    const detail = await getFindingDetail(deps, submitted.value.jobId, "nope");
    expect(detail.ok).toBe(false);
    if (!detail.ok) {
      expect(detail.error).toBe("Finding not found");
    }
  });

  it("hides findings of other organizations", async () => {
    const deps = scanDeps();
    const submitted = await submitScan(deps, { token: noneAlgToken() });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    const results = await import("../service.js").then((m) =>
      m.getScanResults(deps, submitted.value.jobId),
    );
    expect(results.ok).toBe(true);
    if (!results.ok) return;

    const foreign = await getFindingDetail(
      foreignScanDeps(),
      submitted.value.jobId,
      results.value.findings[0]!.id,
    );
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) {
      expect(foreign.error).toBe("Scan not found");
    }
  });
});
