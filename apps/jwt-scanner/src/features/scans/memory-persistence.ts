/**
 * Deterministic in-memory implementation of ScanPersistence.
 *
 * Used by unit/integration tests and by local/test-mode application runs
 * (DATA_MODE=memory). It mirrors the `jwt_scanner` schema contract and
 * enforces the same tenant isolation: every method takes `orgId` and only
 * rows belonging to that organization are visible, exactly like the Drizzle
 * implementation's `withOrg()` predicates.
 *
 * No randomness is required for identity: ids are sequence-based so repeated
 * runs are deterministic. This file never ships in production data paths
 * (DATA_MODE defaults to "postgres").
 */

import type {
  AnalysisJobRow,
  FindingRow,
  ProjectRow,
  ReportRow,
} from "@/db/schema";
import { sanitizeStoredEvidence, type ScanPersistence } from "./persistence.js";
import type { ProductFinding } from "@/domain/types";

interface MemoryRecord {
  projects: Map<string, ProjectRow>;
  jobs: Map<string, AnalysisJobRow>;
  findings: Map<string, FindingRow>;
  reports: Map<string, ReportRow>;
}

function createStore(): MemoryRecord {
  return {
    projects: new Map(),
    jobs: new Map(),
    findings: new Map(),
    reports: new Map(),
  };
}

export function createMemoryScanPersistence(): ScanPersistence {
  const store = createStore();
  let projectSequence = 0;
  let jobSequence = 0;
  let findingSequence = 0;
  let reportSequence = 0;

  function projectId(): string {
    projectSequence += 1;
    return `memory_project_${String(projectSequence).padStart(4, "0")}`;
  }

  function jobId(): string {
    jobSequence += 1;
    return `memory_job_${String(jobSequence).padStart(4, "0")}`;
  }

  function findingId(): string {
    findingSequence += 1;
    return `memory_finding_${String(findingSequence).padStart(4, "0")}`;
  }

  function reportId(): string {
    reportSequence += 1;
    return `memory_report_${String(reportSequence).padStart(4, "0")}`;
  }

  return {
    async ensureProject(orgId, name) {
      for (const project of store.projects.values()) {
        if (project.organizationId === orgId && project.name === name) {
          return project;
        }
      }
      const now = new Date();
      const project: ProjectRow = {
        id: projectId(),
        organizationId: orgId,
        name,
        createdAt: now,
        updatedAt: now,
      };
      store.projects.set(project.id, project);
      return project;
    },

    async createJob(orgId, projectIdValue, startedAt) {
      const job: AnalysisJobRow = {
        id: jobId(),
        organizationId: orgId,
        projectId: projectIdValue,
        status: "running",
        error: null,
        startedAt,
        completedAt: null,
        createdAt: startedAt,
      };
      store.jobs.set(job.id, job);
      return job;
    },

    async completeJob(orgId, jobIdValue, completedAt) {
      const job = store.jobs.get(jobIdValue);
      if (job !== undefined && job.organizationId === orgId) {
        store.jobs.set(jobIdValue, { ...job, status: "completed", completedAt });
      }
    },

    async failJob(orgId, jobIdValue, error, failedAt) {
      const job = store.jobs.get(jobIdValue);
      if (job !== undefined && job.organizationId === orgId) {
        store.jobs.set(jobIdValue, { ...job, status: "failed", error, completedAt: failedAt });
      }
    },

    async insertFindings(orgId, jobIdValue, findings) {
      return findings.map((finding: ProductFinding): FindingRow => {
        const id = findingId();
        const row: FindingRow = {
          id,
          organizationId: orgId,
          jobId: jobIdValue,
          severity: finding.severity,
          category: finding.category,
          title: finding.title,
          description: finding.description,
          evidence: sanitizeStoredEvidence(finding) as unknown as Record<string, unknown>,
          recommendation: finding.recommendation ?? null,
          remediationCode: finding.remediationCode ?? null,
          references: [...(finding.references ?? [])],
          createdAt: new Date(),
        };
        store.findings.set(id, row);
        return row;
      });
    },

    async getJobByOrg(orgId, jobIdValue) {
      const job = store.jobs.get(jobIdValue);
      if (job === undefined || job.organizationId !== orgId) return null;
      const project = store.projects.get(job.projectId);
      if (project === undefined) return null;
      return { job, project };
    },

    async listJobsByOrg(orgId, limit = 20) {
      return [...store.jobs.values()]
        .filter((job) => job.organizationId === orgId)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        .slice(0, limit);
    },

    async getFindingsByJob(orgId, jobIdValue) {
      return [...store.findings.values()].filter(
        (finding) => finding.organizationId === orgId && finding.jobId === jobIdValue,
      );
    },

    async getFindingByOrg(orgId, findingIdValue) {
      const finding = store.findings.get(findingIdValue);
      return finding !== undefined && finding.organizationId === orgId ? finding : null;
    },

    async insertReport(orgId, jobIdValue, format, storageKey) {
      const row: ReportRow = {
        id: reportId(),
        organizationId: orgId,
        jobId: jobIdValue,
        format,
        storageKey,
        createdAt: new Date(),
      };
      store.reports.set(row.id, row);
      return row;
    },
  };
}
