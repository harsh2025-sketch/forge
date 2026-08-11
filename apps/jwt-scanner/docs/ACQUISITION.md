# JWT Scanner Acquisition

## Extraction

JWT Scanner is acquisition-ready by construction (frozen principle P15): the
product survives extraction at any time. Extraction produces a standalone repository
containing the product code, its documentation, its provider wiring, and its database
schema. The extraction flow is:

1. `pnpm extract-product` produces the product archive and the extraction report
   describing every file, dependency, and provider integration.
2. `pnpm extraction-validate` verifies the extracted product against the frozen
   structure, manifest, documentation, and provider isolation rules.
3. `pnpm arch-check` and `pnpm validate-docs` run on the extracted repository as the
   final gates.

## Data handoff

Every persistent record belonging to JWT Scanner is identifiable and extractable
without redesign (frozen principle P20). The product schema is product-scoped, and
tenant data is scoped by `organization_id`, so the acquiring team exports only the
product's schema and rows.

## Provider migration

The acquiring team replaces the product's providers as part of the handoff: auth,
billing, email, analytics, jobs, storage, and AI providers are swapped by implementing
or selecting adapters that pass the port conformance suites and updating
`src/providers.ts` (see `docs/PROVIDERS.md`). Application and domain code are not
modified by a provider change.

## What the acquirer receives

- the full product source with domain tests and documentation
- the product manifest and provider wiring
- the database schema, migrations, and an export of product-scoped data
- the extraction report listing all manual migration items with remediations

## Manual migration workflow

Items classified MANUAL in the extraction report are never silently transformed; each
carries a remediation note. The acquiring team works through the list, re-running
`pnpm extraction-validate` after each item until the product is compliant.
