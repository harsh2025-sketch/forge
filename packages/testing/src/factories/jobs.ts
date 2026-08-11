/**
 * Jobs test data factories — deterministic builders for @forge/jobs types.
 * V3 §3.2 (packages/testing/src/factories/), Day 5.
 */

import { JobStatus, type Job, type JobInfo, type JobOptions } from "@forge/jobs";

/** A fixed timestamp so factory output is fully deterministic. */
export const FACTORY_TIMESTAMP = "2026-01-01T00:00:00.000Z";

let jobSequence = 0;

/** Builds a valid Job ready to hand to a processor. */
export function makeJob<TData = unknown>(overrides?: Partial<Job<TData>>): Job<TData> {
  jobSequence += 1;
  const n = jobSequence;
  return {
    id: `job_${String(n).padStart(4, "0")}`,
    name: "test.job",
    data: { sequence: n } as TData,
    attempt: 1,
    ...overrides,
  };
}

/** Builds a valid pending JobInfo. */
export function makeJobInfo(overrides?: Partial<JobInfo>): JobInfo {
  return {
    id: "job_0001",
    name: "test.job",
    status: JobStatus.PENDING,
    attempts: 0,
    createdAt: FACTORY_TIMESTAMP,
    ...overrides,
  };
}

/** Builds valid JobOptions. */
export function makeJobOptions(overrides?: Partial<JobOptions>): JobOptions {
  return {
    runAt: FACTORY_TIMESTAMP,
    maxAttempts: 3,
    ...overrides,
  };
}
