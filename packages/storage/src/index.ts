/**
 * @forge/storage — object storage port.
 * Provider-neutral contracts only. Depends on @forge/shared and nothing else.
 * V3 §3.2, §4.1, §5.2.
 */

export type {
  ContentType,
  ObjectKey,
  StorageData,
  StorageMetadata,
  StorageObject,
  StoragePortErrorOptions,
  StorageTimestamp,
} from "./types.js";
export { StorageErrorCode, StoragePortError } from "./types.js";

export type { StoragePort } from "./port.js";
