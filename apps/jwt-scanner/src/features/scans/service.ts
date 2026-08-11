/**
 * JWT Scanner scan feature service (V3 §8.2, §20.2 Day 13).
 *
 * The service layer is where the product features actually live: scan
 * submission, results loading, finding detail, and report export. It composes
 * the frozen pieces:
 *
 *   AuthPort (from providers)  +  ProductEngine (domain)  +  ScanPersistence
 *   +  @forge/reporting (report template + generators)
 *
 * The engine runs synchronously (JWT analysis is fast — no asynchronous job
 * infrastructure is introduced; the analysis_jobs table is used in its
 * synchronous form per V3 §8.2 "synchronous at the initial milestone").
 *
 * Every function takes explicit dependencies so tests can inject the
 * @forge/testing mocks and the in-memory persistence; server actions wire the
 * real composition root (src/providers.ts).
 */

import type { AnalyzerEngine, AnalyzerResult, Severity } from "@forge/domain";
import type { AuthPort } from "@forge/auth";
import type { Result } from "@forge/shared";
import { z } from "zod";
import { ENGINE_NAME, ENGINE_VERSION } from "@/domain/engine";
import { jwtInputSchema, jwtScanConfigSchema } from "@/domain/schemas";
import type { JwtInput, JwtScanConfig } from "@/domain/schemas";
import type { ProductFinding } from "@/domain/types";
import { getOrgUserContext } from "@/features/auth/session";
import type { OrgUserContext } from "@/features/auth/session";
import { platformOrganizationId } from "@/features/auth/identity";
import type { ScanPersistence } from "./persistence.js";
import { isExportFormat, renderScanReport, type ExportResult } from "./report.js";
import type { AnalysisJobRow, FindingRow, ProjectRow } from "@/db/schema";

/** Maximum length of a scan project name. */
export const MAX_PROJECT_NAME_LENGTH = 200;

/** Input accepted by the scan submission feature (token + optional project name). */
export const scanSubmissionSchema = jwtInputSchema.extend({
  projectName: z
    .string()
    .trim()
    .min(1, "projectName must not be empty")
    .max(MAX_PROJECT_NAME_LENGTH, `projectName must not exceed ${MAX_PROJECT_NAME_LENGTH} characters`)
    .optional(),
});

export type ScanSubmission = JwtInput & { readonly projectName?: string };

export interface ScanDeps {
  readonly auth: AuthPort;
  readonly persistence: ScanPersistence;
  readonly engine: AnalyzerEngine<JwtInput, JwtScanConfig, ProductFinding>;
  /**
   * Explicit evaluation time (JWT NumericDate, seconds). Defaults to the
   * current wall clock at submission — the engine itself never reads a clock.
   */
  readonly evaluationTime?: number;
  /** Whether to persist findings (default true; tests may disable). */
  readonly persist?: boolean;
}

export interface ScanSummary {
  readonly totalFindings: number;
  readonly findingsBySeverity: Record<Severity, number>;
}

export interface ScanResults {
  readonly job: AnalysisJobRow;
  readonly project: ProjectRow;
  readonly findings: readonly FindingRow[];
  readonly summary: ScanSummary;
}

export interface FindingDetail {
  readonly finding: FindingRow;
  readonly job: AnalysisJobRow;
  readonly project: ProjectRow;
}

/** Builds the scan summary counts from persisted findings. */
export function summarizeFindings(
  findings: readonly Pick<FindingRow, "severity">[],
): ScanSummary {
  const findingsBySeverity: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const finding of findings) {
    findingsBySeverity[finding.severity as Severity] += 1;
  }
  return { totalFindings: findings.length, findingsBySeverity };
}

async function requireContext(deps: ScanDeps): Promise<Result<OrgUserContext, string>> {
  return getOrgUserContext(deps.auth);
}

/**
 * Submits a JWT for analysis:
 *   validate → authorize → run engine → persist job + findings → result.
 * Never persists the raw token (see persistence.ts).
 */
export async function submitScan(
  deps: ScanDeps,
  raw: unknown,
): Promise<Result<{ jobId: string; findings: number }, string>> {
  const parsed = scanSubmissionSchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid scan input";
    return { ok: false, error: message };
  }
  const input = parsed.data;
  if (input.projectName !== undefined && input.projectName.length > MAX_PROJECT_NAME_LENGTH) {
    return {
      ok: false,
      error: `projectName must not exceed ${MAX_PROJECT_NAME_LENGTH} characters`,
    };
  }

  const context = await requireContext(deps);
  if (!context.ok) return context;

  const evaluationTime = deps.evaluationTime ?? Math.floor(Date.now() / 1000);
  const configResult = jwtScanConfigSchema.safeParse({ evaluationTime });
  if (!configResult.success) {
    return { ok: false, error: "Invalid scan configuration" };
  }
  const config: JwtScanConfig = configResult.data;

  // The engine's contract accepts the strict token input only; the feature
  // layer's projectName never reaches domain code.
  const result = await deps.engine.execute({ token: input.token }, config, () => undefined);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  const analysis: AnalyzerResult<ProductFinding> = result.value;

  const dbOrgId = platformOrganizationId(context.value.org.id);
  const now = new Date(evaluationTime * 1000);
  let job;
  try {
    const project = await deps.persistence.ensureProject(
      dbOrgId,
      input.projectName ?? "Default project",
    );
    job = await deps.persistence.createJob(dbOrgId, project.id, now);
    if (deps.persist !== false) {
      await deps.persistence.insertFindings(
        dbOrgId,
        job.id,
        analysis.findings,
      );
    }
    await deps.persistence.completeJob(dbOrgId, job.id, now);
  } catch {
    if (job !== undefined) {
      // Best-effort failure marking; the original error is the result.
      await deps.persistence
        .failJob(
          dbOrgId,
          job.id,
          "Failed to persist analysis results",
          now,
        )
        .catch(() => undefined);
    }
    return { ok: false, error: "Failed to persist analysis results" };
  }

  return { ok: true, value: { jobId: job!.id, findings: analysis.findings.length } };
}

/** Loads the org-scoped results of one scan job. */
export async function getScanResults(
  deps: ScanDeps,
  jobId: string,
): Promise<Result<ScanResults, string>> {
  const context = await requireContext(deps);
  if (!context.ok) return context;

  const dbOrgId = platformOrganizationId(context.value.org.id);
  const loaded = await deps.persistence.getJobByOrg(dbOrgId, jobId);
  if (loaded === null) {
    return { ok: false, error: "Scan not found" };
  }
  const findings = await deps.persistence.getFindingsByJob(dbOrgId, jobId);
  return {
    ok: true,
    value: {
      job: loaded.job,
      project: loaded.project,
      findings,
      summary: summarizeFindings(findings),
    },
  };
}

/** Loads one org-scoped finding with its job and project context. */
export async function getFindingDetail(
  deps: ScanDeps,
  jobId: string,
  findingId: string,
): Promise<Result<FindingDetail, string>> {
  const context = await requireContext(deps);
  if (!context.ok) return context;

  const dbOrgId = platformOrganizationId(context.value.org.id);
  const loaded = await deps.persistence.getJobByOrg(dbOrgId, jobId);
  if (loaded === null) {
    return { ok: false, error: "Scan not found" };
  }
  const finding = await deps.persistence.getFindingByOrg(
    dbOrgId,
    findingId,
  );
  if (finding === null || finding.jobId !== jobId) {
    return { ok: false, error: "Finding not found" };
  }
  return { ok: true, value: { finding, job: loaded.job, project: loaded.project } };
}

/** Lists the org's recent scans (newest first). */
export async function listRecentScans(
  deps: ScanDeps,
  limit = 20,
): Promise<Result<readonly AnalysisJobRow[], string>> {
  const context = await requireContext(deps);
  if (!context.ok) return context;
  const jobs = await deps.persistence.listJobsByOrg(
    platformOrganizationId(context.value.org.id),
    limit,
  );
  return { ok: true, value: jobs };
}

/**
 * Exports a scan report through @forge/reporting and records the export in
 * the reports table (org-scoped). Returns the rendered content plus the
 * filename for the HTTP boundary.
 */
export async function exportScanReport(
  deps: ScanDeps,
  jobId: string,
  rawFormat: unknown,
): Promise<Result<ExportResult, string>> {
  if (!isExportFormat(rawFormat)) {
    return { ok: false, error: "Unsupported report format" };
  }
  const context = await requireContext(deps);
  if (!context.ok) return context;
  const dbOrgId = platformOrganizationId(context.value.org.id);

  const loaded = await deps.persistence.getJobByOrg(dbOrgId, jobId);
  if (loaded === null) {
    return { ok: false, error: "Scan not found" };
  }
  const findings = await deps.persistence.getFindingsByJob(dbOrgId, jobId);
  const rendered = renderScanReport(
    {
      job: loaded.job,
      project: loaded.project,
      findings,
      organizationName: context.value.org.name,
      engine: ENGINE_NAME,
      engineVersion: ENGINE_VERSION,
    },
    rawFormat,
  );
  await deps.persistence.insertReport(
    dbOrgId,
    jobId,
    rendered.format,
    `${jobId}/${rendered.format}`,
  );
  return { ok: true, value: rendered };
}
