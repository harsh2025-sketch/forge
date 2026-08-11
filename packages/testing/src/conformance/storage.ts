/**
 * Storage conformance suite — proves any StoragePort implementation satisfies
 * the @forge/storage contract: round-trips, overwrite, deletion, listing and
 * not-found semantics. V3 §12.4, §5.2, P12.
 */

import { describe, expect, it } from "vitest";
import { isAppError } from "@forge/shared";
import {
  StorageErrorCode,
  StoragePortError,
  type StoragePort,
} from "@forge/storage";

/** Produces a StoragePort implementation backed by empty storage. */
export interface StorageConformanceHarness {
  createStorage(): StoragePort;
}

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

/** Registers the StoragePort conformance suite against the harness. */
export function runStorageConformance(harness: StorageConformanceHarness): void {
  describe("StoragePort conformance", () => {
    it("upload returns the key and download round-trips the bytes", async () => {
      const storage = harness.createStorage();
      const payload = bytes(1, 2, 3, 4);

      await expect(storage.upload("round/trip.bin", payload, "application/octet-stream")).resolves.toBe(
        "round/trip.bin"
      );
      await expect(storage.download("round/trip.bin")).resolves.toEqual(payload);
    });

    it("upload accepts streamed payloads", async () => {
      const storage = harness.createStorage();
      async function* chunks(): AsyncIterable<Uint8Array> {
        yield bytes(9, 8);
        yield bytes(7);
      }

      await storage.upload("streamed.bin", chunks(), "application/octet-stream");
      await expect(storage.download("streamed.bin")).resolves.toEqual(bytes(9, 8, 7));
    });

    it("upload overwrites an existing object", async () => {
      const storage = harness.createStorage();
      await storage.upload("overwrite.bin", bytes(1), "application/octet-stream");
      await storage.upload("overwrite.bin", bytes(2, 2), "application/octet-stream");
      await expect(storage.download("overwrite.bin")).resolves.toEqual(bytes(2, 2));
    });

    it("download rejects an unknown key with STORAGE_OBJECT_NOT_FOUND", async () => {
      const storage = harness.createStorage();
      const error = await storage.download("missing.bin").catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(StoragePortError);
      expect(isAppError(error)).toBe(true);
      expect((error as StoragePortError).code).toBe(StorageErrorCode.OBJECT_NOT_FOUND);
    });

    it("delete removes an object and tolerates unknown keys", async () => {
      const storage = harness.createStorage();
      await storage.upload("doomed.bin", bytes(5), "application/octet-stream");

      await expect(storage.delete("doomed.bin")).resolves.toBeUndefined();
      const error = await storage.download("doomed.bin").catch((caught: unknown) => caught);
      expect((error as StoragePortError).code).toBe(StorageErrorCode.OBJECT_NOT_FOUND);

      await expect(storage.delete("never-existed.bin")).resolves.toBeUndefined();
    });

    it("getSignedUrl resolves a non-empty url", async () => {
      const storage = harness.createStorage();
      await storage.upload("signed.bin", bytes(1), "application/octet-stream");
      const url = await storage.getSignedUrl("signed.bin", 300);
      expect(url).not.toBe("");
    });

    it("list returns only objects under the prefix with their metadata", async () => {
      const storage = harness.createStorage();
      await storage.upload("reports/a.txt", bytes(1, 2), "text/plain");
      await storage.upload("reports/b.txt", bytes(3), "text/plain");
      await storage.upload("other/c.txt", bytes(4), "text/plain");

      const listed = await storage.list("reports/");
      expect(listed.map((object) => object.key).sort()).toEqual(["reports/a.txt", "reports/b.txt"]);
      const a = listed.find((object) => object.key === "reports/a.txt");
      expect(a?.size).toBe(2);
      expect(a?.contentType).toBe("text/plain");

      await expect(storage.list("nothing/")).resolves.toEqual([]);
    });
  });
}
