import { describe, it, expect } from "vitest";
import { AppError } from "@forge/shared";
import * as jobsPackage from "../index.js";
import {
  JOB_STATUS_VALUES,
  JobErrorCode,
  JobQueuePortError,
  JobStatus,
  isJobStatus,
  isTerminalJobStatus,
  type Job,
  type JobInfo,
  type JobProcessor,
} from "../index.js";
import type { JobQueuePort } from "../index.js";

/**
 * A dummy in-memory queue proving the port is implementable without a broker.
 * This is a test double, not a runtime: the port ships no queue.
 */
function createDummyJobQueue(): JobQueuePort & { readonly processed: string[] } {
  const jobs = new Map<string, JobInfo>();
  const processors = new Map<string, JobProcessor<never>>();
  const processed: string[] = [];
  let running = false;
  let counter = 0;

  return {
    processed,
    async enqueue(jobName, data, options) {
      counter += 1;
      const id = `job_${counter}`;
      jobs.set(id, {
        id,
        name: jobName,
        status: JobStatus.PENDING,
        attempts: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
      });

      if (running) {
        const processor = processors.get(jobName) as JobProcessor<unknown> | undefined;
        if (processor !== undefined) {
          const job: Job<unknown> = { id, name: jobName, data, attempt: 1 };
          await processor(job);
          processed.push(id);
          jobs.set(id, {
            id,
            name: jobName,
            status: JobStatus.COMPLETED,
            attempts: 1,
            createdAt: "2026-01-01T00:00:00.000Z",
            completedAt: "2026-01-01T00:00:01.000Z",
          });
        }
      } else if (options?.runAt === undefined) {
        // Queued for a later start() — nothing else to do in the double.
      }

      return id;
    },
    async getJob(jobId) {
      return jobs.get(jobId) ?? null;
    },
    registerProcessor(jobName, processor) {
      processors.set(jobName, processor as JobProcessor<never>);
    },
    async start() {
      running = true;
    },
    async stop() {
      running = false;
    },
  };
}

describe("JobQueuePort contract", () => {
  it("is implementable by a dummy queue", async () => {
    const queue = createDummyJobQueue();
    const seen: { id: string; data: { projectId: string } }[] = [];

    queue.registerProcessor<{ projectId: string }>("scan", async (job) => {
      seen.push({ id: job.id, data: job.data });
    });
    await queue.start();

    const jobId = await queue.enqueue("scan", { projectId: "p1" }, { maxAttempts: 3 });

    expect(jobId).toBe("job_1");
    expect(seen).toEqual([{ id: "job_1", data: { projectId: "p1" } }]);
    expect(queue.processed).toEqual(["job_1"]);
    await queue.stop();
  });

  it("keeps enqueued work pending until the queue is started", async () => {
    const queue = createDummyJobQueue();
    queue.registerProcessor("scan", async () => undefined);

    const jobId = await queue.enqueue("scan", { projectId: "p1" });
    const info = await queue.getJob(jobId);

    expect(info?.status).toBe(JobStatus.PENDING);
    expect(queue.processed).toEqual([]);
  });

  it("returns null for an unknown job", async () => {
    const queue = createDummyJobQueue();
    await expect(queue.getJob("job_missing")).resolves.toBeNull();
  });

  it("accepts scheduling and retry options without a scheduler", async () => {
    const queue = createDummyJobQueue();

    const jobId = await queue.enqueue(
      "digest",
      { period: "daily" },
      { runAt: "2026-02-01T09:00:00.000Z", maxAttempts: 5 }
    );

    await expect(queue.getJob(jobId)).resolves.toMatchObject({ name: "digest", attempts: 0 });
  });
});

describe("job status", () => {
  it("exposes the five neutral lifecycle values", () => {
    expect(JOB_STATUS_VALUES).toEqual(["pending", "running", "completed", "failed", "cancelled"]);
  });

  it("guards status values exactly", () => {
    expect(isJobStatus("running")).toBe(true);
    expect(isJobStatus("RUNNING")).toBe(false);
    expect(isJobStatus("archived")).toBe(false);
    expect(isJobStatus(7)).toBe(false);
  });

  it("identifies terminal states", () => {
    expect(isTerminalJobStatus(JobStatus.COMPLETED)).toBe(true);
    expect(isTerminalJobStatus(JobStatus.FAILED)).toBe(true);
    expect(isTerminalJobStatus(JobStatus.CANCELLED)).toBe(true);
    expect(isTerminalJobStatus(JobStatus.PENDING)).toBe(false);
    expect(isTerminalJobStatus(JobStatus.RUNNING)).toBe(false);
  });
});

describe("JobQueuePortError", () => {
  it("extends AppError and defaults to PROVIDER_FAILURE", () => {
    const error = new JobQueuePortError("queue unavailable");

    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe("JobQueuePortError");
    expect(error.code).toBe(JobErrorCode.PROVIDER_FAILURE);
  });

  it("carries queue-specific neutral codes", () => {
    const error = new JobQueuePortError("queue not started", {
      code: JobErrorCode.QUEUE_NOT_RUNNING,
      details: { jobName: "scan" },
    });

    expect(error.code).toBe("JOBS_QUEUE_NOT_RUNNING");
    expect(error.details).toEqual({ jobName: "scan" });
    expect(JobErrorCode.ENQUEUE_FAILED).toBe("JOBS_ENQUEUE_FAILED");
  });
});

describe("package exports", () => {
  it("exposes exactly the runtime exports of the port", () => {
    expect(Object.keys(jobsPackage).sort()).toEqual([
      "JOB_STATUS_VALUES",
      "JobErrorCode",
      "JobQueuePortError",
      "JobStatus",
      "isJobStatus",
      "isTerminalJobStatus",
    ]);
  });
});
