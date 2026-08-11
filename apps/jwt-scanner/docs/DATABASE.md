# JWT Scanner Database

## Schema

JWT Scanner follows the frozen Forge data model: PostgreSQL with Drizzle, one
product-scoped named schema (`jwt_scanner`), and no ORM inside domain code. The
schema is defined in `src/db/schema.ts` and covers the analyzer persistence
model (V3 §8.2):

| Table | Purpose | Tenant scope |
| --- | --- | --- |
| `jwt_scanner.projects` | scanning targets owned by an organization | `organization_id` NOT NULL → `platform.organizations` |
| `jwt_scanner.analysis_jobs` | one scan run per project | `organization_id` NOT NULL → `platform.organizations` |
| `jwt_scanner.findings` | analysis output rows (severity, category, evidence) | `organization_id` NOT NULL → `platform.organizations` |
| `jwt_scanner.reports` | exported report documents per job | `organization_id` NOT NULL → `platform.organizations` |

### Schema rules

- Every tenant-scoped table carries a non-null `organization_id` column
  (V3 §6.4). Queries against tenant tables must use the `withOrg()` scoping
  helper from `@forge/db`.
- Shared vocabulary is imported from the frozen contracts, never duplicated:
  severity and job status enums come from `@forge/domain`, and the finding
  category enum uses the product taxonomy (`none_alg`, `weak_hmac`,
  `alg_confusion`, `expired_claim`) defined in `src/domain/types.ts`.
- Product tables live in the product's own named schema so that data remains
  separable (frozen principle P20). Extraction follows the V3 §6.6 chain:
  `platform.products` → `platform.organizations` → `projects` →
  `analysis_jobs` → `findings` / `reports`.
- Credential material is never stored: job and finding records contain no
  token, secret, or signature columns (V3 §11.3).

## Migrations

Migrations live in `src/db/migrations/` in drizzle-format (`meta/_journal.json`
plus `<tag>.sql`). Execution order is deterministic and matches V3 §6.5:

1. platform migrations (`packages/db/src/migrations` — shared schema)
2. product migrations (`apps/jwt-scanner/src/db/migrations`)

Apply both with:

```bash
DATABASE_URL=postgres://... pnpm --filter jwt-scanner db:migrate
```

The runner reuses `@forge/db`'s `migrateInOrder` (`src/db/migrate.ts`) and is
idempotent: applied migrations are tracked in `drizzle.__drizzle_migrations`
and never re-executed. Migrations are append-only: existing migrations are
never edited after they have been applied.

## Access paths

Application code queries the database through the feature layer
(`src/features/scans/drizzle-persistence.ts`,
`src/features/billing/drizzle-subscription-persistence.ts`), never from domain
code. Domain logic receives plain data and returns `Result` values; the
database is an implementation detail of the feature layer (V3 §20.2 Day 13).
Every tenant-scoped query uses the `withOrg()` scoping helper, and the same
contract is enforced by the deterministic in-memory implementations used in
tests and `DATA_MODE=memory` runs.

## Extraction strategy

All product data is identifiable and extractable without redesign (frozen
principle P20): `pg_dump --schema=jwt_scanner` exports the product's tables,
and the platform rows for the product's organizations are exported from the
shared tables. The `docs/ACQUISITION.md` document explains the full export
procedure.

## Local development

Use a local PostgreSQL instance (for example via Docker) and set `DATABASE_URL`
in the environment before running `pnpm --filter jwt-scanner db:migrate`.
