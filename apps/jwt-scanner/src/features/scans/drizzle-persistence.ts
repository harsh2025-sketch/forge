/**
 * Drizzle/PostgreSQL implementation of ScanPersistence (V3 §6.4, §11.2).
 *
 * Every tenant-scoped read and write is scoped by `withOrg(organizationId)`;
 * rows of other organizations are never visible to a query. The product
 * schema is the frozen `jwt_scanner` schema from src/db/schema.ts — no new
 * tables, no ORM, no repository layer.
 */

import { and, desc, eq } from "drizzle-orm";
import { withOrg, type DbClient } from "@forge/db";
import * as schema from "@/db/schema";
import { sanitizeStoredEvidence, type ScanPersistence } from "./persistence.js";

export function createDrizzleScanPersistence(db: DbClient): ScanPersistence {
  return {
    async ensureProject(orgId, name) {
      const existing = await db
        .select()
        .from(schema.projects)
        .where(and(withOrg(schema.projects.organizationId, orgId), eq(schema.projects.name, name)))
        .limit(1);
      if (existing.length > 0) {
        return existing[0]!;
      }
      const [inserted] = await db
        .insert(schema.projects)
        .values({ organizationId: orgId, name })
        .returning();
      return inserted!;
    },

    async createJob(orgId, projectId, startedAt) {
      const [inserted] = await db
        .insert(schema.analysisJobs)
        .values({
          organizationId: orgId,
          projectId,
          status: "running",
          startedAt,
        })
        .returning();
      return inserted!;
    },

    async completeJob(orgId, jobId, completedAt) {
      await db
        .update(schema.analysisJobs)
        .set({ status: "completed", completedAt })
        .where(and(withOrg(schema.analysisJobs.organizationId, orgId), eq(schema.analysisJobs.id, jobId)));
    },

    async failJob(orgId, jobId, error, failedAt) {
      await db
        .update(schema.analysisJobs)
        .set({ status: "failed", error, completedAt: failedAt })
        .where(and(withOrg(schema.analysisJobs.organizationId, orgId), eq(schema.analysisJobs.id, jobId)));
    },

    async insertFindings(orgId, jobId, findings) {
      if (findings.length === 0) return [];
      const rows = findings.map((finding) => ({
        organizationId: orgId,
        jobId,
        severity: finding.severity,
        category: finding.category,
        title: finding.title,
        description: finding.description,
        evidence: sanitizeStoredEvidence(finding) as unknown as Record<string, unknown>,
        recommendation: finding.recommendation ?? null,
        remediationCode: finding.remediationCode ?? null,
        references: [...(finding.references ?? [])],
      }));
      return db.insert(schema.findings).values(rows).returning();
    },

    async getJobByOrg(orgId, jobId) {
      const [job] = await db
        .select()
        .from(schema.analysisJobs)
        .where(and(withOrg(schema.analysisJobs.organizationId, orgId), eq(schema.analysisJobs.id, jobId)))
        .limit(1);
      if (job === undefined) return null;
      const [project] = await db
        .select()
        .from(schema.projects)
        .where(and(withOrg(schema.projects.organizationId, orgId), eq(schema.projects.id, job.projectId)))
        .limit(1);
      if (project === undefined) return null;
      return { job, project };
    },

    async listJobsByOrg(orgId, limit = 20) {
      return db
        .select()
        .from(schema.analysisJobs)
        .where(withOrg(schema.analysisJobs.organizationId, orgId))
        .orderBy(desc(schema.analysisJobs.createdAt))
        .limit(limit);
    },

    async getFindingsByJob(orgId, jobId) {
      return db
        .select()
        .from(schema.findings)
        .where(
          and(
            withOrg(schema.findings.organizationId, orgId),
            eq(schema.findings.jobId, jobId),
          ),
        )
        .orderBy(schema.findings.createdAt);
    },

    async getFindingByOrg(orgId, findingId) {
      const [finding] = await db
        .select()
        .from(schema.findings)
        .where(
          and(
            withOrg(schema.findings.organizationId, orgId),
            eq(schema.findings.id, findingId),
          ),
        )
        .limit(1);
      return finding ?? null;
    },

    async insertReport(orgId, jobId, format, storageKey) {
      const [inserted] = await db
        .insert(schema.reports)
        .values({ organizationId: orgId, jobId, format, storageKey })
        .returning();
      return inserted!;
    },
  };
}
