# Forge — Master SaaS Framework

Forge is a **modular monolith** that powers **20 independent SaaS products** from a single repository. Each product is a self-contained Next.js application with isolated database schema and domain logic — yet all share a common infrastructure of **ports**, **adapters**, and **shared utilities**.

Every product in Forge is designed to be **acquisition-ready**: it can be extracted from the monorepo at any time and deployed as a standalone application.

## Quick Links

- **[Framework Architecture](./docs/FRAMEWORK.md)** — Philosophy, repository structure, technology stack
- **[Product Archetypes](./docs/ARCHETYPES.md)** — 6 product types and their contracts
- **[Frozen Principles](./.\ai\architecture-rules.md)** — 22 immutable architectural rules
- **[Import Boundaries](./\.ai\boundaries.md)** — Package dependency graph (machine-enforced)
- **[Implementation Patterns](./\.ai\patterns)** — Server Actions, engines, adapters, jobs

## Core Concepts

### Modular Monolith, Not Microservices

Each product is a complete Next.js full-stack application (web + optional worker). Products do not scale independently; they scale together. This simplicity makes solo development feasible.

### Frozen Architecture

The 22 principles are immutable. Violations are machine-enforced by:
- **ESLint boundaries plugin** — Prevents forbidden imports
- **TypeScript project references** — Catches circular dependencies
- **arch-check tool** — Validates vendor isolation, domain purity, infrastructure separation

### One Port, One Adapter

Every external capability (auth, billing, email, jobs, storage) is accessed through a **port interface**. Each port has exactly one adapter implementation at any time.

Replacing a provider requires:
1. Implementing a new adapter
2. Passing conformance tests
3. Updating `apps/[product]/src/providers.ts`
4. Zero business logic changes

### Domain Purity

Business logic lives in `src/domain/engine.ts` as pure functions:

```typescript
export async function execute(
  input: Input,
  config: Config,
  onProgress: (p: number) => void
): Promise<Result<Output, Error>> {
  // Pure domain logic
  // Zero imports: next, react, @forge/db, vendor SDKs, adapters
  // Only: zod, @forge/shared, @forge/domain, local types, Node.js std lib
}
```

Infrastructure lives in Server Actions that call the domain and persist results.

### Data Extractability

Each product owns a named PostgreSQL schema. All product data is extractable at any time:

```bash
pg_dump --schema=my_analyzer > my_analyzer.sql
# Later...
docker compose up  # Standalone repo with extracted schema
```

Shared platform tables carry `product_id` for tenant scoping and extractability.

---

## Repository Structure

```
forge/
├── apps/
│   └── [product-name]/          # 20 products, each a full Next.js app
│       ├── src/
│       │   ├── app/             # Next.js App Router
│       │   ├── domain/          # Pure business logic
│       │   ├── features/        # Server Actions + UI
│       │   ├── db/              # Drizzle schema + migrations
│       │   ├── worker/          # Background jobs (optional)
│       │   └── providers.ts     # Sole file importing adapters
│       ├── docs/                # 11 required product docs
│       ├── e2e/                 # Playwright tests
│       └── product.manifest.ts  # Archetype, capabilities, plans
│
├── packages/
│   ├── shared/                  # Result, error base types
│   ├── domain/                  # Archetype contracts, primitives
│   ├── config/                  # ProductManifest, env schemas
│   ├── db/                      # Drizzle client, platform schema
│   ├── ui/                      # React components, theme system
│   ├── [port packages]/         # auth, billing, email, analytics, storage, jobs
│   ├── testing/                 # Conformance tests, mocks
│   └── adapters/
│       ├── clerk/               # Clerk → AuthPort
│       ├── stripe/              # Stripe → BillingPort
│       ├── resend/              # Resend → EmailPort
│       ├── posthog/             # PostHog → Analytics + FeatureFlags
│       ├── pg-boss/             # pg-boss → JobQueuePort (default)
│       └── [more adapters...]   # supabase-storage, s3, openai, etc.
│
├── tools/
│   ├── create-product/          # Scaffold new product
│   ├── arch-check/              # Enforce boundaries
│   ├── extract-product/         # Extract product for acquisition
│   └── validate-docs/           # Ensure documentation exists
│
├── docs/                        # Framework-level docs
└── .ai/                         # AI governance rules
    ├── rules.md                 # 15 governance rules
    ├── boundaries.md            # Import boundaries
    ├── architecture-rules.md    # 22 frozen principles
    └── patterns/                # Implementation patterns
```

## Technology Stack

| Component | Choice |
|-----------|--------|
| Language | TypeScript (strict) |
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind v3 + shadcn/ui |
| Validation | Zod |
| ORM | Drizzle ORM |
| Database | PostgreSQL |
| Job Queue | pg-boss (PostgreSQL-backed, no Redis) |
| Monorepo | Turborepo + pnpm |
| Testing | Vitest + Playwright |
| Linting | ESLint + boundaries plugin |
| Container | Docker |
| CI/CD | GitHub Actions |

## Getting Started

```bash
# Install dependencies
pnpm install

# Type check
pnpm typecheck

# Lint (includes boundary checks)
pnpm lint

# Run tests
pnpm test

# Run architecture validation
pnpm arch-check

# Build
pnpm build

# Development
pnpm dev
```

## Creating Your First Product

```bash
pnpm create-product my-analyzer --archetype analyzer --capabilities reporting
```

This scaffolds a complete Next.js product in `apps/my-analyzer/` with:
- Analyzer engine contract in `src/domain/engine.ts`
- Example Server Action in `src/features/analysis/actions.ts`
- Drizzle schema for product data
- Dockerfile + docker-compose.yml
- 11 required documentation stubs
- Playwright E2E test skeleton

Read [docs/FRAMEWORK.md](./docs/FRAMEWORK.md) for detailed walkthrough.

## 6 Product Archetypes

1. **Analyzer** — Scans input, produces findings
2. **Optimizer** — Measures current state, recommends improvements
3. **Generator** — Creates new artifacts (code, config, docs)
4. **Transformer** — Converts between formats
5. **Runtime Middleware** — Intercepts requests, evaluates policy
6. **Gateway** — Routes traffic, manages endpoints

See [docs/ARCHETYPES.md](./docs/ARCHETYPES.md) for contracts and examples.

## Key Rules (Machine-Enforced)

✓ **Domain purity** — `src/domain/` has zero infrastructure imports  
✓ **Vendor isolation** — Each vendor SDK appears in exactly one adapter  
✓ **Port/adapter separation** — Ports define; adapters implement; only `providers.ts` imports adapters  
✓ **Product isolation** — No cross-product imports  
✓ **Data extractability** — Every product must survive extraction at any time  
✓ **No speculative abstraction** — Require two uses before extracting to packages/  

See [.ai/boundaries.md](.\.ai\boundaries.md) for the complete dependency graph.

## Extracting a Product

When ready to acquire a product:

```bash
pnpm extract-product my-analyzer
```

Produces a standalone repo with:
- Extracted source code
- Isolated database schema
- Docker Compose file
- Independent package.json and migrations

The extracted product is immediately deployable without modifying a single line of code.

## Framework Status

**Bootstrap Phase (COMPLETE)**
- Repository structure initialized
- Root configuration (pnpm, Turborepo, TypeScript)
- AI governance rules and boundaries
- Documentation framework

**Phase 2+ (PLANNED)**
- Implement framework packages (`db`, `auth`, `billing`, etc.)
- Build product scaffolding tool (`create-product`)
- Create first production SaaS product
- Establish conformance testing framework
- Deploy remaining 19 products

## License

Proprietary — All rights reserved

