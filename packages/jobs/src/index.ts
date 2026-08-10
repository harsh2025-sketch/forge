/**
 * @forge/jobs — job queue port.
 * Provider-neutral contracts only. Depends on @forge/shared and nothing else.
 * Contains no queue runtime. V3 §3.2, §4.1, §5.2, P10.
 */

export type {
  Job,
  JobId,
  JobInfo,
  JobName,
  JobOptions,
  JobProcessor,
  JobQueuePortErrorOptions,
  JobTimestamp,
} from "./types.js";
export {
  JOB_STATUS_VALUES,
  JobErrorCode,
  JobQueuePortError,
  JobStatus,
  isJobStatus,
  isTerminalJobStatus,
} from "./types.js";

export type { JobQueuePort } from "./port.js";
