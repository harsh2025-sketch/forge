import { describe, it, expect } from "vitest";
import {
  Severity,
  isSeverity,
  SEVERITY_VALUES,
  SEVERITY_ORDER,
} from "../primitives/severity.js";
import {
  JobStatus,
  isJobStatus,
  isTerminalStatus,
  JOB_STATUS_VALUES,
} from "../primitives/job-status.js";
import type { BaseFinding } from "../primitives/finding.js";
import { createReportSummary } from "../primitives/report-summary.js";
import type { ReportSummary } from "../primitives/report-summary.js";
import type { Diagnostic } from "../primitives/diagnostic.js";
import type { Metric } from "../primitives/metric.js";
import type { Artifact } from "../primitives/artifact.js";
import type { PolicyDecision } from "../primitives/policy-decision.js";
import type { Recommendation } from "../primitives/recommendation.js";
import type { Remediation } from "../primitives/remediation.js";

describe("Severity", () => {
  it("exports exactly 5 values", () => {
    expect(SEVERITY_VALUES).toHaveLength(5);
    expect(SEVERITY_VALUES).toEqual(
      expect.arrayContaining([
        Severity.CRITICAL,
        Severity.HIGH,
        Severity.MEDIUM,
        Severity.LOW,
        Severity.INFO,
      ])
    );
  });

  it("isSeverity true for valid values, false for invalid", () => {
    for (const v of SEVERITY_VALUES) {
      expect(isSeverity(v)).toBe(true);
    }
    expect(isSeverity("CRITICAL")).toBe(false); // case-sensitive, values are lower-case
    expect(isSeverity("critical ")).toBe(false);
    expect(isSeverity("")).toBe(false);
    expect(isSeverity(null)).toBe(false);
    expect(isSeverity(undefined)).toBe(false);
    expect(isSeverity(123)).toBe(false);
    expect(isSeverity({})).toBe(false);
  });

  it("SEVERITY_ORDER is critical -> info", () => {
    expect(SEVERITY_ORDER[0]).toBe(Severity.CRITICAL);
    expect(SEVERITY_ORDER[SEVERITY_ORDER.length - 1]).toBe(Severity.INFO);
  });

  it("values are provider-neutral (no vendor names)", () => {
    const joined = SEVERITY_VALUES.join(" ");
    expect(joined).not.toMatch(/clerk|stripe|supabase|resend|vercel|aws|posthog|openai/i);
  });
});

describe("JobStatus", () => {
  it("exports 5 values", () => {
    expect(JOB_STATUS_VALUES).toHaveLength(5);
    expect(JOB_STATUS_VALUES).toEqual(
      expect.arrayContaining([
        JobStatus.PENDING,
        JobStatus.RUNNING,
        JobStatus.COMPLETED,
        JobStatus.FAILED,
        JobStatus.CANCELLED,
      ])
    );
  });

  it("isJobStatus exact case-sensitive", () => {
    for (const v of JOB_STATUS_VALUES) {
      expect(isJobStatus(v)).toBe(true);
    }
    expect(isJobStatus("PENDING")).toBe(false);
    expect(isJobStatus("pending ")).toBe(false);
    expect(isJobStatus("")).toBe(false);
    expect(isJobStatus(null)).toBe(false);
  });

  it("isTerminalStatus true only for completed/failed/cancelled", () => {
    expect(isTerminalStatus(JobStatus.COMPLETED)).toBe(true);
    expect(isTerminalStatus(JobStatus.FAILED)).toBe(true);
    expect(isTerminalStatus(JobStatus.CANCELLED)).toBe(true);
    expect(isTerminalStatus(JobStatus.PENDING)).toBe(false);
    expect(isTerminalStatus(JobStatus.RUNNING)).toBe(false);
  });
});

describe("BaseFinding", () => {
  it("constructs with required fields only", () => {
    const f: BaseFinding = {
      id: "finding-1",
      severity: Severity.HIGH,
      category: "none_alg",
      title: "None algorithm used",
      description: "JWT uses alg none",
      evidence: { alg: "none", token: "header.payload." },
    };
    expect(f.severity).toBe(Severity.HIGH);
    expect(f.evidence).toEqual({ alg: "none", token: "header.payload." });
    expect(f.recommendation).toBeUndefined();
  });

  it("allows optional fields", () => {
    const f: BaseFinding = {
      id: "2",
      severity: Severity.CRITICAL,
      category: "alg_confusion",
      title: "Algorithm confusion",
      description: "HS256 vs RS256 confusion",
      evidence: "raw evidence string",
      recommendation: "Use RS256 with proper key",
      remediationCode: "patch code",
      references: ["https://example.com"],
    };
    expect(f.recommendation).toBe("Use RS256 with proper key");
    expect(f.references).toHaveLength(1);
  });

  it("evidence can be any unknown (product-specific per V3 §9.4)", () => {
    const evidences: unknown[] = [
      "string",
      123,
      { jwtHeader: { alg: "HS256" } },
      null,
      ["array"],
    ];
    for (const ev of evidences) {
      const f: BaseFinding = {
        id: "x",
        severity: Severity.LOW,
        category: "custom",
        title: "t",
        description: "d",
        evidence: ev,
      };
      expect(f.evidence).toBe(ev);
    }
  });
});

describe("ReportSummary + createReportSummary", () => {
  it("computes totalFindings and bySeverity", () => {
    const findings: BaseFinding[] = [
      { id: "1", severity: Severity.CRITICAL, category: "c", title: "t", description: "d", evidence: null },
      { id: "2", severity: Severity.CRITICAL, category: "c", title: "t", description: "d", evidence: null },
      { id: "3", severity: Severity.LOW, category: "c", title: "t", description: "d", evidence: null },
    ];
    const summary = createReportSummary(findings);
    expect(summary.totalFindings).toBe(3);
    expect(summary.findingsBySeverity[Severity.CRITICAL]).toBe(2);
    expect(summary.findingsBySeverity[Severity.LOW]).toBe(1);
    expect(summary.findingsBySeverity[Severity.HIGH]).toBe(0);
    expect(summary.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it("handles empty findings (zero is valid per V3 analyzer)", () => {
    const summary = createReportSummary([]);
    expect(summary.totalFindings).toBe(0);
    for (const s of SEVERITY_VALUES) {
      expect(summary.findingsBySeverity[s]).toBe(0);
    }
  });

  it("passes score/metadata through", () => {
    const summary = createReportSummary([], { score: 95, metadata: { engine: "v1" } });
    expect(summary.score).toBe(95);
    expect(summary.metadata).toEqual({ engine: "v1" });
  });

  it("ReportSummary type accepts manual construction", () => {
    const s: ReportSummary = {
      totalFindings: 1,
      findingsBySeverity: {
        critical: 1,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      },
      generatedAt: new Date().toISOString(),
    };
    expect(s.totalFindings).toBe(1);
  });
});

describe("Diagnostic", () => {
  it("constructs valid diagnostic", () => {
    const d: Diagnostic = { level: "warning", message: "parse warning", code: "WARN001", context: { line: 1 } };
    expect(d.level).toBe("warning");
    expect(d.context).toEqual({ line: 1 });
  });

  it("accepts all three levels", () => {
    const levels: Diagnostic["level"][] = ["info", "warning", "error"];
    for (const l of levels) {
      const d: Diagnostic = { level: l, message: "m" };
      expect(d.level).toBe(l);
    }
  });
});

describe("Metric", () => {
  it("constructs with required fields", () => {
    const m: Metric = { name: "query_time", value: 123, unit: "ms" };
    expect(m.name).toBe("query_time");
    expect(m.value).toBe(123);
  });

  it("allows optional baseline/target/timestamp", () => {
    const m: Metric = { name: "bloat", value: 42, unit: "mb", baseline: 100, target: 10, timestamp: "2024-01-01" };
    expect(m.baseline).toBe(100);
  });
});

describe("Artifact", () => {
  it("constructs minimal artifact (storage-agnostic key)", () => {
    const a: Artifact = { key: "reports/123.json", contentType: "application/json" };
    expect(a.key).toBe("reports/123.json");
    expect(a.contentType).toBe("application/json");
  });

  it("allows size/metadata", () => {
    const a: Artifact = { key: "k", contentType: "text/html", size: 1024, metadata: { product: "jwt-scanner" } };
    expect(a.size).toBe(1024);
  });

  it("key is provider-neutral (no supabase bucket prefix required)", () => {
    const a: Artifact = { key: "my_artifact", contentType: "text/plain" };
    expect(a.key).not.toMatch(/supabase|stripe|clerk/i);
  });
});

describe("PolicyDecision", () => {
  it("allow decision", () => {
    const pd: PolicyDecision = { action: "allow", reason: "ok", latencyMs: 5 };
    expect(pd.action).toBe("allow");
    expect(pd.transformed).toBeUndefined();
  });

  it("block decision", () => {
    const pd: PolicyDecision = { action: "block", reason: "violates policy" };
    expect(pd.action).toBe("block");
  });

  it("transform decision carries transformed", () => {
    const pd: PolicyDecision<{ sanitized: string }> = {
      action: "transform",
      transformed: { sanitized: "safe" },
      reason: "sanitized",
    };
    expect(pd.transformed).toEqual({ sanitized: "safe" });
  });

  it("rate-limit action", () => {
    const pd: PolicyDecision = { action: "rate-limit", reason: "too many requests" };
    expect(pd.action).toBe("rate-limit");
  });
});

describe("Recommendation", () => {
  it("standalone typed object (Optimizer) per V3 Change 7", () => {
    const r: Recommendation = { description: "Add index", effort: "low", priority: 1, automated: false };
    expect(r.description).toBe("Add index");
    expect(r.effort).toBe("low");
  });

  it("allows code for automated remediation hint", () => {
    const r: Recommendation = { description: "Fix", code: "CREATE INDEX", effort: "medium", automated: true };
    expect(r.code).toBe("CREATE INDEX");
  });
});

describe("Remediation", () => {
  it("requires automated boolean per V3 §9.3", () => {
    const rem: Remediation = { description: "Apply migration", code: "SQL", effort: "high", automated: true };
    expect(rem.automated).toBe(true);
  });

  it("allows non-automated (manual) remediation", () => {
    const rem: Remediation = { description: "Manual review", automated: false };
    expect(rem.automated).toBe(false);
    expect(rem.code).toBeUndefined();
  });
});

describe("provider neutrality — no provider names in primitives", () => {
  it("no artifact/policy/metric contains vendor name", () => {
    const artifact: Artifact = { key: "a", contentType: "c" };
    const metric: Metric = { name: "n", value: 1, unit: "u" };
    const decision: PolicyDecision = { action: "allow" };
    const json = JSON.stringify({ artifact, metric, decision });
    expect(json).not.toMatch(/clerk|stripe|supabase|resend|vercel|aws|posthog|openai|bullmq|pg-boss/i);
  });
});
