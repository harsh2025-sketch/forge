/**
 * Scan persistence seam for JWT Scanner (V3 §6.4, §8.2, P20).
 *
 * The product's analyzer persistence model (projects → analysis_jobs →
 * findings → reports) lives in the product-scoped `jwt_scanner` schema.
 * This module defines the narrow, product-local persistence contract the scan
 * feature needs. Two implementations exist:
 *
 *   - drizzle-persistence.ts — the production implementation over Drizzle +
 *     PostgreSQL. Every tenant-scoped query uses the `withOrg()` helper from
 *     @forge/db (V3 §11.2).
 *   - memory-persistence.ts — a deterministic in-memory implementation used
 *     by unit/integration tests and by local/test-mode runs
 *     (DATA_MODE=memory), so the test suite never requires a database.
 *
 * This is NOT a repository abstraction or a second ORM: it is a structural
 * seam over the existing Drizzle query surface, and it is product-local
 * (never shared with other products).
 *
 * Security (V3 §11.3): the scanned token itself is never persisted. Findings
 * store decoded header/payload material only — `sanitizeStoredEvidence`
 * strips the raw compact token before anything reaches the database.
 */

import type {
  AnalysisJobRow,
  FindingRow,
  ProjectRow,
  ReportRow,
} from "@/db/schema";
import type { ProductFinding } from "@/domain/types";

/** Stored evidence: decoded JWT material, never the raw token (V3 §11.3). */
export interface StoredFindingEvidence {
  readonly header: Record<string, unknown>;
  readonly payload: Record<string, unknown>;
  readonly signaturePresent: boolean;
  readonly decoded: boolean;
}

/** Strips the raw token from domain evidence before persistence. */
export function sanitizeStoredEvidence(
  finding: ProductFinding,
): StoredFindingEvidence {
  const evidence = finding.evidence;
  return {
    header: { ...(evidence.header as Record<string, unknown>) },
    payload: { ...(evidence.payload as Record<string, unknown>) },
    signaturePresent: evidence.signaturePresent,
    decoded: evidence.decoded,
  };
}

/** A job together with its persisted findings (the results view's data). */
export interface JobWithFindings {
  readonly job: AnalysisJobRow;
  readonly project: ProjectRow;
  readonly findings: readonly FindingRow[];
}

export interface ScanPersistence {
  /** Returns the org's project with the given name, creating it when absent. */
  ensureProject(orgId: string, name: string): Promise<ProjectRow>;

  /** Creates an analysis job in `running` state. */
  createJob(orgId: string, projectId: string, startedAt: Date): Promise<AnalysisJobRow>;

  /** Marks a job completed with the given completion time. */
  completeJob(orgId: string, jobId: string, completedAt: Date): Promise<void>;

  /** Marks a job failed with an error message. */
  failJob(orgId: string, jobId: string, error: string, failedAt: Date): Promise<void>;

  /** Persists findings for a job (token-free evidence). */
  insertFindings(
    orgId: string,
    jobId: string,
    findings: readonly ProductFinding[],
  ): Promise<readonly FindingRow[]>;

  /** Returns the org's job and its project, or null when not found / other org. */
  getJobByOrg(orgId: string, jobId: string): Promise<{ job: AnalysisJobRow; project: ProjectRow } | null>;

  /** Returns the org's most recent jobs, newest first. */
  listJobsByOrg(orgId: string, limit?: number): Promise<readonly AnalysisJobRow[]>;

  /** Returns the findings of the org's job, in insertion order. */
  getFindingsByJob(orgId: string, jobId: string): Promise<readonly FindingRow[]>;

  /** Returns one org-scoped finding, or null when not found / other org. */
  getFindingByOrg(orgId: string, findingId: string): Promise<FindingRow | null>;

  /** Records a report export row for a job. */
  insertReport(
    orgId: string,
    jobId: string,
    format: string,
    storageKey: string,
  ): Promise<ReportRow>;
}
