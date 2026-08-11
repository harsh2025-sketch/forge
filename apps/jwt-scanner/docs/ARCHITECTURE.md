# JWT Scanner Architecture

## Overview

JWT Scanner (product id `jwt-scanner`) is a analyzer product built on the Forge V3
framework. It is a self-contained application under `apps/jwt-scanner/` with its own package
manifest, domain code, provider wiring, and documentation. The product follows the
frozen Forge architecture: domain logic stays pure, providers are swappable behind
ports, and every boundary is machine-enforced by `pnpm arch-check` and
`pnpm validate-docs`.

## Domain model

The product's domain lives in `src/domain/` and contains:

- `engine.ts` — implements the analyzer archetype contract from `@forge/domain`
- `types.ts` — product-specific domain types (finding taxonomy `none_alg`,
  `weak_hmac`, `alg_confusion`, `expired_claim`; JWT header/payload/evidence
  shapes)
- `schemas.ts` — Zod schemas for every external input (compact-JWT token,
  scan config, finding category)
- `__tests__/` — unit tests for the engine, schemas, and types

Domain code may import only `@forge/shared`, `@forge/domain`, Zod, and local files.
It never imports Next.js, React, database packages, adapters, or vendor SDKs.

## Theme

`src/theme/tokens.ts` defines the product's visual identity through the frozen
`ThemeTokens` contract from `@forge/ui` (P13): dark navy surface, compact
density, prominent severity colors, narrow sidebar. `src/theme/globals.css` is
generated deterministically from the tokens via `themeToCss` and stays in sync
with them (enforced by the theme tests).

## Database

`src/db/schema.ts` defines the product-scoped `jwt_scanner` schema (projects,
analysis_jobs, findings, reports) with non-null `organization_id` on every
tenant table. Migrations live in `src/db/migrations/` and run platform-first
through `src/db/migrate.ts` (V3 §6.5). See `docs/DATABASE.md`.

## Engine contract

The engine implements the analyzer contract (V3 §8.2). The skeleton validates its
input with the Zod schemas and returns a `Result`; every product feature must call the
engine through this contract and never bypass validation. The engine has zero side
effects: infrastructure (queries, jobs, external calls) lives in `src/features/` or
middleware.

## Dependency flow

Application code depends on Forge ports (auth, billing, email, analytics, jobs,
storage, ai-provider) through the typed port packages. Adapters implement those ports,
and `src/providers.ts` is the only file allowed to import adapter packages. The flow
is:

application/domain code → Forge ports → providers.ts → adapter → vendor SDK

## Capabilities

The manifest declares the capabilities this product composes: `reporting`. Each
capability maps to a Forge subsystem (reporting) that is wired through
`src/providers.ts` when implemented.

## Worker process

The product declares `requiresWorker: false`; a worker process is added during implementation if background jobs become necessary.

## Enforcement

`pnpm arch-check` enforces package boundaries, vendor containment, domain purity, and
dependency direction. `pnpm validate-docs` enforces documentation completeness. Both
run in CI and must pass before any deployment. The product's own docs describe each
enforced rule in detail.
