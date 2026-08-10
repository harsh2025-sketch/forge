import { describe, it, expect } from "vitest";
import { ok, err, isOk, isErr } from "@forge/shared";
import type { AnalyzerEngine } from "../archetypes/analyzer.js";
import type { OptimizerEngine } from "../archetypes/optimizer.js";
import type { GeneratorEngine } from "../archetypes/generator.js";
import type { TransformerEngine } from "../archetypes/transformer.js";
import type { MiddlewareEngine } from "../archetypes/middleware.js";
import type { GatewayEngine } from "../archetypes/gateway.js";
import { Severity } from "../primitives/severity.js";
import type { BaseFinding } from "../primitives/finding.js";
import { JobStatus } from "../primitives/job-status.js";

describe("AnalyzerEngine contract", () => {
  const dummyEngine: AnalyzerEngine<{ projectId: string }, { depth: number }> = {
    async execute(input, _config, onProgress) {
      void _config;
      onProgress(0);
      if (!input.projectId) return err("Missing projectId");
      onProgress(50);
      const finding: BaseFinding = {
        id: "f1",
        severity: Severity.HIGH,
        category: "test",
        title: "Test Finding",
        description: "desc",
        evidence: { input },
      };
      onProgress(100);
      return ok({
        findings: [finding],
        summary: {
          totalFindings: 1,
          findingsBySeverity: {
            critical: 0,
            high: 1,
            medium: 0,
            low: 0,
            info: 0,
          },
          generatedAt: new Date().toISOString(),
          metadata: {},
        },
        metadata: { engine: "test-analyzer-v1" },
      });
    },
  };

  it("engine satisfies contract, returns Result ok with findings", async () => {
    const progress: number[] = [];
    const result = await dummyEngine.execute({ projectId: "p1" }, { depth: 1 }, (p) => progress.push(p));
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.findings).toHaveLength(1);
      expect(result.value.findings[0].id).toBe("f1");
      expect(result.value.summary.totalFindings).toBe(1);
      expect(progress).toEqual([0, 50, 100]);
    }
  });

  it("returns Result err on invalid input without throwing", async () => {
    const result = await dummyEngine.execute({ projectId: "" }, { depth: 1 }, () => {});
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toBe("Missing projectId");
    }
  });

  it("handles empty findings (zero findings valid)", async () => {
    const emptyEngine: AnalyzerEngine = {
      async execute() {
        return ok({
          findings: [],
          summary: {
            totalFindings: 0,
            findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
            generatedAt: new Date().toISOString(),
          },
          metadata: {},
        });
      },
    };
    const result = await emptyEngine.execute({}, {}, () => {});
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.findings).toHaveLength(0);
  });

  it("engine never imports infrastructure (type-only test — provider-neutral)", async () => {
    // Runtime: ensure result shape is provider-neutral
    const result = await dummyEngine.execute({ projectId: "p1" }, { depth: 1 }, () => {});
    if (isOk(result)) {
      const json = JSON.stringify(result.value);
      expect(json).not.toMatch(/clerk|stripe|supabase|resend/i);
    }
  });
});

describe("OptimizerEngine contract", () => {
  const engine: OptimizerEngine = {
    async execute(_input, _config, onProgress) {
      void _input;
      void _config;
      onProgress(10);
      return ok({
        metrics: [{ name: "query_time", value: 100, unit: "ms" }],
        recommendations: [{ description: "Add index", effort: "low", priority: 1 }],
        estimatedSavings: { time: "30 seconds per query", cost: "$500/month" },
        remediations: [{ description: "CREATE INDEX", code: "CREATE INDEX idx", effort: "low", automated: false }],
        summary: {
          totalFindings: 1,
          findingsBySeverity: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
          generatedAt: new Date().toISOString(),
        },
      });
    },
  };

  it("returns metrics, recommendations, estimatedSavings", async () => {
    const result = await engine.execute({}, {}, () => {});
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.metrics[0].name).toBe("query_time");
      expect(result.value.recommendations[0].description).toBe("Add index");
      expect(result.value.estimatedSavings.time).toContain("seconds");
    }
  });
});

describe("GeneratorEngine contract", () => {
  const engine: GeneratorEngine<{ spec: string }> = {
    async generate(input) {
      if (!input.spec) return err("Missing spec");
      return ok({
        artifact: { key: "artifacts/spec.json", contentType: "application/json", size: 123 },
        diagnostics: [{ level: "info", message: "generated" }],
        metadata: { generator: "v1" },
      });
    },
  };

  it("generate returns artifact + diagnostics", async () => {
    const result = await engine.generate({ spec: "x" }, {});
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.artifact.key).toBe("artifacts/spec.json");
  });

  it("returns err on invalid input", async () => {
    const result = await engine.generate({ spec: "" }, {});
    expect(isErr(result)).toBe(true);
  });
});

describe("TransformerEngine contract", () => {
  const engine: TransformerEngine<string, unknown, string> = {
    async transform(input) {
      return ok({
        output: `transformed:${String(input)}`,
        warnings: [],
        diagnostics: [],
        metadata: {},
      });
    },
  };

  it("transforms synchronously, no onProgress", async () => {
    const result = await engine.transform("hello", {});
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.output).toBe("transformed:hello");
  });
});

describe("MiddlewareEngine contract", () => {
  const engine: MiddlewareEngine<{ token: string }, { policy: string }> = {
    async evaluate(request, _context) {
      void _context;
      if (request.token === "bad") {
        return ok({ action: "block", reason: "injection detected", latencyMs: 2 });
      }
      return ok({ action: "allow", reason: "ok", latencyMs: 1 });
    },
  };

  it("evaluate returns allow/block", async () => {
    const allow = await engine.evaluate({ token: "good" }, { policy: "strict" });
    expect(isOk(allow) && allow.value.action === "allow").toBe(true);
    const block = await engine.evaluate({ token: "bad" }, { policy: "strict" });
    expect(isOk(block) && block.value.action === "block").toBe(true);
  });

  it("transform action carries transformed", async () => {
    const transformingEngine: MiddlewareEngine = {
      async evaluate() {
        return ok({ action: "transform", transformed: { sanitized: "x" }, reason: "sanitized" });
      },
    };
    const result = await transformingEngine.evaluate({}, {});
    if (isOk(result)) expect(result.value.transformed).toEqual({ sanitized: "x" });
  });
});

describe("GatewayEngine contract", () => {
  const engine: GatewayEngine = {
    async process(request) {
      return ok({
        forwardedRequest: request,
        diagnostics: [{ level: "info", message: "routed" }],
        metadata: { routed: true },
      });
    },
  };

  it("process returns forwardedRequest", async () => {
    const result = await engine.process({ path: "/api" }, { routes: [] });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.forwardedRequest).toEqual({ path: "/api" });
  });
});

describe("JobStatus usage in archetypes", () => {
  it("engine metadata can carry JobStatus-like values provider-neutrally", async () => {
    const statuses = [JobStatus.PENDING, JobStatus.RUNNING, JobStatus.COMPLETED];
    for (const s of statuses) {
      expect(typeof s).toBe("string");
      expect(s).not.toMatch(/pg-boss|bullmq|redis/i);
    }
  });
});
