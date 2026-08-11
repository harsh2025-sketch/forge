/**
 * JWT Scanner — product schema tests (V3 §6.4, §8.2, §20.2 Day 11).
 *
 * Pins the frozen analyzer persistence contract: named schema `jwt_scanner`,
 * non-null organization_id on every tenant table, shared vocabulary enums
 * (severity / job status / finding category), and the §6.6 extraction chain
 * projects → analysis_jobs → findings/reports.
 */

import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { JOB_STATUS_VALUES, SEVERITY_VALUES } from "@forge/domain";
import {
  analysisJobs,
  findings,
  jwtScanner,
  projects,
  reports,
} from "../schema.js";
import { JWT_FINDING_CATEGORIES } from "../../domain/types.js";

function columnOf(table: unknown, name: string) {
  const cfg = getTableConfig(table as never);
  const column = cfg.columns.find((candidate) => candidate.name === name);
  if (column === undefined) throw new Error(`column ${name} not found`);
  return column;
}

describe("jwt_scanner schema", () => {
  it("owns a named schema 'jwt_scanner' with the four analyzer persistence tables", () => {
    expect(jwtScanner).toBeDefined();
    for (const table of [projects, analysisJobs, findings, reports]) {
      expect(getTableConfig(table as never).schema).toBe("jwt_scanner");
    }
    expect(getTableConfig(projects as never).name).toBe("projects");
    expect(getTableConfig(analysisJobs as never).name).toBe("analysis_jobs");
    expect(getTableConfig(findings as never).name).toBe("findings");
    expect(getTableConfig(reports as never).name).toBe("reports");
  });

  it("carries a non-null organization_id on every tenant table (V3 §6.4)", () => {
    for (const table of [projects, analysisJobs, findings, reports]) {
      expect(columnOf(table, "organization_id").notNull).toBe(true);
    }
  });

  it("uses the shared severity vocabulary from @forge/domain", () => {
    const severity = columnOf(findings, "severity");
    expect(severity.dataType).toBe("string"); // drizzle pgEnum columns are string-typed
    expect(severity.enumValues).toEqual(SEVERITY_VALUES);
  });

  it("uses the shared job-status vocabulary from @forge/domain", () => {
    const status = columnOf(analysisJobs, "status");
    expect(status.dataType).toBe("string");
    expect(status.enumValues).toEqual(JOB_STATUS_VALUES);
    expect(status.hasDefault).toBe(true);
  });

  it("uses the frozen finding taxonomy for the category column", () => {
    const category = columnOf(findings, "category");
    expect(category.dataType).toBe("string");
    expect(category.enumValues).toEqual(JWT_FINDING_CATEGORIES);
  });

  it("implements the V3 §6.6 extraction chain via foreign keys", () => {
    const projectsCfg = getTableConfig(projects as never);
    const jobsCfg = getTableConfig(analysisJobs as never);
    const findingsCfg = getTableConfig(findings as never);
    const reportsCfg = getTableConfig(reports as never);

    const fkNames = (cfg: ReturnType<typeof getTableConfig>) =>
      cfg.foreignKeys.map((fk) => fk.getName());

    // projects.organization_id → platform.organizations
    expect(fkNames(projectsCfg)).toContain(
      "projects_organization_id_organizations_id_fk",
    );
    // analysis_jobs.project_id → projects.id
    expect(fkNames(jobsCfg)).toContain(
      "analysis_jobs_project_id_projects_id_fk",
    );
    // findings.job_id → analysis_jobs.id
    expect(fkNames(findingsCfg)).toContain(
      "findings_job_id_analysis_jobs_id_fk",
    );
    // reports.job_id → analysis_jobs.id
    expect(fkNames(reportsCfg)).toContain(
      "reports_job_id_analysis_jobs_id_fk",
    );
  });

  it("scopes findings with severity, category, title, description and evidence", () => {
    expect(columnOf(findings, "severity").notNull).toBe(true);
    expect(columnOf(findings, "category").notNull).toBe(true);
    expect(columnOf(findings, "title").notNull).toBe(true);
    expect(columnOf(findings, "description").notNull).toBe(true);
    expect(columnOf(findings, "evidence").notNull).toBe(true);
    expect(columnOf(findings, "evidence").dataType).toBe("json");
  });

  it("keeps credential material out of job records (V3 §11.3)", () => {
    const jobColumns = getTableConfig(analysisJobs as never).columns.map((column) => column.name);
    for (const forbidden of ["token", "secret", "signature"]) {
      expect(jobColumns.some((name) => name.includes(forbidden))).toBe(false);
    }
  });
});
