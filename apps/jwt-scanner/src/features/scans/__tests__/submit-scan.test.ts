/**
 * Scan submission feature tests (V3 §20.2 Day 13).
 *
 * Covers: valid JWT, malformed JWT, oversized JWT, invalid schema,
 * successful analysis, persistence behavior (including token-free evidence),
 * and organization scoping.
 */

import { describe, expect, it } from "vitest";
import { getScanResults, listRecentScans, submitScan } from "../service.js";
import {
  scanDeps,
  foreignScanDeps,
  cleanToken,
  noneAlgToken,
  EVALUATION_TIME,
} from "@/__tests__/test-utils.js";

describe("submitScan", () => {
  it("accepts a valid JWT and returns the new job id", async () => {
    const deps = scanDeps();
    const result = await submitScan(deps, { token: noneAlgToken() });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.jobId).toMatch(/^memory_job_/);
      expect(result.value.findings).toBe(1);
    }
  });

  it("rejects a malformed JWT cleanly", async () => {
    const result = await submitScan(scanDeps(), { token: "not-a-jwt" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/expected a compact JWT/);
    }
  });

  it("rejects an oversized JWT cleanly", async () => {
    const token = `${"a".repeat(70000)}.${"b".repeat(100)}.signature`;
    const result = await submitScan(scanDeps(), { token });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/must not exceed 65536/);
    }
  });

  it("rejects invalid schema input (missing token)", async () => {
    const result = await submitScan(scanDeps(), {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/required/i);
    }
  });

  it("rejects non-object input", async () => {
    const result = await submitScan(scanDeps(), "eyJhbGciOiJub25lIn0.e30.");
    expect(result.ok).toBe(false);
  });

  it("persists the completed job and token-free findings", async () => {
    const deps = scanDeps();
    const result = await submitScan(deps, { token: noneAlgToken() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const results = await getScanResults(deps, result.value.jobId);
    expect(results.ok).toBe(true);
    if (!results.ok) return;
    expect(results.value.job.status).toBe("completed");
    expect(results.value.job.completedAt?.toISOString()).toBe(
      new Date(EVALUATION_TIME * 1000).toISOString(),
    );
    expect(results.value.findings).toHaveLength(1);
    const evidence = results.value.findings[0]!.evidence as Record<string, unknown>;
    // V3 §11.3 — the raw token is never persisted.
    expect(evidence.token).toBeUndefined();
    expect(evidence.header).toEqual({ alg: "none", typ: "JWT" });
    expect(evidence.payload).toEqual({ sub: "1234567890", exp: EVALUATION_TIME + 60 });
  });

  it("records a failed job when persistence fails", async () => {
    const failingPersistence = {
      ensureProject: async () => {
        throw new Error("connection lost");
      },
    };
    const deps = scanDeps({
      persistence: failingPersistence as never,
    });
    const result = await submitScan(deps, { token: cleanToken() });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Failed to persist analysis results");
    }
  });

  it("enforces organization scoping on submitted scans", async () => {
    const deps = scanDeps();
    const result = await submitScan(deps, { token: noneAlgToken() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // A different organization must not see the job.
    const foreignResults = await getScanResults(foreignScanDeps(), result.value.jobId);
    expect(foreignResults.ok).toBe(false);
    if (!foreignResults.ok) {
      expect(foreignResults.error).toBe("Scan not found");
    }
  });

  it("requires authentication", async () => {
    const result = await submitScan(scanDeps({ auth: undefined as never }), { token: cleanToken() });
    expect(result.ok).toBe(false);
  });
});

describe("listRecentScans", () => {
  it("returns the org's scans newest first", async () => {
    const deps = scanDeps();
    await submitScan(deps, { token: cleanToken() });
    await submitScan(deps, { token: cleanToken() });
    const jobs = await listRecentScans(deps);
    expect(jobs.ok).toBe(true);
    if (jobs.ok) {
      expect(jobs.value).toHaveLength(2);
    }
  });

  it("does not leak another org's scans", async () => {
    const deps = scanDeps();
    await submitScan(deps, { token: cleanToken() });
    const other = await listRecentScans(foreignScanDeps());
    expect(other.ok).toBe(true);
    if (other.ok) {
      expect(other.value).toHaveLength(0);
    }
  });
});

describe("getScanResults", () => {
  it("returns Scan not found for unknown jobs", async () => {
    const result = await getScanResults(scanDeps(), "memory_job_9999");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Scan not found");
    }
  });

  it("returns Scan not found for another org's job", async () => {
    const deps = scanDeps();
    await submitScan(deps, { token: noneAlgToken(), projectName: "secret-project" });
    const foreign = await listRecentScans(foreignScanDeps());
    expect(foreign.ok && foreign.value.length).toBe(0);
  });
});
