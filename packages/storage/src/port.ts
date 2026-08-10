/**
 * StoragePort — object storage capability contract.
 * V3 §5.2. Implemented by adapters only; never by this package.
 */

import type { ContentType, ObjectKey, StorageData, StorageObject } from "./types.js";

export interface StoragePort {
  /** Stores an object and returns the key it is addressable by. */
  upload(key: ObjectKey, data: StorageData, contentType: ContentType): Promise<ObjectKey>;

  /**
   * Returns the object contents.
   * Throws `StoragePortError` with code `STORAGE_OBJECT_NOT_FOUND` when the key is unknown.
   */
  download(key: ObjectKey): Promise<Uint8Array>;

  /** Returns a time-limited URL granting direct access, expiring after `expiresIn` seconds. */
  getSignedUrl(key: ObjectKey, expiresIn: number): Promise<string>;

  /** Removes an object. Removing an unknown key is not an error. */
  delete(key: ObjectKey): Promise<void>;

  /** Lists stored objects whose key starts with `prefix`. */
  list(prefix: string): Promise<readonly StorageObject[]>;
}
