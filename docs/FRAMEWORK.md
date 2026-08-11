# Forge Master SaaS Framework — Architecture Overview

## What is Forge?

Forge is a **modular monolith** designed to power **20 independent SaaS products** from a single repository. Each product is a self-contained Next.js application with its own database schema, job queue, and domain logic — yet all products share a common infrastructure of ports, adapters, and shared utilities.

Forge implements the **acquisition-ready** pattern: every product can be extracted from the monorepo at any time and deployed as a standalone application.

---

## Philosophy

### Products, Not Microservices

Forge is NOT a microservices platform. Every product is a **Next.js full-stack application** running in a single process (web) + optional worker process (for background jobs). Products scale together; they do not scale independently.

### Architecture is Frozen

The 22 principles in this framework are immutable. No agent redesign is permitted. Architecture violations are machine-enforced by ESLint, TypeScript, and the `arch-check` tool.

### One Port, One Adapter

Every external capability (auth, billing, payments, email, storage, jobs) is accessed through a **port interface**. Each port has exactly one adapter implementation at any time. Replacing a provider (e.g., Clerk → Auth0) requires implementing a new adapter and updating `providers.ts`. Zero business logic changes needed.

### Domain Purity

Business logic lives in `src/domain/engine.ts` as **pure functions** with zero imports from infrastructure. The domain:
- Takes validated input (Zod schemas)
- Returns a `Result<T, E>` (success or typed error)
- Has no side effects (no DB queries, API calls, or service invocations)
- Does not import Next.js, React, or any vendor SDK

Infrastructure lives in `features/` as Server Actions that:
- Call the domain engine
- Persist domain results to the database
- Send domain data to external services

### Data Ownership

Each product owns a **named PostgreSQL schema**. A product's data is completely isolated from other products' data, yet all products share the same Postgres instance initially. When a product is ready for extraction, `pg_dump --schema=product_name` exports all its data.

Shared platform tables (`platform.users`, `platform.organizations`, etc.) are scoped with `product_id` to ensure extractability.

---

## Repository Structure

```
forge/
├── apps/
│   └── [product-name]/          # 20 products, each a complete Next.js app
│       ├── src/
│       │   ├── app/             # Next.js App Router
│       │   ├── domain/          # Pure business logic (zero infrastructure imports)
│       │   ├── features/        # Feature modules (Server Actions + UI)
│       │   ├── db/              # Product-specific Drizzle schema + migrations
│       │   ├── worker/          # Background job processor (optional)
│       │   ├── theme/           # Design tokens
│       │   └── providers.ts     # ONLY FILE importing adapters
│       ├── docs/                # 11 required product docs
│       ├── e2e/                 # Playwright tests
│       ├── Dockerfile           # Web process
│       ├── docker-compose.yml   # Local dev environment
│       └── product.manifest.ts  # Archetype, capabilities, plans
│
├── packages/
│   ├── shared/                  # Result type, error bases, pagination
│   ├── domain/                  # Archetype contracts, shared primitives
│   ├── config/                  # ProductManifest, env schemas
│   ├── db/                      # Drizzle client, platform schema, withOrg() helper
│   ├── ui/                      # React components, theme system
│   ├── auth/                    # AuthPort interface
│   ├── billing/                 # BillingPort interface
│   ├── email/                   # EmailPort interface
│   ├── analytics/               # AnalyticsPort + FeatureFlagPort
│   ├── storage/                 # StoragePort interface
│   ├── jobs/                    # JobQueuePort interface
│   ├── ai-provider/             # AIModelPort interface
│   ├── reporting/               # Report generation (optional)
│   ├── testing/                 # Conformance tests, mocks, factories
│   └── adapters/
│       ├── clerk/               # Clerk → AuthPort
│       ├── stripe/              # Stripe → BillingPort
│       ├── resend/              # Resend → EmailPort
│       ├── posthog/             # PostHog → Analytics + FeatureFlags
│       ├── pg-boss/             # pg-boss → JobQueuePort (DEFAULT)
│       ├── bullmq/              # BullMQ → JobQueuePort (FUTURE)
│       ├── supabase-storage/    # Supabase → StoragePort
│       ├── s3/                  # S3 → StoragePort
│       ├── openai/              # OpenAI → AIModelPort
│       ├── anthropic/           # Anthropic → AIModelPort
│       └── env-flags/           # Environment variables → FeatureFlagPort
│
├── tools/
│   ├── create-product/          # Scaffold new product (archetype-aware)
│   ├── arch-check/              # Enforce boundaries at build time
│   ├── extract-product/         # Extract product for acquisition
│   └── validate-docs/           # Ensure all required documentation exists
│
├── docs/
│   ├── FRAMEWORK.md             # This document
│   ├── GETTING-STARTED.md       # First product walkthrough
│   ├── ARCHETYPES.md            # Archetype guide + contracts
│   ├── PROVIDER-REPLACEMENT.md  # How to swap providers
│   └── ACQUISITION-GUIDE.md     # Extraction + standalone deployment
│
└── .ai/
    ├── rules.md                 # 15 AI governance rules
    ├── boundaries.md            # Package import boundaries
    ├── architecture-rules.md    # The 22 frozen principles
    ├── task-template.md         # Task contract format
    ├── product-checklist.md     # Pre-launch verification
    └── patterns/
        ├── server-action.md     # Server Action pattern
        ├── domain-engine.md     # Engine implementation
        ├── adapter.md           # Adapter implementation
        └── job-processor.md     # Job processor pattern
```

---

## Technology Stack (FINAL)

| Component | Choice | Reason |
|-----------|--------|--------|
| Language | TypeScript (strict) | Type safety, AI-readable |
| Framework | Next.js 15 (App Router) | SSR, RSC, Server Actions, full-stack |
| Styling | Tailwind v3 + shadcn/ui | Utility CSS + composable components |
| Validation | Zod | Runtime validation + static type inference |
| ORM | Drizzle ORM | SQL-like TypeScript, AI-readable, no magic |
| Database | PostgreSQL | The database. Not swappable (only the host). |
| Job Queue | pg-boss (default) | PostgreSQL-backed, no Redis initially |
| Monorepo | Turborepo + pnpm | Fast builds, strict node_modules, workspaces |
| Testing | Vitest + Playwright | Fast unit tests, reliable E2E |
| Linting | ESLint (boundaries plugin) | Enforce import rules |
| Container | Docker | Mandatory portability artifact |
| CI/CD | GitHub Actions | Native GitHub integration |

### Initial Providers (Operational Choices, Not Requirements)

- **PostgreSQL Host:** Supabase (connection string only)
- **Auth:** Clerk (behind AuthPort)
- **Billing:** Stripe (behind BillingPort)
- **Email:** Resend (behind EmailPort)
- **Analytics + Flags:** PostHog (behind AnalyticsPort + FeatureFlagPort)
- **Storage:** Supabase Storage (behind StoragePort)
- **Web Deployment:** Vercel (optional) or any Docker host
- **Worker Deployment:** Any persistent container host

All providers are replaceable via adapter implementations and conformance tests.

---

## 22 Frozen Principles

See [architecture-rules.md](.ai/architecture-rules.md) for the complete list. They are machine-enforced.

Key highlights:

1. **Modular monolith per product** — No microservices, no shared runtime.
2. **Domain purity** — Domain code has zero infrastructure imports.
3. **Vendor isolation** — Each vendor SDK appears in exactly one adapter.
4. **Port/adapter separation** — Ports define contracts; adapters implement them.
5. **Data separability** — Every product must be extractable from the monorepo at any time.
6. **No speculative abstraction** — Require two concrete uses before extracting to packages.
7. **Docker mandatory** — `docker compose up` works for every product.
8. **Documentation is a gate** — Missing documentation blocks deployment.

---

## How It Works: A Product Lifecycle

### 1. Product Creation

```bash
pnpm create-product my-analyzer --archetype analyzer --capabilities reporting,scheduling
```

The tool scaffolds:
- Next.js app in `apps/my-analyzer/`
- `domain/engine.ts` implementing AnalyzerEngine contract
- `db/schema.ts` with product schema
- `features/` with example feature module
- `Dockerfile` and `docker-compose.yml`
- All 11 required documentation stubs

### 2. Development

Developer implements:

```typescript
// 1. Domain logic (pure business rules)
// src/domain/engine.ts
export async function analyzeProject(
  input: AnalysisInput,
  onProgress: (p: number) => void
): Promise<Result<AnalysisResult, string>> {
  // Pure function: no DB, no APIs, no side effects
  return { ok: true, value: { findings: [...] } };
}

// 2. Server Action (calls domain + persists)
// src/features/analysis/actions.ts
export async function startAnalysis(
  orgId: string,
  projectId: string
): Promise<Result<string, string>> {
  // Validate input, authorize, call domain, persist results
  const result = await domain.analyzeProject(input, onProgress);
  if (result.ok) {
    await db.insert(schema.findings).values(...);
  }
  return result;
}

// 3. UI Component (calls Server Action)
// src/features/analysis/components/AnalysisForm.tsx
export function AnalysisForm() {
  return (
    <form action={startAnalysis}>
      {/* ... */}
    </form>
  );
}
```

### 3. Infrastructure Access

Product only accesses external services via ports:

```typescript
// src/providers.ts (ONLY file importing adapters)
export const authPort = clerkAuthAdapter;  // from packages/adapters/clerk
export const billingPort = stripeBillingAdapter;  // from packages/adapters/stripe
export const emailPort = resendEmailAdapter;  // from packages/adapters/resend

// src/features/analysis/actions.ts
import { authPort, billingPort } from "@/providers";

export async function startAnalysis(orgId: string, raw: unknown) {
  // Use port, not adapter
  const user = await authPort.requireUser();
  const org = await authPort.requireOrganization(orgId);
  
  // No Clerk-specific code here
}
```

### 4. Testing

```typescript
// Unit tests (domain only)
describe("analyzeProject", () => {
  it("returns findings", async () => {
    const result = await domain.analyzeProject(input);
    expect(result.ok).toBe(true);
    expect(result.value?.findings).toHaveLength(3);
  });
});

// Integration tests (E2E with Playwright)
test("user can run analysis", async ({ page }) => {
  await page.goto("http://localhost:3000");
  await page.click("button:has-text('Start Analysis')");
  await expect(page).toHaveTitle("Analysis Results");
});

// Conformance tests (adapter validates against port contract)
// packages/testing/conformance/auth.ts
await authConformanceTests(clerkAuthAdapter);  // Passes? Adapter is valid.
```

### 5. Deployment

```bash
# Local
docker compose up

# Standalone (extracted for acquisition)
pnpm extract-product my-analyzer
# Produces: my-analyzer-standalone/ with its own package.json, migrations, docker-compose.yml

# Cloud (any Docker host)
docker build -t my-analyzer:latest .
docker push my-analyzer:latest
# Deploy to Vercel, Fly.io, Render, ECS, Kube, etc.
```

---

## Dependency Graph

Products import from packages:

```
apps/my-analyzer
  ├→ packages/ui              (React components)
  ├→ packages/domain          (Archetype contracts)
  ├→ packages/db              (Drizzle client, schema helpers)
  ├→ packages/auth            (AuthPort)
  ├→ packages/billing         (BillingPort)
  ├→ packages/shared          (Result, error types)
  └→ packages/config          (ProductManifest)

ONLY src/providers.ts can import:
  └→ packages/adapters/*      (Clerk, Stripe, Resend, etc.)

Domain has absolute zero infrastructure imports:
  ├→ packages/shared
  ├→ zod
  └→ Node.js std lib
```

---

## Extraction Flow

Every product is built to survive extraction:

```typescript
// Platform product registry
platform.products:
  id: uuid
  slug: "my-analyzer"
  created_at: timestamp

// Usage and audit records carry product_id
platform.usage_records:
  product_id → platform.products.id

// Product owns its schema
schemas:
  platform       ← Shared across all products
  my_analyzer    ← Isolated, product-specific
```

When acquiring a product:

```bash
pnpm extract-product my-analyzer

# Produces standalone repo with:
  ├── Identical source code (just my-analyzer/)
  ├── Exported product schema (pg_dump --schema=my_analyzer)
  ├── Exported related platform records
  ├── Independent docker-compose.yml
  └── Standalone package.json
```

The extracted product is **immediately deployable** with zero code changes.

---

## Next Steps

- **[Manual Testing Guide](./MANUAL_TESTING.md)** — Step-by-step Windows/VS Code walkthrough
- **[Archetypes](./ARCHETYPES.md)** — Understand product types
- **[Frozen Architecture](./architecture/FORGE-MASTER-ARCHITECTURE-V3.md)** — The V3 specification
- **[Import Boundaries](../.ai/boundaries.md)** — The machine-enforced dependency graph
- **[Product Docs](./../apps/jwt-scanner/docs/)** — JWT Scanner's ten required documents
  (SETUP, PROVIDERS, ACQUISITION, …)
