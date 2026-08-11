# extract-product

Forge V3 extraction tool. Imports an existing application into the Forge V3
product structure with deterministic classification (SAFE / REVIEW / MANUAL)
and a machine-readable extraction report.

This is a repository-level developer tool. It is never imported by applications.

## Usage

```bash
pnpm extract-product <source> <destination> [options]
```

| Option | Description |
| --- | --- |
| `--name <product-id>` | Product id (slug). Default: derived from the source directory name |
| `--archetype <type>` | Primary archetype (`analyzer`, `optimizer`, `generator`, `transformer`, `middleware`, `gateway`). Default: `analyzer`, flagged as a manual review item — the archetype is never inferred from code |
| `--capabilities <list>` | Comma-separated capabilities, e.g. `reporting,scheduling` |
| `--requires-worker` | Declare `requiresWorker: true` in the manifest |
| `--requires-ai` | Declare `requiresAIProvider: true` in the manifest |
| `--root <repository>` | Forge repository root (report context only) |
| `-h`, `--help` | Show help |

The destination must not exist. Nothing is ever overwritten or deleted.

## What the extractor does

1. **Inspect** the source application (files, package.json, imports).
2. **Classify** every file and dependency as `SAFE`, `REVIEW`, or `MANUAL`.
3. **Create** the Forge product structure at the destination.
4. **Isolate providers** — `src/providers.ts` is generated as the composition
   root; a pre-existing providers file is archived as
   `src/providers.original.ts`.
5. **Generate** `product.manifest.ts`, `package.json` (Forge deps +
   framework-safe deps only), `tsconfig.json`, `README.md`, and any missing
   required documentation.
6. **Preserve** source documentation: an existing `README.md`, `tsconfig.json`,
   or any of the ten required docs wins over the generated template.
7. **Report** — `extraction-report.json` (machine-readable) and
   `extraction-report.md` (human-readable) at the destination root.

## Classification model

| Classification | Meaning | Examples |
| --- | --- | --- |
| `SAFE` | Copied as-is; no review required | ordinary source files, pure utility code, UI components, docs, assets |
| `REVIEW` | Copied, but the integration must be reviewed and migrated | database access, authentication, billing, email, analytics, background jobs, storage, AI provider calls, webhooks, any unclassified external dependency |
| `MANUAL` | Not safely transformable; requires human migration | vendor SDK code inside domain paths, hardcoded secrets, dynamic `import()`/`require()` with computed specifiers, deep vendor coupling (3+ vendor SDKs in one file), excluded infrastructure (Prisma, Redis, BullMQ, ...) |

The extractor never silently rewrites ambiguous code. Files it cannot transform
safely are copied as-is (or archived) and listed as `MANUAL` with a remediation
note — the product is not compliant until each item is resolved.

## Extraction report format

`extraction-report.json` contains (all arrays deterministically sorted):

| Field | Content |
| --- | --- |
| `schemaVersion`, `tool` | Report schema and tool identity |
| `productId`, `source`, `destination` | Product identity and paths as provided |
| `status` | `complete`, `complete-with-manual-migration`, or `failed` |
| `filesDiscovered` | Per file: path, destination path, size, kind, classification, disposition (`COPY`/`TRANSFORM`/`EXCLUDE`), vendor imports, reason |
| `filesCopied` / `filesTransformed` / `filesExcluded` | Destination paths by disposition |
| `providerIntegrations` | Vendor, category, target Forge port, files, recommendation |
| `dependencyClassifications` | Dependency root, classification, category, files using it |
| `architectureViolations` | Static violations with rule, message, remediation |
| `manualMigrationItems` | id, area, description, remediation, blocking |
| `warnings`, `errors` | Non-fatal and fatal issues |
| `generated` | What the tool generated (manifest, providers, package.json, docs) |

## Security

The source is treated as untrusted input:

- no source code is ever executed
- symbolic links are never followed
- lockfiles, `.env*` (except `.env.example`), and credential files are excluded
- all writes are confined to the destination (path traversal is refused)
- nothing is ever deleted; an existing destination is an error
- no shells are spawned and no dependency installation is performed

## Limitations

- Extraction is deterministic and honest, not magical: items the tool cannot
  safely transform are reported as `MANUAL`, and the primary archetype is
  always confirmed by a human.
- Vendor SDKs are **not** carried into the generated `package.json`; each
  integration must be migrated behind its Forge port (see `docs/PROVIDERS.md`
  in the extracted product).
- This tool implements the *import* direction (existing application → Forge
  product). The *acquisition* direction (Forge product → standalone repository,
  master architecture §16) is a separate flow.
