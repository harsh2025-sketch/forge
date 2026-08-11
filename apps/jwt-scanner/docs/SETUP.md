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
`@forge/domain`, `@forge/reporting`, `@forge/shared`, `@forge/ui`) through
`pnpm-workspace.yaml`. The product itself declares no vendor SDKs.

## Database setup

The product schema and the shared platform schema are applied with a single
command (V3 §6.5 — platform migrations run first, then product migrations):

```bash
DATABASE_URL=postgres://... pnpm --filter jwt-scanner db:migrate
```

The command is idempotent; re-running it after a successful apply is a no-op.
Migrations are tracked in `drizzle.__drizzle_migrations`.

## Environment variables

Configuration is validated through the `@forge/config` environment schema. The
Day-11 milestone requires a single variable; the rest are activated when their
providers are wired in later milestones:

| Variable | Purpose | Required |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | yes — `db:migrate` |
| `AUTH_SECRET` / provider keys | authentication provider credentials | when auth is wired |
| `BILLING_SECRET` | billing provider webhook secret | when billing is wired |
| `EMAIL_API_KEY` | email provider API key | when email is wired |
| `ANALYTICS_API_KEY` | analytics provider API key | when analytics is wired |
| `JOB_QUEUE_CONNECTION` | job queue connection string | when the worker is enabled |

Never commit real values; `.env*` files are gitignored and only `.env.example`
may be committed. Missing required variables cause `db:migrate` to fail fast
with a clear message (secret values are never logged).

## Verification

```bash
pnpm --filter jwt-scanner test     # domain, theme, schema, migration tests
pnpm arch-check                   # repository-wide boundary enforcement
pnpm validate-docs                # documentation completeness
pnpm extraction-validate jwt-scanner
```
