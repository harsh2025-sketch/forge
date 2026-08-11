# create-product

Forge V3 product scaffolding tool. Generates a validated product skeleton under
`apps/<product-id>/` of the Forge repository.

This is a repository-level developer tool. It is never imported by applications.

## Usage

```bash
pnpm create-product <product-name> [options]
```

| Option | Description |
| --- | --- |
| `--archetype <type>` | Primary archetype: `analyzer` (default), `optimizer`, `generator`, `transformer`, `middleware`, `gateway` |
| `--capabilities <list>` | Comma-separated capabilities, e.g. `reporting,scheduling` |
| `--display-name <text>` | Human-readable product name (default: derived from the id) |
| `--tagline <text>` | Product tagline (default: derived from the archetype) |
| `--requires-worker` | Declare `requiresWorker: true` in the manifest |
| `--requires-ai` | Declare `requiresAIProvider: true` in the manifest |
| `--manifest <path>` | Scaffold from an existing `product.manifest.ts` (values are read statically; the file is never executed) |
| `--root <repository>` | Repository root (default: current directory) |
| `-h`, `--help` | Show help |

Examples:

```bash
pnpm create-product jwt-scanner --archetype analyzer --capabilities reporting
pnpm create-product api-gateway --archetype gateway --manifest=product.manifest.ts
```

## What is generated

```
apps/<product-id>/
├── product.manifest.ts        # Static manifest (defineProductManifest with literals)
├── README.md
├── package.json               # Forge workspace deps only; no vendor SDKs
├── tsconfig.json
├── docs/                      # The ten required product documents (>200 words each)
│   ├── ARCHITECTURE.md  SETUP.md  DEPLOYMENT.md  DATABASE.md
│   ├── PROVIDERS.md  API.md  TESTING.md  SECURITY.md
│   └── OPERATIONS.md  ACQUISITION.md
└── src/
    ├── providers.ts           # Composition root — the only file allowed to import adapters
    ├── domain/                # Pure domain logic
    │   ├── engine.ts          # Implements the archetype contract from @forge/domain
    │   ├── types.ts  schemas.ts
    │   └── __tests__/engine.test.ts
    ├── app/  features/  db/  theme/   # Frozen structure (documented, not yet implemented)
    └── worker/                # Only when --requires-worker
```

## Guarantees

- **Valid product identity** — the id is a slug matching the frozen manifest rule.
- **Valid product manifest** — composed values are gated through
  `validateProductManifest` from `@forge/config` before anything is written.
- **Provider isolation** — `src/providers.ts` is the only adapter entry point.
- **No vendor SDKs by default** — the generated `package.json` contains no vendor
  SDK dependencies.
- **No database implementation** — the skeleton ships no schema or query code;
  `src/db/` documents where persistence is added during implementation.
- **Passes validation immediately** — a generated product passes `pnpm arch-check`,
  `pnpm validate-docs`, and `pnpm extraction-validate <product-id>`.
- **Deterministic** — identical options produce byte-identical output.
- **Safe** — refuses to overwrite an existing product; writes only inside the new
  product directory; never executes user-provided manifests.

## Capability mapping

Declared capabilities add the matching Forge subsystem to `package.json`:

| Capability / flag | Workspace dependency |
| --- | --- |
| `reporting` | `@forge/reporting` |
| `scheduling` | `@forge/jobs` |
| `ai-assisted` | `@forge/ai-provider` |
| `requiresWorker` | `@forge/jobs` |
| `requiresAIProvider` | `@forge/ai-provider` |

## Limitations

- The skeleton is tooling-level scaffolding, not a finished product: the Next.js
  application layer, Docker files, database schema, and E2E tests are added during
  product implementation (per the Task 010 boundary).
- Only static literal manifests are accepted; dynamic manifest values are rejected.
