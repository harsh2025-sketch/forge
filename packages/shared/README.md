# @forge/shared

Shared kernel primitives for the Forge Master SaaS Framework (Layer 0).

## Purpose

`@forge/shared` provides the foundational, zero-dependency, vendor-neutral, and transport-neutral primitives used across Forge packages, ports, adapters, and SaaS products.

## Primitives

### 1. Result (`result.ts`)
Functional error handling primitive (`Result<T, E>`) for domain engines and server actions:
- `ok(value)` / `err(error)` constructors
- `isOk(result)` / `isErr(result)` type guards
- `unwrap(result)` / `unwrapOr(result, fallback)` accessors
- `map(result, fn)` value transform
- `tryCatch(fn, mapError?)` exception wrapper

### 2. Error (`errors.ts`)
Transport-neutral structured error representation:
- `AppError` base class with `code`, `details`, and `cause`
- `isAppError(error)` type guard
- `toAppError(error, fallbackMessage?)` normalization helper

### 3. Pagination (`pagination.ts`)
Database-neutral pagination types and helpers:
- `PaginationParams`, `NormalizedPaginationParams`, `PaginationMetadata`, `PaginatedResult<T>`
- `normalizePaginationParams(params?, defaults?)` sanitizer
- `createPaginatedResult(items, total, params)` response builder

## Package Boundaries

- Allowed dependencies: Node.js standard library only (zero external runtime dependencies).
- Forbidden dependencies: Next.js, React, database libraries, ORMs, vendor SDKs, product code.
