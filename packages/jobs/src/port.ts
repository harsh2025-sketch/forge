/**
 * JobQueuePort — background job capability contract.
 * V3 §5.2, §7 (jobs are a capability, not mandatory infrastructure).
 * Implemented by adapters only; never by this package.
 */

import type { JobId, JobInfo, JobName, JobOptions, JobProcessor } from "./types.js";

export interface JobQueuePort {
  /** Accepts work for later execution and returns its identifier. */
  enqueue<TData>(jobName: JobName, data: TData, options?: JobOptions): Promise<JobId>;

  /** Returns the queue-side view of a job, or `null` when it is unknown. */
  getJob(jobId: JobId): Promise<JobInfo | null>;

  /** Registers the processor executed for jobs of the given name. */
  registerProcessor<TData>(jobName: JobName, processor: JobProcessor<TData>): void;

  /** Begins processing registered job names. */
  start(): Promise<void>;

  /** Stops processing and releases queue resources. */
  stop(): Promise<void>;
}
