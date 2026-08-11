# extraction-validate

Forge V3 extraction validation gate. Validates a product after creation or
extraction, before it is considered compliant.

This is a repository-level developer tool. It is never imported by applications.

## Usage

```bash
pnpm extraction-validate <product> [--root <repository>] [--json <path>]
```

`<product>` is a product name (resolved as `apps/<name>`) or a path to a product
directory. Exit code `0` when there are no blocking violations, `1` when there
are, `2` for usage errors.

## What is validated

| # | Check | Rule prefix | Severity |
| --- | --- | --- | --- |
| 1 | Product manifest (present, static, frozen schema, identity) | `MANIFEST_*` | error |
| 2 | Product directory structure (`package.json`, `tsconfig.json`, `README.md`, `src/`, `src/providers.ts`, `docs/`) | `*_MISSING` | error |
| 3 | Required product documents | `MISSING_PRODUCT_DOCUMENT`, `PRODUCT_DOCUMENT_STUB`, `DOCUMENT_STRUCTURE`, `MISSING_REQUIRED_SECTION` | error |
| 4 | Package boundaries | `ARCHITECTURE_CHECK` (delegated) | error |
| 5 | Provider isolation (adapters only in `src/providers.ts`) | `ADAPTER_BYPASS` | error |
| 6 | Forbidden vendor imports | `VENDOR_LEAKAGE` | error |
| 7 | Forge package dependency direction | `ARCHITECTURE_CHECK` (delegated) / `UNKNOWN_FORGE_PACKAGE` | error |
| 8 | Unresolved dependencies | `UNRESOLVED_DEPENDENCY`, `RESOLUTION_UNVERIFIABLE` | error / warning |
| 9 | Required ports (capability → subsystem packages; providers wiring) | `CAPABILITY_DEPENDENCY`, `PROVIDER_WIRING` | error |
| 10 | Adapter access only through `providers.ts` | `ADAPTER_BYPASS` | error |
| 11 | Documentation completeness | `DOCUMENTATION` (delegated) | error |
| 12 | Extraction classification requirements (`extraction-report.json`) | `EXTRACTION_*`, `CLASSIFICATION_INCONSISTENT`, `REPORTED_FILE_MISSING` | error / warning |
| 13 | Architecture checker compatibility | `ARCHITECTURE_CHECK` (delegated) | error |

Every diagnostic identifies the rule, severity, file, line/column, an
explanation, and a remediation. Warnings never fail the gate; errors do.

## Modes

- **Repository mode** (the product is inside a repository that has
  `pnpm-workspace.yaml`): product-specific checks run locally, generic
  architecture enforcement is delegated to `@forge/architecture-check`
  (`pnpm arch-check`) and documentation completeness to `@forge/validate-docs`
  (`pnpm validate-docs`). Task 010 never re-implements the architecture checker.
- **Standalone mode** (temporary output directories): the product checks run
  fully locally; dependency resolution and full-repository checks are reported
  as warnings because they require a workspace installation.

## Validation chain

```
pnpm extraction-validate <product>
  → validate product structure
  → validate manifest
  → validate extraction state
  → pnpm arch-check      (delegated in repository mode)
  → pnpm validate-docs   (delegated in repository mode)
```

## Extraction report contract

An extracted product carries `extraction-report.json` at its root. The
validator enforces the classification requirements of the report:

- the report must parse and match `schemaVersion: 1`;
- the report status must be `complete` or `complete-with-manual-migration`;
- the report product id must match the manifest id;
- every manual migration item must carry a non-empty remediation;
- a file the report classifies `SAFE` must not import vendor SDKs
  (`CLASSIFICATION_INCONSISTENT`);
- files the report lists as copied should still exist (warning only).

## Limitations

- The validator verifies structure, boundaries, and documentation. It cannot
  prove that provider replacements are functionally correct — that is the job
  of the port conformance suites (`packages/testing/conformance`).
- Standalone validation cannot resolve workspace dependencies; integrate the
  product into a repository and run `pnpm install` for the full gate.
