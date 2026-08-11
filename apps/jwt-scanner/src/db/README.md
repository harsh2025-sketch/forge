# src/db

Product-scoped PostgreSQL schema and migrations for JWT Scanner (V3 §6).

- `schema.ts` — the Drizzle schema: named schema `jwt_scanner` with the four
  analyzer persistence tables (`projects`, `analysis_jobs`, `findings`,
  `reports`). Tenant tables carry a non-null `organization_id` and every query
  on them uses the `withOrg()` helper from `@forge/db`.
- `migrations/` — deterministic drizzle-format SQL migrations
  (`meta/_journal.json` + `<tag>.sql`), applied after the platform migrations
  by `pnpm --filter jwt-scanner db:migrate` (V3 §6.5 ordering).
- `migrate.ts` — the product's migration runner; reuses `@forge/db`
  `migrateInOrder` (platform first, then product) and reads `DATABASE_URL`.

See docs/DATABASE.md.
