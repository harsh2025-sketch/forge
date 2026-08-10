/**
 * JobStatus — required shared where jobs exist per V3 §9
 * Who: Analyzer, Optimizer, Generator (when async) + JobQueuePort itself
 * Provider-neutral: abstracts the job queue (P10 — PostgreSQL-backed by default, no Redis).
 */

export const JobStatus = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const JOB_STATUS_VALUES = Object.values(JobStatus) as readonly JobStatus[];

/**
 * Type guard — exact, case-sensitive.
 */
export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === "string" && (JOB_STATUS_VALUES as readonly string[]).includes(value);
}

/**
 * Returns true if the status is terminal (no further transitions).
 */
export function isTerminalStatus(status: JobStatus): boolean {
  return status === JobStatus.COMPLETED || status === JobStatus.FAILED || status === JobStatus.CANCELLED;
}
