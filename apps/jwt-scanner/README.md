# JWT Scanner

Scan JWTs for security issues

**Product ID:** `jwt-scanner` · **Primary archetype:** `analyzer` · **Capabilities:** `reporting`

## Overview

JWT Scanner is the first Forge V3 product, scaffolded with `pnpm create-product`
and implemented per the frozen framework plan (V3 §20.2 Day 11). It implements
the analyzer archetype contract in `src/domain/engine.ts` and follows the
frozen Forge architecture: pure domain logic, provider isolation behind ports,
product-scoped database schema, and machine-enforced package boundaries.

## Repository layout

- `src/domain/` — pure domain logic: engine (analyzer contract), product types
  (finding taxonomy: `none_alg`, `weak_hmac`, `alg_confusion`, `expired_claim`),
  Zod schemas, and unit tests
- `src/theme/` — design tokens (security-tool identity: dark palette, compact
  density, prominent severity colors) and the CSS variable application
- `src/db/` — product schema (`jwt_scanner` named schema: projects,
  analysis_jobs, findings, reports), drizzle migrations, migration runner
- `src/providers.ts` — the composition root; the only file allowed to import adapters
- `src/features/` — feature modules (Server Actions, queries, components) —
  implemented in a later milestone
- `docs/` — the ten required product documents

## Quick start

```bash
pnpm install
pnpm build
pnpm test
pnpm arch-check
pnpm validate-docs
DATABASE_URL=postgres://... pnpm --filter jwt-scanner db:migrate
```
