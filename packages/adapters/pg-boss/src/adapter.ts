/** PostgreSQL/pg-boss implementation of the provider-neutral JobQueuePort. */

import {
  JobErrorCode,
  JobQueuePortError,
  JobStatus,
} from "@forge/jobs";
import type {
  JobInfo,
  JobProcessor,
  JobQueuePort,
  JobStatus as NeutralJobStatus,
} from "@forge/jobs";
import { PgBoss } from "pg-boss";

interface ForgeJobEnvelope {
  readonly jobName: string;
  readonly data: unknown;
}

export interface PgBossJobLike<T = ForgeJobEnvelope> {
  readonly id: string;
  readonly name: string;
  readonly data: T;
  readonly state: "created" | "retry" | "active" | "completed" | "cancelled" | "failed";
  readonly retryCount: number;
  readonly createdOn: Date | string;
  readonly startedOn?: Date | string | null;
  readonly completedOn?: Date | string | null;
  readonly output?: unknown;
}

/** Structural slice of pg-boss used by the adapter and its offline fakes. */
export interface PgBossClient {
  start(): Promise<unknown>;
  stop(): Promise<void>;
  createQueue(name: string): Promise<void>;
  send(
    name: string,
    data: ForgeJobEnvelope,
    options: { readonly retryLimit: number; readonly startAfter?: Date }
  ): Promise<string | null>;
  work(
    name: string,
    options: { readonly includeMetadata: true },
    handler: (jobs: readonly PgBossJobLike[]) => Promise<void>
  ): Promise<string>;
  offWork(name: string): Promise<void>;
  getJobById(name: string, id: string): Promise<PgBossJobLike | null>;
}

export interface CreatePgBossJobQueueAdapterOptions {
  readonly client: PgBossClient;
  /** Physical pg-boss queue. Logical JobName values are stored in each envelope. */
  readonly queueName?: string;
}

const DEFAULT_QUEUE_NAME = "forge-jobs";

/** Creates a production pg-boss client without reading process environment. */
export function createPgBossClient(connectionString: string): PgBossClient {
  return new PgBoss(connectionString) as unknown as PgBossClient;
}

function providerFailure(message: string, cause?: unknown): JobQueuePortError {
  return new JobQueuePortError(message, {
    code: JobErrorCode.PROVIDER_FAILURE,
    ...(cause === undefined ? {} : { cause }),
  });
}

function enqueueFailure(message: string, cause?: unknown): JobQueuePortError {
  return new JobQueuePortError(message, {
    code: JobErrorCode.ENQUEUE_FAILED,
    ...(cause === undefined ? {} : { cause }),
  });
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function timestamp(value: Date | string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function mapStatus(state: PgBossJobLike["state"]): NeutralJobStatus {
  switch (state) {
    case "created":
    case "retry":
      return JobStatus.PENDING;
    case "active":
      return JobStatus.RUNNING;
    case "completed":
      return JobStatus.COMPLETED;
    case "failed":
      return JobStatus.FAILED;
    case "cancelled":
      return JobStatus.CANCELLED;
  }
}

function attemptCount(job: PgBossJobLike): number {
  if (job.state === "created") return 0;
  if (job.state === "retry") return job.retryCount;
  if (job.state === "cancelled" && timestamp(job.startedOn) === undefined) {
    return job.retryCount;
  }
  return job.retryCount + 1;
}

function failureMessage(output: unknown): string | undefined {
  if (typeof output === "string" && output !== "") return output;
  if (typeof output !== "object" || output === null) return undefined;

  const record = output as Record<string, unknown>;
  if (typeof record.message === "string" && record.message !== "") return record.message;
  for (const nested of [record.value, record.error]) {
    const message = failureMessage(nested);
    if (message !== undefined) return message;
  }
  return undefined;
}

function asEnvelope(value: unknown): ForgeJobEnvelope {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw providerFailure("pg-boss returned an invalid Forge job envelope");
  }
  const record = value as Record<string, unknown>;
  if (typeof record.jobName !== "string" || record.jobName === "" || !("data" in record)) {
    throw providerFailure("pg-boss returned an invalid Forge job envelope");
  }
  return { jobName: record.jobName, data: record.data };
}

function mapJob(job: PgBossJobLike): JobInfo {
  const envelope = asEnvelope(job.data);
  const createdAt = timestamp(job.createdOn);
  if (createdAt === undefined) {
    throw providerFailure(`pg-boss returned an invalid creation time for job: ${job.id}`);
  }

  const result: {
    id: string;
    name: string;
    status: NeutralJobStatus;
    attempts: number;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    error?: string;
  } = {
    id: job.id,
    name: envelope.jobName,
    status: mapStatus(job.state),
    attempts: attemptCount(job),
    createdAt,
  };
  const startedAt = timestamp(job.startedOn);
  const completedAt = timestamp(job.completedOn);
  if (startedAt !== undefined) result.startedAt = startedAt;
  if (completedAt !== undefined) result.completedAt = completedAt;
  if (job.state === "failed") result.error = failureMessage(job.output) ?? "Job failed";
  return result;
}

/** Builds a JobQueuePort over one physical pg-boss queue. */
export function pgBossJobQueueAdapter(
  options: CreatePgBossJobQueueAdapterOptions
): JobQueuePort {
  const queueName = options.queueName ?? DEFAULT_QUEUE_NAME;
  const processors = new Map<string, JobProcessor<unknown>>();
  const knownJobIds = new Set<string>();
  let running = false;

  async function processJobs(jobs: readonly PgBossJobLike[]): Promise<void> {
    // pg-boss defaults to batchSize=1. Iterate defensively so the adapter
    // remains correct if worker defaults/configuration change.
    for (const providerJob of jobs) {
      const envelope = asEnvelope(providerJob.data);
      const processor = processors.get(envelope.jobName);
      if (processor === undefined) {
        throw new Error(`No processor registered for job: ${envelope.jobName}`);
      }
      await processor({
        id: providerJob.id,
        name: envelope.jobName,
        data: envelope.data,
        attempt: providerJob.retryCount + 1,
      });
    }
  }

  return {
    async enqueue(jobName, data, enqueueOptions) {
      if (!running) {
        throw new JobQueuePortError("Job queue is not running", {
          code: JobErrorCode.QUEUE_NOT_RUNNING,
        });
      }
      if (jobName === "") throw enqueueFailure("Job name must not be empty");

      const maxAttempts = enqueueOptions?.maxAttempts ?? 1;
      if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
        throw enqueueFailure("maxAttempts must be a positive integer");
      }

      let startAfter: Date | undefined;
      if (enqueueOptions?.runAt !== undefined) {
        startAfter = new Date(enqueueOptions.runAt);
        if (Number.isNaN(startAfter.getTime())) {
          throw enqueueFailure("runAt must be a valid ISO-8601 timestamp");
        }
      }

      try {
        const jobId = await options.client.send(
          queueName,
          { jobName, data },
          {
            retryLimit: maxAttempts - 1,
            ...(startAfter === undefined ? {} : { startAfter }),
          }
        );
        if (jobId === null || jobId === "") {
          throw enqueueFailure("pg-boss did not accept the job");
        }
        knownJobIds.add(jobId);
        return jobId;
      } catch (error) {
        if (error instanceof JobQueuePortError) throw error;
        throw enqueueFailure("pg-boss enqueue failed", error);
      }
    },

    async getJob(jobId) {
      // A never-started adapter cannot have accepted a job, and pg-boss has no
      // open database connection yet. Preserve the port's unknown-id behavior.
      if (!running && !knownJobIds.has(jobId)) return null;
      try {
        const job = await options.client.getJobById(queueName, jobId);
        return job === null ? null : mapJob(job);
      } catch (error) {
        if (error instanceof JobQueuePortError) throw error;
        throw providerFailure("pg-boss job lookup failed", error);
      }
    },

    registerProcessor<TData>(jobName: string, processor: JobProcessor<TData>) {
      processors.set(jobName, processor as JobProcessor<unknown>);
    },

    async start() {
      if (running) return;
      try {
        await options.client.start();
        await options.client.createQueue(queueName);
        await options.client.work(queueName, { includeMetadata: true }, processJobs);
        running = true;
      } catch (error) {
        try {
          await options.client.stop();
        } catch {
          // Preserve the startup failure as the actionable cause.
        }
        throw providerFailure("pg-boss startup failed", error);
      }
    },

    async stop() {
      if (!running) return;
      running = false;
      let stopError: unknown;
      try {
        await options.client.offWork(queueName);
      } catch (error) {
        stopError = error;
      }
      try {
        await options.client.stop();
      } catch (error) {
        stopError ??= error;
      }
      if (stopError !== undefined) {
        throw providerFailure("pg-boss shutdown failed", stopError);
      }
    },
  };
}
