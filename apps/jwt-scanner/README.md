# JWT Scanner

Scan JWTs for security issues

**Product ID:** `jwt-scanner` · **Primary archetype:** `analyzer` · **Capabilities:** `reporting`

## Overview

JWT Scanner is the first Forge V3 product, scaffolded with `pnpm create-product`
and implemented per the frozen framework plan (V3 §20.2 Days 11–13). It
implements the analyzer archetype contract in `src/domain/engine.ts`, safely
parses compact JWTs, and deterministically reports the frozen `none_alg`,
`weak_hmac`, `alg_confusion`, and `expired_claim` taxonomy. Day 13 adds the
product application: scan submission, results, finding detail, report export
(JSON/Markdown/HTML through `@forge/reporting`), the landing page, and the
Clerk (auth) / Stripe (billing) wiring behind the Forge ports. It follows the
frozen Forge architecture: pure domain logic, provider isolation behind ports,
product-scoped database schema, and machine-enforced package boundaries.

## Repository layout

- `src/domain/` — pure domain logic: engine (analyzer contract), product types
  (finding taxonomy: `none_alg`, `weak_hmac`, `alg_confusion`, `expired_claim`),
  Zod schemas, and unit tests
- `src/theme/` — design tokens (security-tool identity: dark palette, compact
  density, prominent severity colors) and the CSS variable application
- `src/db/` — product schema (`jwt_scanner` named schema: projects,
  analysis_jobs, findings, reports), drizzle migrations, migration runner,
  lazy database client
- `src/providers.ts` — the composition root; the only file allowed to import
  adapters (Clerk AuthPort, Stripe BillingPort + webhook, persistence)
- `src/features/` — feature modules: `scans/` (submission, results, finding
  detail, report export), `billing/` (plans, checkout, status), `auth/`
  (org-scoped session, identity sync)
- `src/components/` — presentational components composed from `@forge/ui`
- `src/app/` — Next.js App Router: landing page, protected dashboard, export
  route, billing webhook
- `src/dev-mode/` — deterministic test-mode port implementations (no
  credentials required)
- `e2e/` — Playwright critical path (signup → scan → findings → export)
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

Run the application without credentials or a database (test mode):

```bash
cd apps/jwt-scanner
AUTH_MODE=test BILLING_MODE=test DATA_MODE=memory pnpm dev
```
