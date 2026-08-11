/**
 * Mock job queue — real behavioral in-memory implementation of JobQueuePort.
 * Jobs execute synchronously through registered processors: `await enqueue()`
 * returns once the job reaches a terminal state, and `start()` drains the
 * backlog. Retries honor `maxAttempts` (default 1). V3 §3.2
 * (packages/testing/src/mocks/), Day 5.
 */

import {
  JobErrorCode,
  JobQueuePortError,
  JobStatus,
  type JobId,
  type JobInfo,
  type JobName,
  type JobOptions,
  type JobProcessor,
  type JobQueuePort,
} from "@forge/jobs";

interface MockJobRecord {
  info: JobInfo;
  data: unknown;
  maxAttempts: number;
}

/** Creates an in-memory JobQueuePort. */
export function createMockJobQueue(): JobQueuePort {
  const jobs = new Map<JobId, MockJobRecord>();
  const processors = new Map<JobName, JobProcessor<unknown>>();
  let running = false;
  let sequence = 0;

  async function execute(record: MockJobRecord): Promise<void> {
    const processor = processors.get(record.info.name);
    if (processor === undefined) {
      // No processor registered yet: the job stays pending, as a real queue
      // would hold it until a worker subscribes.
      return;
    }
    record.info = {
      ...record.info,
      status: JobStatus.RUNNING,
      startedAt: record.info.startedAt ?? new Date().toISOString(),
    };
    for (let attempt = record.info.attempts + 1; attempt <= record.maxAttempts; attempt += 1) {
      try {
        await processor({
          id: record.info.id,
          name: record.info.name,
          data: record.data,
          attempt,
        });
        record.info = {
          ...record.info,
          status: JobStatus.COMPLETED,
          attempts: attempt,
          completedAt: new Date().toISOString(),
        };
        return;
      } catch (error) {
        record.info = {
          ...record.info,
          attempts: attempt,
          error: error instanceof Error ? error.message : String(error),
        };
        if (attempt >= record.maxAttempts) {
          record.info = { ...record.info, status: JobStatus.FAILED };
          return;
        }
      }
    }
  }

  async function enqueue<TData>(
    jobName: JobName,
    data: TData,
    options?: JobOptions
  ): Promise<JobId> {
    if (!running) {
      throw new JobQueuePortError("Job queue is not running", {
        code: JobErrorCode.QUEUE_NOT_RUNNING,
        details: { jobName },
      });
    }
    sequence += 1;
    const id = `mock_job_${String(sequence).padStart(4, "0")}`;
    const record: MockJobRecord = {
      info: {
        id,
        name: jobName,
        status: JobStatus.PENDING,
        attempts: 0,
        createdAt: new Date().toISOString(),
      },
      data,
      maxAttempts: options?.maxAttempts ?? 1,
    };
    jobs.set(id, record);
    await execute(record);
    return id;
  }

  async function getJob(jobId: JobId): Promise<JobInfo | null> {
    return jobs.get(jobId)?.info ?? null;
  }

  function registerProcessor<TData>(jobName: JobName, processor: JobProcessor<TData>): void {
    processors.set(jobName, processor as JobProcessor<unknown>);
  }

  async function start(): Promise<void> {
    running = true;
    for (const record of jobs.values()) {
      if (record.info.status === JobStatus.PENDING) {
        await execute(record);
      }
    }
  }

  async function stop(): Promise<void> {
    running = false;
  }

  return { enqueue, getJob, registerProcessor, start, stop };
}
