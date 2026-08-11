/**
 * Jobs conformance suite — proves any JobQueuePort implementation satisfies
 * the @forge/jobs contract: lifecycle, inspection, retries and failure
 * semantics. V3 §12.4, §5.2, §7, P12.
 */

import { describe, expect, it } from "vitest";
import { isAppError } from "@forge/shared";
import {
  JobErrorCode,
  JobQueuePortError,
  JobStatus,
  type Job,
  type JobQueuePort,
} from "@forge/jobs";

/** Produces a JobQueuePort implementation in a fresh, stopped state. */
export interface JobsConformanceHarness {
  createQueue(): JobQueuePort;
}

/** Registers the JobQueuePort conformance suite against the harness. */
export function runJobsConformance(harness: JobsConformanceHarness): void {
  describe("JobQueuePort conformance", () => {
    it("getJob resolves null for an unknown job id", async () => {
      const queue = harness.createQueue();
      await expect(queue.getJob("job_missing")).resolves.toBeNull();
    });

    it("enqueue rejects before start with JOBS_QUEUE_NOT_RUNNING", async () => {
      const queue = harness.createQueue();
      const error = await queue.enqueue("conformance.job", { n: 1 }).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(JobQueuePortError);
      expect(isAppError(error)).toBe(true);
      expect((error as JobQueuePortError).code).toBe(JobErrorCode.QUEUE_NOT_RUNNING);
    });

    it("runs an enqueued job through its registered processor", async () => {
      const queue = harness.createQueue();
      const seen: Array<Job<{ n: number }>> = [];
      queue.registerProcessor<{ n: number }>("conformance.job", async (job) => {
        seen.push(job);
      });
      await queue.start();

      const jobId = await queue.enqueue("conformance.job", { n: 42 });
      expect(jobId).not.toBe("");

      const info = await queue.getJob(jobId);
      expect(info).not.toBeNull();
      expect(info?.name).toBe("conformance.job");
      expect(info?.status).toBe(JobStatus.COMPLETED);
      expect(info?.attempts).toBe(1);
      expect(info?.completedAt).not.toBeUndefined();

      expect(seen).toHaveLength(1);
      expect(seen[0].data).toEqual({ n: 42 });
      expect(seen[0].attempt).toBe(1);
    });

    it("retries a failing processor up to maxAttempts and records success", async () => {
      const queue = harness.createQueue();
      const attempts: number[] = [];
      queue.registerProcessor("conformance.retry", async (job) => {
        attempts.push(job.attempt);
        if (job.attempt < 2) {
          throw new Error("transient failure");
        }
      });
      await queue.start();

      const jobId = await queue.enqueue("conformance.retry", {}, { maxAttempts: 2 });
      const info = await queue.getJob(jobId);

      expect(attempts).toEqual([1, 2]);
      expect(info?.status).toBe(JobStatus.COMPLETED);
      expect(info?.attempts).toBe(2);
    });

    it("marks a job failed after exhausting maxAttempts and records the error", async () => {
      const queue = harness.createQueue();
      queue.registerProcessor("conformance.fail", async () => {
        throw new Error("always fails");
      });
      await queue.start();

      const jobId = await queue.enqueue("conformance.fail", {}, { maxAttempts: 2 });
      const info = await queue.getJob(jobId);

      expect(info?.status).toBe(JobStatus.FAILED);
      expect(info?.attempts).toBe(2);
      expect(info?.error).toContain("always fails");
    });

    it("enqueue rejects after stop with JOBS_QUEUE_NOT_RUNNING", async () => {
      const queue = harness.createQueue();
      await queue.start();
      await queue.stop();

      const error = await queue.enqueue("conformance.job", {}).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(JobQueuePortError);
      expect((error as JobQueuePortError).code).toBe(JobErrorCode.QUEUE_NOT_RUNNING);
    });
  });
}
