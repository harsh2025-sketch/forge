import { describe, it, expect } from "vitest";
import { AppError } from "@forge/shared";
import * as storagePackage from "../index.js";
import {
  StorageErrorCode,
  StoragePortError,
  type ObjectKey,
  type StorageData,
  type StorageObject,
} from "../index.js";
import type { StoragePort } from "../index.js";

async function collect(data: StorageData): Promise<Uint8Array> {
  if (data instanceof Uint8Array) {
    return data;
  }

  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of data) {
    chunks.push(chunk);
    size += chunk.length;
  }

  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

/** A dummy in-memory provider proving the port is implementable without a vendor. */
function createDummyStorageProvider(): StoragePort {
  const objects = new Map<ObjectKey, { bytes: Uint8Array; contentType: string }>();

  return {
    async upload(key, data, contentType) {
      objects.set(key, { bytes: await collect(data), contentType });
      return key;
    },
    async download(key) {
      const stored = objects.get(key);
      if (stored === undefined) {
        throw new StoragePortError(`Object not found: ${key}`, {
          code: StorageErrorCode.OBJECT_NOT_FOUND,
          details: { key },
        });
      }
      return stored.bytes;
    },
    async getSignedUrl(key, expiresIn) {
      return `https://storage.test/${key}?expires_in=${expiresIn}`;
    },
    async delete(key) {
      objects.delete(key);
    },
    async list(prefix) {
      const entries: StorageObject[] = [];
      for (const [key, stored] of objects) {
        if (key.startsWith(prefix)) {
          entries.push({
            key,
            size: stored.bytes.length,
            contentType: stored.contentType,
            lastModifiedAt: "2026-01-01T00:00:00.000Z",
          });
        }
      }
      return entries;
    },
  };
}

const encoder = new TextEncoder();

describe("StoragePort contract", () => {
  it("is implementable by a dummy provider and round-trips buffered data", async () => {
    const provider = createDummyStorageProvider();
    const payload = encoder.encode("report contents");

    await expect(provider.upload("reports/r1.json", payload, "application/json")).resolves.toBe(
      "reports/r1.json"
    );
    await expect(provider.download("reports/r1.json")).resolves.toEqual(payload);
  });

  it("accepts streamed data without binding to a runtime stream type", async () => {
    const provider = createDummyStorageProvider();
    const stream: AsyncIterable<Uint8Array> = {
      async *[Symbol.asyncIterator]() {
        yield encoder.encode("chunk-1;");
        yield encoder.encode("chunk-2");
      },
    };

    await provider.upload("reports/r2.txt", stream, "text/plain");

    const downloaded = await provider.download("reports/r2.txt");
    expect(new TextDecoder().decode(downloaded)).toBe("chunk-1;chunk-2");
  });

  it("issues time-limited access URLs", async () => {
    const provider = createDummyStorageProvider();

    await expect(provider.getSignedUrl("reports/r1.json", 900)).resolves.toBe(
      "https://storage.test/reports/r1.json?expires_in=900"
    );
  });

  it("lists objects by prefix with neutral metadata", async () => {
    const provider = createDummyStorageProvider();
    await provider.upload("reports/a.json", encoder.encode("a"), "application/json");
    await provider.upload("exports/b.csv", encoder.encode("bb"), "text/csv");

    const listed = await provider.list("reports/");

    expect(listed).toEqual([
      {
        key: "reports/a.json",
        size: 1,
        contentType: "application/json",
        lastModifiedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("deletes objects and treats deleting an unknown key as a no-op", async () => {
    const provider = createDummyStorageProvider();
    await provider.upload("reports/a.json", encoder.encode("a"), "application/json");

    await provider.delete("reports/a.json");
    await expect(provider.delete("reports/a.json")).resolves.toBeUndefined();
    await expect(provider.list("reports/")).resolves.toEqual([]);
  });

  it("throws StoragePortError with OBJECT_NOT_FOUND on a missing download", async () => {
    const provider = createDummyStorageProvider();

    const error = await provider.download("missing.json").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(StoragePortError);
    expect((error as StoragePortError).code).toBe(StorageErrorCode.OBJECT_NOT_FOUND);
    expect((error as StoragePortError).details).toEqual({ key: "missing.json" });
  });
});

describe("StoragePortError", () => {
  it("extends AppError and defaults to PROVIDER_FAILURE", () => {
    const error = new StoragePortError("storage unavailable");

    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe("StoragePortError");
    expect(error.code).toBe(StorageErrorCode.PROVIDER_FAILURE);
  });
});

describe("package exports", () => {
  it("exposes exactly the runtime exports of the port", () => {
    expect(Object.keys(storagePackage).sort()).toEqual(["StorageErrorCode", "StoragePortError"]);
  });
});
