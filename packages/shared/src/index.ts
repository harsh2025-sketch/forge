/**
 * @forge/shared — Shared kernel primitives for the Forge Master SaaS Framework.
 *
 * Foundational Layer 0 package providing vendor-neutral, transport-neutral
 * primitives for Result handling, base AppError, and PaginationParams.
 */

// Result primitives
export type { Ok, Err, Result } from "./result.js";
export {
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  map,
  tryCatch,
} from "./result.js";

// Error primitives
export type { AppErrorOptions } from "./errors.js";
export {
  AppError,
  isAppError,
  toAppError,
} from "./errors.js";

// Pagination primitives
export type {
  PaginationParams,
  NormalizedPaginationParams,
  PaginationMetadata,
  PaginatedResult,
  PaginationDefaults,
} from "./pagination.js";
export {
  normalizePaginationParams,
  createPaginatedResult,
} from "./pagination.js";
