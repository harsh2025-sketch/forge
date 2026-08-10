/**
 * @forge/jobs types — provider-neutral background job types.
 * V3 §3.2 (packages/jobs/src/types.ts), §5.2 (JobQueuePort contract), P10, P21.
 *
 * This package declares a capability. It contains no queue runtime, no
 * scheduler, no broker client and no persistence.
 */

import { AppError, type AppErrorOptions } from "@forge/shared";

/** Opaque, provider-neutral identifier of an enqueued job. */
export type JobId = string;

/** Logical name a processor is registered against. */
export type JobName = string;

/** ISO-8601 timestamp. Strings keep the contract serialization-safe. */
export type JobTimestamp = string;

/**
 * Lifecycle of a job.
 *
 * Deliberately duplicated from the domain layer's job status: a port may not
 * depend on @forge/domain (boundaries.md: packages/[port] → packages/shared).
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

/** Type guard — exact, case-sensitive. */
export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === "string" && (JOB_STATUS_VALUES as readonly string[]).includes(value);
}

/** Returns true when the status is terminal (no further transitions). */
export function isTerminalJobStatus(status: JobStatus): boolean {
  return (
    status === JobStatus.COMPLETED || status === JobStatus.FAILED || status === JobStatus.CANCELLED
  );
}

/** Delivery options accepted at enqueue time. */
export interface JobOptions {
  /** Earliest time the job may run. Omitted means "as soon as possible". */
  readonly runAt?: JobTimestamp;
  /** Total attempts allowed before the job is considered failed. */
  readonly maxAttempts?: number;
}

/** The unit of work handed to a processor. */
export interface Job<TData = unknown> {
  readonly id: JobId;
  readonly name: JobName;
  readonly data: TData;
  /** 1-based attempt counter for this execution. */
  readonly attempt: number;
}

/** Queue-side view of a job, returned by inspection. */
export interface JobInfo {
  readonly id: JobId;
  readonly name: JobName;
  readonly status: JobStatus;
  readonly attempts: number;
  readonly createdAt: JobTimestamp;
  readonly startedAt?: JobTimestamp;
  readonly completedAt?: JobTimestamp;
  /** Neutral failure message recorded by the queue, when the job failed. */
  readonly error?: string;
}

/** Work executed for a job. Throwing marks the attempt as failed. */
export type JobProcessor<TData = unknown> = (job: Job<TData>) => Promise<void>;

/** Stable, provider-neutral failure codes for job queue operations. */
export const JobErrorCode = {
  /** The job could not be accepted by the queue. */
  ENQUEUE_FAILED: "JOBS_ENQUEUE_FAILED",
  /** An operation requiring a running queue was called before `start()`. */
  QUEUE_NOT_RUNNING: "JOBS_QUEUE_NOT_RUNNING",
  /** The queue behind the port failed for any other reason. */
  PROVIDER_FAILURE: "JOBS_PROVIDER_FAILURE",
} as const;

export type JobErrorCode = (typeof JobErrorCode)[keyof typeof JobErrorCode];

export interface JobQueuePortErrorOptions extends Omit<AppErrorOptions, "code"> {
  readonly code?: JobErrorCode;
}

/**
 * Error raised by job queue port implementations.
 *
 * Adapters translate queue failures into this type so callers never depend on a
 * queue implementation's error shape.
 */
export class JobQueuePortError extends AppError {
  constructor(message: string, options?: JobQueuePortErrorOptions) {
    super(message, {
      code: options?.code ?? JobErrorCode.PROVIDER_FAILURE,
      details: options?.details,
      cause: options?.cause,
    });
  }
}
