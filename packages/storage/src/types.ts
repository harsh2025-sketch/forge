/**
 * @forge/storage types — provider-neutral object storage types.
 * V3 §3.2 (packages/storage), §5.2 (StoragePort contract), P21.
 *
 * Objects are addressed by a plain key. Buckets, containers, regions and
 * credentials are adapter concerns and never appear in this contract.
 */

import { AppError, type AppErrorOptions } from "@forge/shared";

/** Provider-neutral address of a stored object. */
export type ObjectKey = string;

/** IANA media type of a stored object. */
export type ContentType = string;

/**
 * Binary payload accepted by the port.
 *
 * `Uint8Array` covers buffered payloads (Node's Buffer is a `Uint8Array`), and
 * `AsyncIterable<Uint8Array>` covers streamed payloads without binding the port
 * to any runtime's stream class.
 */
export type StorageData = Uint8Array | AsyncIterable<Uint8Array>;

/** ISO-8601 timestamp. Strings keep the contract serialization-safe. */
export type StorageTimestamp = string;

/** Describes a stored object without transferring its contents. */
export interface StorageMetadata {
  /** Size in bytes. */
  readonly size: number;
  readonly contentType?: ContentType;
  readonly lastModifiedAt?: StorageTimestamp;
}

/** A stored object listing entry. */
export interface StorageObject extends StorageMetadata {
  readonly key: ObjectKey;
}

/** Stable, provider-neutral failure codes for storage operations. */
export const StorageErrorCode = {
  /** The requested key does not exist. */
  OBJECT_NOT_FOUND: "STORAGE_OBJECT_NOT_FOUND",
  /** The provider behind the port failed for any other reason. */
  PROVIDER_FAILURE: "STORAGE_PROVIDER_FAILURE",
} as const;

export type StorageErrorCode = (typeof StorageErrorCode)[keyof typeof StorageErrorCode];

export interface StoragePortErrorOptions extends Omit<AppErrorOptions, "code"> {
  readonly code?: StorageErrorCode;
}

/**
 * Error raised by storage port implementations.
 *
 * Adapters translate provider failures into this type so callers never depend
 * on a provider's error shape.
 */
export class StoragePortError extends AppError {
  constructor(message: string, options?: StoragePortErrorOptions) {
    super(message, {
      code: options?.code ?? StorageErrorCode.PROVIDER_FAILURE,
      details: options?.details,
      cause: options?.cause,
    });
  }
}
