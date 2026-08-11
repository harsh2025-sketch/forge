/**
 * JWT Scanner product schema — V3 §6.4, §8.2 (Analyzer persistence).
 *
 * All product tables live in the product-scoped named schema `jwt_scanner`
 * (V3 §6.2, P20 data separability). Tenant-scoped tables carry a non-null
 * `organization_id` foreign key to `platform.organizations` and every query
 * on them must use the `withOrg()` helper (V3 §6.4, §11.2).
 *
 * Extraction chain (V3 §6.6):
 *   platform.products.id
 *     → platform.organizations (subscription/direct FK)
 *     → jwt_scanner.projects.organization_id
 *     → jwt_scanner.analysis_jobs.project_id
 *     → jwt_scanner.findings.job_id
 *     → jwt_scanner.reports.job_id
 *
 * Shared vocabulary comes from the frozen contracts, never duplicated:
 *   - severity:    @forge/domain Severity (SEVERITY_VALUES)
 *   - job status:  @forge/domain JobStatus (JOB_STATUS_VALUES)
 *   - category:    the product's own domain taxonomy (JWT_FINDING_CATEGORIES,
 *                  frozen in V3 §20.2 Day 11)
 */

import {
  jsonb,
  pgEnum,
  pgSchema,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  JOB_STATUS_VALUES,
  SEVERITY_VALUES,
  type JobStatus,
  type Severity,
} from "@forge/domain";
import { organizations } from "@forge/db";
import { JWT_FINDING_CATEGORIES } from "../domain/types.js";

/** Named PostgreSQL schema owning all JWT Scanner data (V3 §6.2). */
export const jwtScanner = pgSchema("jwt_scanner");

// ---------------------------------------------------------------------------
// Enums (values from the frozen shared contracts)
// ---------------------------------------------------------------------------

export const severityEnum = pgEnum("severity", [
  ...SEVERITY_VALUES,
] as [Severity, ...Severity[]]);
export const findingCategoryEnum = pgEnum(
  "finding_category",
  [...JWT_FINDING_CATEGORIES],
);
export const jobStatusEnum = pgEnum("job_status", [
  ...JOB_STATUS_VALUES,
] as [JobStatus, ...JobStatus[]]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/**
 * jwt_scanner.projects — a scanning target owned by an organization.
 * Tenant-scoped: every row belongs to exactly one organization.
 */
export const projects = jwtScanner.table("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * jwt_scanner.analysis_jobs — one scan run per project (synchronous at the
 * initial milestone; the analyzer persistence model per V3 §8.2).
 * Never stores the scanned token or other credential material (§11.3).
 */
export const analysisJobs = jwtScanner.table("analysis_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  status: jobStatusEnum("status").notNull().default("pending"),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * jwt_scanner.findings — analysis output rows. Evidence is product-specific
 * (decoded JWT header/payload); the column shape is defined at implementation
 * time (V3 §9.4 keeps evidence structure product-specific).
 */
export const findings = jwtScanner.table("findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => analysisJobs.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  severity: severityEnum("severity").notNull(),
  category: findingCategoryEnum("category").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description").notNull(),
  evidence: jsonb("evidence").notNull().default({}),
  recommendation: text("recommendation"),
  remediationCode: text("remediation_code"),
  references: jsonb("references").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * jwt_scanner.reports — exported report documents per job (reporting
 * capability, V3 §8.2). storage_key references the object-store location.
 */
export const reports = jwtScanner.table("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => analysisJobs.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  format: varchar("format", { length: 20 }).notNull(),
  storageKey: varchar("storage_key", { length: 500 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export type ProjectRow = typeof projects.$inferSelect;
export type NewProjectRow = typeof projects.$inferInsert;
export type AnalysisJobRow = typeof analysisJobs.$inferSelect;
export type NewAnalysisJobRow = typeof analysisJobs.$inferInsert;
export type FindingRow = typeof findings.$inferSelect;
export type NewFindingRow = typeof findings.$inferInsert;
export type ReportRow = typeof reports.$inferSelect;
export type NewReportRow = typeof reports.$inferInsert;
