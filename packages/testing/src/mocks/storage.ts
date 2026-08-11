/**
 * Mock storage adapter — real behavioral in-memory implementation of
 * StoragePort. Objects are held in a Map keyed by object key; uploads accept
 * both buffered and streamed payloads; signed URLs are deterministic mock
 * URLs. V3 §3.2 (packages/testing/src/mocks/), Day 5.
 */

import {
  StorageErrorCode,
  StoragePortError,
  type ContentType,
  type ObjectKey,
  type StorageData,
  type StorageObject,
  type StoragePort,
} from "@forge/storage";

interface StoredObject {
  bytes: Uint8Array;
  contentType: ContentType;
  lastModifiedAt: string;
}

function concatChunks(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function materialize(data: StorageData): Promise<Uint8Array> {
  if (data instanceof Uint8Array) {
    return new Uint8Array(data);
  }
  const chunks: Uint8Array[] = [];
  for await (const chunk of data) {
    chunks.push(chunk);
  }
  return concatChunks(chunks);
}

/** Creates an in-memory StoragePort. */
export function createMockStoragePort(): StoragePort {
  const objects = new Map<ObjectKey, StoredObject>();

  async function upload(key: ObjectKey, data: StorageData, contentType: ContentType): Promise<ObjectKey> {
    objects.set(key, {
      bytes: await materialize(data),
      contentType,
      lastModifiedAt: new Date().toISOString(),
    });
    return key;
  }

  async function download(key: ObjectKey): Promise<Uint8Array> {
    const stored = objects.get(key);
    if (stored === undefined) {
      throw new StoragePortError(`Object not found: ${key}`, {
        code: StorageErrorCode.OBJECT_NOT_FOUND,
        details: { key },
      });
    }
    return new Uint8Array(stored.bytes);
  }

  async function getSignedUrl(key: ObjectKey, expiresIn: number): Promise<string> {
    return `mock-storage://${encodeURIComponent(key)}?expiresIn=${expiresIn}`;
  }

  async function del(key: ObjectKey): Promise<void> {
    objects.delete(key);
  }

  async function list(prefix: string): Promise<readonly StorageObject[]> {
    const matches: StorageObject[] = [];
    for (const [key, stored] of objects) {
      if (key.startsWith(prefix)) {
        matches.push({
          key,
          size: stored.bytes.byteLength,
          contentType: stored.contentType,
          lastModifiedAt: stored.lastModifiedAt,
        });
      }
    }
    matches.sort((a, b) => a.key.localeCompare(b.key));
    return matches;
  }

  return { upload, download, getSignedUrl, delete: del, list };
}
