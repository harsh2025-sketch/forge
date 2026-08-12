# create-product

Forge V3 product scaffolding tool. Generates a validated, runnable product
skeleton under `apps/<product-id>/` of the Forge repository.

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
pnpm create-product license-scanner --archetype analyzer --capabilities reporting
pnpm create-product api-gateway --archetype gateway
```

## What is generated

```
apps/<product-id>/
├── product.manifest.ts        # Static manifest (archetype, capabilities, providers, env)
├── README.md
├── package.json               # Next.js + Forge workspace deps; no vendor SDKs
├── tsconfig.json
├── next.config.mjs
├── vitest.config.ts
├── playwright.config.ts
├── Dockerfile / docker-compose.yml
├── .env.example
├── e2e/smoke.spec.ts          # Landing + health smoke tests
├── docs/                      # The ten required product documents
└── src/
    ├── providers.ts           # Composition root — test-mode AuthPort + BillingPort
    ├── dev-mode/              # Product-local test seams (not @forge/testing)
    ├── domain/                # Archetype engine, Zod schemas, unit tests
    ├── app/                   # Next.js landing, workspace, /api/health
    ├── components/landing/    # Product-owned landing (not JWT Scanner)
    ├── theme/                 # Design tokens starting from the framework baseline
    ├── db/                    # Named schema + tenant-scoped records table
    ├── features/auth/         # Session helper over AuthPort
    └── worker/                # Only when --requires-worker
```

## Guarantees

- **Valid product identity** — the id is a slug matching the frozen manifest rule.
- **Valid product manifest** — composed values are gated through
  `validateProductManifest` from `@forge/config` before anything is written.
- **Provider isolation** — `src/providers.ts` is the only adapter entry point.
- **No vendor SDKs by default** — the generated `package.json` contains no vendor
  SDK dependencies. Live Clerk/Stripe adapters are added later by the product.
- **Runs without credentials** — `AUTH_MODE=test BILLING_MODE=test DATA_MODE=memory`.
- **Independent visual identity** — tokens start from `@forge/ui` `defaultTheme`,
  not from JWT Scanner's dark security-tool theme.
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

Every product also receives the reusable SaaS boundary packages: `@forge/auth`,
`@forge/billing`, `@forge/db`, and `@forge/ui`.

## Limitations

- The scaffold is a runnable product shell, not a finished SaaS. Domain algorithms,
  product-specific screens, and live provider credentials are still supplied by
  the product team.
- Only static literal manifests are accepted; dynamic manifest values are rejected.
