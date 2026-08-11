# JWT Scanner Setup

## Prerequisites

- Node.js 22 or newer and pnpm 8 or newer (the repository pins the package manager)
- PostgreSQL 16 or newer for local development (the product uses a named
  `jwt_scanner` schema inside a shared PostgreSQL instance)

## Installation

From the repository root:

```bash
pnpm install
pnpm build
```

The product resolves its workspace dependencies (`@forge/config`, `@forge/db`,
`@forge/domain`, `@forge/reporting`, `@forge/shared`, `@forge/ui`,
`@forge/auth`, `@forge/billing`, `@forge/adapter-clerk`,
`@forge/adapter-stripe`) through `pnpm-workspace.yaml`. The product declares no
vendor SDKs directly; vendor code lives in the adapter packages.

## Running the application

The product is a Next.js application (App Router). Local development:

```bash
cd apps/jwt-scanner
pnpm dev          # next dev on http://localhost:3000
```

A deterministic local/test run needs no credentials and no database:

```bash
AUTH_MODE=test BILLING_MODE=test DATA_MODE=memory pnpm dev
```

This signs in a fixed test principal (`scanner@example.test`) in one
organization, uses the in-memory billing seam, and stores scans in memory.

## Database setup

The product schema and the shared platform schema are applied with a single
command (V3 §6.5 — platform migrations run first, then product migrations):

```bash
DATABASE_URL=postgres://... pnpm --filter jwt-scanner db:migrate
```

The command is idempotent; re-running it after a successful apply is a no-op.
Migrations are tracked in `drizzle.__drizzle_migrations`.

## Environment variables

Configuration is validated through the `@forge/config` environment schema
(`src/providers.ts`). Secret values are never logged.

| Variable | Purpose | Required |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | yes for `db:migrate` and `DATA_MODE=postgres` |
| `AUTH_MODE` | `live` (default) or `test` (deterministic auth seam) | no |
| `CLERK_SECRET_KEY` | Clerk backend secret key (live auth) | yes in live mode |
| `AUTH_SIGN_IN_URL` | Clerk-hosted sign-in URL used by the landing CTA (live) | recommended in live mode |
| `BILLING_MODE` | `live` (default) or `test` (in-memory billing seam) | no |
| `STRIPE_SECRET_KEY` | Stripe secret key (live billing) | yes in live mode |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | yes for live webhooks |
| `DATA_MODE` | `postgres` (default) or `memory` (in-memory persistence) | no |
| `APP_URL` | Public base URL used to build checkout success/cancel URLs | recommended in live mode |

Never commit real values; `.env*` files are gitignored and only `.env.example`
may be committed. Missing required variables cause the affected operation to
fail fast with a clear message that never includes the secret value.

## Verification

```bash
pnpm --filter jwt-scanner test     # domain, feature, integration, component tests
pnpm --filter jwt-scanner e2e      # Playwright critical path (test mode; see docs/TESTING.md)
pnpm arch-check                    # repository-wide boundary enforcement
pnpm validate-docs                 # documentation completeness
pnpm extraction-validate jwt-scanner
```
