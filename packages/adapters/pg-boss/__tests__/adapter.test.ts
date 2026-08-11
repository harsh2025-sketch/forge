import { describe, expect, it } from "vitest";
import { JobErrorCode, JobQueuePortError, JobStatus } from "@forge/jobs";
import { runJobsConformance } from "@forge/testing";
import {
  pgBossJobQueueAdapter,
  type PgBossClient,
  type PgBossJobLike,
} from "../src/index.js";

interface StoredJob extends PgBossJobLike {
  readonly data: { readonly jobName: string; readonly data: unknown };
  retryCount: number;
  state: PgBossJobLike["state"];
  startedOn?: Date | null;
  completedOn?: Date | null;
  output?: unknown;
  retryLimit: number;
  startAfter?: Date;
}

class FakePgBossClient implements PgBossClient {
  readonly jobs = new Map<string, StoredJob>();
  readonly sent: Array<{ name: string; data: unknown; options: unknown }> = [];
  started = false;
  stopped = false;
  startCalls = 0;
  stopCalls = 0;
  offWorkCalls = 0;
  sequence = 0;
  handler: ((jobs: readonly PgBossJobLike[]) => Promise<void>) | undefined;
  startError: unknown;
  sendError: unknown;
  lookupError: unknown;
  offWorkError: unknown;

  async start(): Promise<unknown> {
    this.startCalls += 1;
    if (this.startError !== undefined) throw this.startError;
    this.started = true;
    return this;
  }

  async stop(): Promise<void> {
    this.stopCalls += 1;
    this.stopped = true;
    this.started = false;
  }

  async createQueue(): Promise<void> {}

  async work(
    _name: string,
    _options: { readonly includeMetadata: true },
    handler: (jobs: readonly PgBossJobLike[]) => Promise<void>
  ): Promise<string> {
    this.handler = handler;
    return "worker_1";
  }

  async offWork(): Promise<void> {
    this.offWorkCalls += 1;
    if (this.offWorkError !== undefined) throw this.offWorkError;
    this.handler = undefined;
  }

  async send(
    name: string,
    data: { readonly jobName: string; readonly data: unknown },
    options: { readonly retryLimit: number; readonly startAfter?: Date }
  ): Promise<string | null> {
    if (this.sendError !== undefined) throw this.sendError;
    this.sequence += 1;
    const id = `job_${this.sequence}`;
    const job: StoredJob = {
      id,
      name,
      data,
      state: "created",
      retryCount: 0,
      retryLimit: options.retryLimit,
      createdOn: new Date("2026-08-11T10:00:00.000Z"),
      ...(options.startAfter === undefined ? {} : { startAfter: options.startAfter }),
    };
    this.jobs.set(id, job);
    this.sent.push({ name, data, options });

    if (options.startAfter === undefined || options.startAfter.getTime() <= Date.now()) {
      await this.run(job);
    }
    return id;
  }

  async getJobById(_name: string, id: string): Promise<PgBossJobLike | null> {
    if (this.lookupError !== undefined) throw this.lookupError;
    return this.jobs.get(id) ?? null;
  }

  seed(job: StoredJob): void {
    this.jobs.set(job.id, job);
  }

  private async run(job: StoredJob): Promise<void> {
    if (this.handler === undefined) return;
    while (true) {
      job.state = "active";
      job.startedOn ??= new Date("2026-08-11T10:00:01.000Z");
      try {
        await this.handler([job]);
        job.state = "completed";
        job.completedOn = new Date("2026-08-11T10:00:02.000Z");
        return;
      } catch (error) {
        job.output = {
          message: error instanceof Error ? error.message : String(error),
        };
        if (job.retryCount < job.retryLimit) {
          job.retryCount += 1;
          job.state = "retry";
          continue;
        }
        job.state = "failed";
        job.completedOn = new Date("2026-08-11T10:00:02.000Z");
        return;
      }
    }
  }
}

runJobsConformance({
  createQueue() {
    return pgBossJobQueueAdapter({ client: new FakePgBossClient() });
  },
});

describe("pgBossJobQueueAdapter", () => {
  it("uses one physical PostgreSQL queue while preserving logical names and options", async () => {
    const client = new FakePgBossClient();
    const queue = pgBossJobQueueAdapter({ client, queueName: "forge-test" });
    await queue.start();
    const runAt = "2999-01-01T00:00:00.000Z";
    const id = await queue.enqueue("reports.generate", { reportId: "report_1" }, {
      maxAttempts: 4,
      runAt,
    });

    expect(client.sent).toEqual([{
      name: "forge-test",
      data: { jobName: "reports.generate", data: { reportId: "report_1" } },
      options: { retryLimit: 3, startAfter: new Date(runAt) },
    }]);
    await expect(queue.getJob(id)).resolves.toMatchObject({
      name: "reports.generate",
      status: JobStatus.PENDING,
      attempts: 0,
      createdAt: "2026-08-11T10:00:00.000Z",
    });
  });

  it("supports processors registered after start", async () => {
    const client = new FakePgBossClient();
    const queue = pgBossJobQueueAdapter({ client });
    await queue.start();
    const seen: unknown[] = [];
    queue.registerProcessor("late.processor", async (job) => { seen.push(job.data); });
    const id = await queue.enqueue("late.processor", { value: 9 });

    expect(seen).toEqual([{ value: 9 }]);
    await expect(queue.getJob(id)).resolves.toMatchObject({
      status: JobStatus.COMPLETED,
      attempts: 1,
    });
  });

  it("records an unregistered processor as a neutral terminal failure", async () => {
    const client = new FakePgBossClient();
    const queue = pgBossJobQueueAdapter({ client });
    await queue.start();
    const id = await queue.enqueue("missing.processor", {}, { maxAttempts: 2 });
    await expect(queue.getJob(id)).resolves.toMatchObject({
      name: "missing.processor",
      status: JobStatus.FAILED,
      attempts: 2,
      error: "No processor registered for job: missing.processor",
    });
  });

  it("maps cancelled provider jobs and nested failure output without leaking metadata", async () => {
    const client = new FakePgBossClient();
    const queue = pgBossJobQueueAdapter({ client });
    await queue.start();
    client.seed({
      id: "job_cancelled",
      name: "forge-jobs",
      data: { jobName: "cancelled.job", data: {} },
      state: "cancelled",
      retryCount: 0,
      retryLimit: 0,
      createdOn: "2026-08-11T10:00:00.000Z",
      completedOn: "2026-08-11T10:01:00.000Z",
    });
    await expect(queue.getJob("job_cancelled")).resolves.toEqual({
      id: "job_cancelled",
      name: "cancelled.job",
      status: JobStatus.CANCELLED,
      attempts: 0,
      createdAt: "2026-08-11T10:00:00.000Z",
      completedAt: "2026-08-11T10:01:00.000Z",
    });

    client.seed({
      id: "job_failed",
      name: "forge-jobs",
      data: { jobName: "failed.job", data: {} },
      state: "failed",
      retryCount: 1,
      retryLimit: 1,
      createdOn: new Date("2026-08-11T10:00:00.000Z"),
      startedOn: new Date("2026-08-11T10:00:01.000Z"),
      completedOn: new Date("2026-08-11T10:00:02.000Z"),
      output: { value: { message: "sanitized failure" }, stack: "vendor internals" },
    });
    await expect(queue.getJob("job_failed")).resolves.toMatchObject({
      status: JobStatus.FAILED,
      attempts: 2,
      error: "sanitized failure",
    });
  });

  it("validates enqueue inputs before calling pg-boss", async () => {
    const client = new FakePgBossClient();
    const queue = pgBossJobQueueAdapter({ client });
    await queue.start();
    for (const operation of [
      queue.enqueue("", {}),
      queue.enqueue("job", {}, { maxAttempts: 0 }),
      queue.enqueue("job", {}, { maxAttempts: 1.5 }),
      queue.enqueue("job", {}, { runAt: "not-a-date" }),
    ]) {
      await expect(operation).rejects.toMatchObject({ code: JobErrorCode.ENQUEUE_FAILED });
    }
    expect(client.sent).toHaveLength(0);
  });

  it("translates enqueue and lookup provider failures to their stable codes", async () => {
    const client = new FakePgBossClient();
    const queue = pgBossJobQueueAdapter({ client });
    await queue.start();
    const sendError = new Error("database insert failed");
    client.sendError = sendError;
    await expect(queue.enqueue("job", {})).rejects.toMatchObject({
      code: JobErrorCode.ENQUEUE_FAILED,
      cause: sendError,
    });

    client.sendError = undefined;
    const lookupError = new Error("database query failed");
    client.lookupError = lookupError;
    const error = await queue.getJob("unknown").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(JobQueuePortError);
    expect((error as JobQueuePortError).code).toBe(JobErrorCode.PROVIDER_FAILURE);
    expect((error as JobQueuePortError).cause).toBe(lookupError);
  });

  it("starts and stops idempotently and releases pg-boss resources", async () => {
    const client = new FakePgBossClient();
    const queue = pgBossJobQueueAdapter({ client });
    await queue.start();
    await queue.start();
    await queue.stop();
    await queue.stop();

    expect(client.startCalls).toBe(1);
    expect(client.offWorkCalls).toBe(1);
    expect(client.stopCalls).toBe(1);
    await expect(queue.enqueue("job", {})).rejects.toMatchObject({
      code: JobErrorCode.QUEUE_NOT_RUNNING,
    });
  });

  it("translates startup and shutdown failures while still closing the client", async () => {
    const startupClient = new FakePgBossClient();
    const startupError = new Error("migration failed");
    startupClient.startError = startupError;
    await expect(
      pgBossJobQueueAdapter({ client: startupClient }).start()
    ).rejects.toMatchObject({ code: JobErrorCode.PROVIDER_FAILURE, cause: startupError });
    expect(startupClient.stopCalls).toBe(1);

    const shutdownClient = new FakePgBossClient();
    const queue = pgBossJobQueueAdapter({ client: shutdownClient });
    await queue.start();
    const shutdownError = new Error("worker stop failed");
    shutdownClient.offWorkError = shutdownError;
    await expect(queue.stop()).rejects.toMatchObject({
      code: JobErrorCode.PROVIDER_FAILURE,
      cause: shutdownError,
    });
    expect(shutdownClient.stopCalls).toBe(1);
  });
});
