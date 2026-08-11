/**
 * Storage test data factories — deterministic builders for @forge/storage types.
 * V3 §3.2 (packages/testing/src/factories/), Day 5.
 */

import type { StorageObject } from "@forge/storage";
import { FACTORY_TIMESTAMP } from "./jobs.js";

let objectSequence = 0;

/** Builds a valid StorageObject listing entry with a unique key per call. */
export function makeStorageObject(overrides?: Partial<StorageObject>): StorageObject {
  objectSequence += 1;
  const n = objectSequence;
  return {
    key: `objects/object_${String(n).padStart(4, "0")}.txt`,
    size: 16,
    contentType: "text/plain",
    lastModifiedAt: FACTORY_TIMESTAMP,
    ...overrides,
  };
}

/** Encodes a deterministic payload into the bytes the storage port accepts. */
export function makeStorageBytes(content = "forge-test-payload"): Uint8Array {
  return new TextEncoder().encode(content);
}
