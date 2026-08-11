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
  and constructs findings and summaries in frozen taxonomy order
- `parser.ts` — strictly decodes base64url UTF-8 JSON and validates decoded
  header and payload objects without performing signature verification
- `types.ts` — product-specific domain types (finding taxonomy `none_alg`,
  `weak_hmac`, `alg_confusion`, `expired_claim`; JWT header/payload/evidence
  shapes)
- `schemas.ts` — Zod schemas for every external input (compact-JWT token,
  explicit evaluation time, algorithm policy, optional HMAC key-size metadata,
  and finding category)
- `__tests__/` — unit tests for the parser, engine, schemas, and types

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

The engine implements the analyzer contract (V3 §8.2), validates input and
configuration with the product Zod schemas, and returns a `Result`; every product
feature must call the engine through this contract and never bypass validation.
The deterministic pipeline is compact-format validation, strict header/payload
decoding, schema validation, header and claim analysis, algorithm-policy analysis,
and typed finding aggregation.

`evaluationTime` is a required JWT NumericDate in whole seconds. A finite numeric
`exp` uses `exp <= evaluationTime`, so a token is expired at the exact boundary.
An absent or non-numeric `exp` produces no expiration finding because the frozen
payload schema intentionally accepts open-ended claim values. The same evaluation
value produces the summary's ISO `generatedAt`; the engine never reads the system
clock. Optional `expectedAlgorithms` supplies the verifier's allow-list for static
algorithm-confusion detection. Optional `hmacKeyBits` is caller-observed metadata:
for HS256, HS384, and HS512 it is compared with the RFC 7518 minimum of 256, 384,
and 512 bits respectively. Missing metadata never implies secret compromise.

Findings are emitted in the frozen order `none_alg`, `weak_hmac`,
`alg_confusion`, `expired_claim`, then limited by `maxFindings`. Identifiers,
severity, descriptions, evidence, summary counts, metadata, and timestamps are
fully determined by token plus configuration. The engine has zero infrastructure
side effects: queries, persistence, jobs, HTTP, and provider calls belong to later
application features, not this domain milestone.

## Feature layer

`src/features/` holds the product feature modules (V3 §20.2 Day 13):

- `scans/` — scan submission, results, finding detail and report export.
  `service.ts` is the testable core (validation → authorization → engine →
  persistence → result); `actions.ts` is the thin Next.js server-action
  boundary; `persistence.ts` defines the product-local persistence seam with a
  Drizzle/PostgreSQL implementation (`drizzle-persistence.ts`) and a
  deterministic in-memory implementation (`memory-persistence.ts`) used by
  tests and `DATA_MODE=memory` runs. `report.ts` implements the
  `@forge/reporting` `ReportTemplate` contract — all export formats are
  rendered by the shared reporting pipeline.
- `billing/` — provider-neutral plans (`plans.ts`, mirrored in
  `product.manifest.ts`), checkout / portal / status flow through the
  `BillingPort`, and the `platform.subscriptions` projection
  (`subscription-persistence.ts`).
- `auth/` — org-scoped session resolution (`session.ts`), the request-bound
  Clerk session resolver (`session-resolver.ts`), and deterministic platform
  identity sync (`identity.ts`).

`src/components/` contains presentational components composed from `@forge/ui`
primitives (landing page, scan form, results view, finding detail, report
export links, billing plans, dashboard navigation). Components receive data
and callbacks via props; server actions and pages own the wiring.

`src/app/` is the Next.js App Router surface: the public landing page
(`/`), the protected dashboard (`/scanner`, `/scans/[jobId]`,
`/scans/[jobId]/findings/[findingId]`, `/billing`), the report export route
(`/scans/[jobId]/export`) and the billing webhook (`/api/webhooks/billing`).
The dashboard layout enforces authentication (redirect to `/` with an
`auth=required` hint) and resolves the organization context.

## Dependency flow

Application code depends on Forge ports (auth, billing, email, analytics, jobs,
storage, ai-provider) through the typed port packages. Adapters implement those ports,
and `src/providers.ts` is the only file allowed to import adapter packages. The flow
is:

application/domain code → Forge ports → providers.ts → adapter → vendor SDK

`src/providers.ts` is the composition root: it wires the Clerk AuthPort, the
Stripe BillingPort and webhook handler, and the persistence implementations,
and it selects the deterministic dev-mode seams when `AUTH_MODE=test`,
`BILLING_MODE=test`, or `DATA_MODE=memory` are set (see docs/PROVIDERS.md).

## Capabilities

The manifest declares the capabilities this product composes: `reporting`. Each
capability maps to a Forge subsystem (reporting) that is wired through
`src/providers.ts` when implemented. The manifest also declares the product's
billing plans (`free`, `pro`) with provider-neutral `priceId` identifiers
(P21) — pricing values are a human decision (V3 §22.2).

## Worker process

The product declares `requiresWorker: false`; a worker process is added during implementation if background jobs become necessary.

## Enforcement

`pnpm arch-check` enforces package boundaries, vendor containment, domain purity, and
dependency direction. `pnpm validate-docs` enforces documentation completeness. Both
run in CI and must pass before any deployment. The product's own docs describe each
enforced rule in detail.
