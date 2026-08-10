# MASTER SAAS FRAMEWORK v3.0 — READY FOR IMPLEMENTATION

---

## PREAMBLE

This document is the final architecture specification for the Forge framework. It is produced from v2 as the baseline, with minimum necessary corrections applied. Every section that was sound in v2 is preserved. Only sections requiring correction are modified.

This document supersedes v1 and v2. Implementation begins from this document.

---

## 1. Final Architecture Principles

These principles are frozen. Violations during implementation require a documented decision, not a silent override.

**P1 — Modular monolith per product.** Each product is a self-contained Next.js application. No shared runtime between products. No microservices.

**P2 — Turborepo + pnpm workspaces.** One repository. Internal packages via `workspace:*`. No private package registry.

**P3 — Machine-enforced package boundaries.** Import rules are enforced by ESLint, TypeScript project references, and the `arch-check` tool. Boundary violations fail CI.

**P4 — Domain logic has zero infrastructure imports.** A product's domain code imports only Zod, shared domain primitives, and its own types. No Next.js, no Drizzle, no vendor SDK, no adapter.

**P5 — Vendor code lives in exactly one adapter package.** A vendor SDK (e.g., `@clerk/nextjs`) appears in one place in the repository. Any other occurrence fails CI.

**P6 — No speculative abstraction.** A shared abstraction requires two concrete consumers before it is created. The first product that needs something may implement it directly; the second motivates extraction.

**P7 — PostgreSQL is not a swappable provider.** Application → Drizzle → PostgreSQL. The connection string is the infrastructure replacement boundary. No generic `IDatabaseAdapter`.

**P8 — Logical data ownership is product-scoped, physical deployment is flexible.** Each product owns its schema, migrations, jobs, and data. Products can share a physical Postgres instance initially and be promoted to dedicated instances.

**P9 — Product archetypes, not a universal engine interface.** Products implement the contract appropriate to their primary archetype. Optional capabilities are composed, not forced.

**P10 — pg-boss as the default job system.** No Redis by default. BullMQ is available as a future adapter when a concrete product requirement justifies it.

**P11 — AI agents operate under explicit, enforced file manifests.** Task contracts specify allowed files. Pre-commit hooks enforce manifests. AI is never the final authority on architecture.

**P12 — Conformance tests prove adapter replaceability.** Every port has a conformance test suite. Every adapter must pass it.

**P13 — Theme tokens, not visual templates.** Products define visual identity via design tokens. The UI package provides structural primitives.

**P14 — Documentation is a CI gate.** Missing or stub documentation blocks deployment.

**P15 — Every product must survive extraction at any time.** Monthly extraction validation runs in CI. A product that cannot be extracted cannot be acquired.

**P16 — Docker portability is mandatory.** `docker compose up` must work for every product. No cloud provider is mandatory.

**P17 — Reporting is archetype-dependent and optional.** Runtime Middleware and Gateway products do not require document-style reports.

**P18 — Security is implemented, not inherited.** The framework provides primitives. The developer implements security per product. Claiming security exists because a primitive is available is a documentation overclaim.

**P19 — Capability composition, not interface multiplication.** A product selects a primary archetype and composes optional capabilities. The product manifest declares both.

**P20 — Data separability is an architectural invariant.** Every persistent record that belongs to a product must be identifiable and extractable without redesigning the application.

**P21 — Provider capabilities, not provider names, are the architectural requirement.** The architecture specifies what a deployment slot must be capable of. Specific providers are initial operational choices, not requirements.

**P22 — Code coverage is a quality signal, not proof of correctness.** The launch gate requires appropriate test cases across categories, not a coverage number alone.

---

## 2. Final Technology Stack

### 2.1 Evaluation and Freeze

| Technology | Decision | Reason |
|-----------|----------|--------|
| **Next.js 15 (App Router)** | KEEP | Full-stack React framework. SSR, RSC, Server Actions, API routes. Dominant productivity choice for solo developer. |
| **TypeScript (strict mode)** | KEEP | Non-negotiable. AI agents produce better-constrained output with types. Runtime errors caught at compile time. |
| **Tailwind CSS v3** | KEEP | Build-time utility CSS. Token system maps to CSS custom properties. Stay on v3; v4 not yet stable. |
| **shadcn/ui** | KEEP | Copy-paste components. Product owns the code. No version lock-in from a UI library. |
| **pnpm** | KEEP | Fast installs. Strict node_modules. Workspace protocol required. |
| **Turborepo** | KEEP | Build orchestration, remote caching, affected-package detection. |
| **Drizzle ORM** | KEEP | SQL-like TypeScript. No binary engine. PostgreSQL dialect only. AI-readable. |
| **PostgreSQL** | KEEP | The database. Not a swappable provider. |
| **Supabase** | KEEP as initial PostgreSQL host | Used via connection string only. Never import `@supabase/supabase-js` in product code. TIME-SENSITIVE OPERATIONAL ASSUMPTION — VERIFY AT DEPLOYMENT. |
| **pg-boss** | KEEP as default job queue | PostgreSQL-backed. No Redis dependency. Mature TypeScript support. Covers all initial job requirements. |
| **Clerk** | KEEP behind AuthPort | Saves significant auth UI development time. Replaceable via conformance-tested adapter. TIME-SENSITIVE OPERATIONAL ASSUMPTION. |
| **Stripe** | KEEP behind BillingPort | Industry standard. Replaceable via conformance-tested adapter. |
| **Resend** | KEEP behind EmailPort | Simple, react-email compatible. Replaceable. TIME-SENSITIVE OPERATIONAL ASSUMPTION. |
| **PostHog** | KEEP behind AnalyticsPort | Open-source. Self-hostable. Feature flags included. TIME-SENSITIVE OPERATIONAL ASSUMPTION. |
| **React Email** | KEEP | Email templates as React components. Decoupled from email provider. |
| **Docker** | KEEP | Mandatory portability artifact. Every product ships a working Docker image. |
| **Vercel** | OPTIONAL | Suitable for initial web deployment. Not architecturally required. Products must be deployable without Vercel. |
| **GitHub Actions** | KEEP | Sufficient for CI/CD. Native GitHub integration. Turborepo remote caching compatible. |
| **Vitest** | KEEP | Fast. Native ESM. Turborepo-compatible. |
| **Playwright** | KEEP | Reliable E2E. Multi-browser. Strong CI support. |
| **ESLint (boundaries plugin)** | KEEP | Import boundary enforcement. |
| **Zod** | KEEP | Runtime validation + static type inference. Used in domain and infrastructure layers. |
| **Redis** | DEFERRED | Only when a concrete product requirement justifies it. Not in initial infrastructure. |
| **BullMQ** | DEFERRED | Available as a future JobQueuePort adapter. Not introduced speculatively. |
| **Puppeteer** | OPTIONAL | PDF generation for reporting-capable products only. Not default infrastructure. |

### 2.2 Frozen Stack Summary

```
Language:       TypeScript (strict)
Framework:      Next.js 15 (App Router)
Styling:        Tailwind CSS v3 + shadcn/ui
Validation:     Zod
ORM:            Drizzle ORM
Database:       PostgreSQL
Jobs:           pg-boss (PostgreSQL-backed)
Monorepo:       Turborepo + pnpm
Testing:        Vitest + Playwright
Email:          React Email templates
Containers:     Docker
CI/CD:          GitHub Actions

Initial providers (operational choices, not architectural requirements):
  PostgreSQL host:  Supabase (connection string only)
  Auth:             Clerk (behind AuthPort)
  Billing:          Stripe (behind BillingPort)
  Email delivery:   Resend (behind EmailPort)
  Analytics/flags:  PostHog (behind AnalyticsPort/FeatureFlagPort)
  Storage:          Supabase Storage (behind StoragePort)
  Web deployment:   Vercel (optional) or any container host
  Worker deployment: Any persistent container host
```

---

## 3. Final Repository Architecture

### 3.1 Structure Rationale

`apps/` — product applications. Independent, isolated, deployable.
`packages/` — shared code consumed by apps. Ports, adapters, UI, domain primitives, DB utilities.
`tools/` — development tooling. Not imported by apps or packages.
`.ai/` — AI agent context. Rules, boundaries, task templates, patterns.
`docs/` — framework-level documentation. Not product documentation (which lives in each app).

### 3.2 Final Repository Tree

```
forge/
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                         # Main CI pipeline
│   │   ├── deploy.yml                     # Per-product deployment (manual trigger)
│   │   ├── arch-check.yml                 # Architecture enforcement on every PR
│   │   ├── extraction-validate.yml        # Monthly extraction validation
│   │   └── security-audit.yml             # Weekly dependency vulnerability scan
│   ├── CODEOWNERS                         # Package ownership declarations
│   └── pull_request_template.md           # Embeds AI task checklist
│
├── .ai/
│   ├── rules.md                           # 22 architectural principles, numbered
│   ├── boundaries.md                      # Every package: purpose + allowed imports
│   ├── task-template.md                   # Required task contract format
│   ├── product-checklist.md               # Pre-launch verification checklist
│   ├── architecture-rules.md              # Detailed rules for arch-check
│   └── patterns/
│       ├── server-action.md               # Server Action pattern
│       ├── domain-engine.md               # Archetype engine implementation patterns
│       ├── adapter.md                     # Provider adapter implementation
│       ├── db-query.md                    # Drizzle query with org scoping
│       ├── job-processor.md               # pg-boss job patterns
│       └── feature-module.md              # Feature module structure
│
├── docs/
│   ├── FRAMEWORK.md                       # Framework overview and philosophy
│   ├── GETTING-STARTED.md                 # First product walkthrough
│   ├── ARCHETYPES.md                      # Archetype guide with examples
│   ├── PROVIDER-REPLACEMENT.md            # How to replace any provider
│   └── ACQUISITION-GUIDE.md              # Framework-level acquisition documentation
│
├── apps/
│   ├── [product-name]/                    # One directory per product (20 total)
│   │   ├── src/
│   │   │   ├── app/                       # Next.js App Router
│   │   │   │   ├── (marketing)/           # Landing, pricing, docs pages
│   │   │   │   ├── (dashboard)/           # Authenticated application
│   │   │   │   ├── api/                   # Webhook endpoints only
│   │   │   │   ├── layout.tsx
│   │   │   │   └── middleware.ts          # Auth middleware (uses AuthPort via providers)
│   │   │   ├── domain/                    # Product domain (zero infra imports)
│   │   │   │   ├── engine.ts              # Implements primary archetype contract
│   │   │   │   ├── types.ts               # Product-specific types
│   │   │   │   ├── schemas.ts             # Zod input/output schemas
│   │   │   │   └── __tests__/             # Domain unit tests
│   │   │   ├── features/                  # Feature modules (data + UI composition)
│   │   │   │   └── [feature-name]/
│   │   │   │       ├── actions.ts         # Server Actions
│   │   │   │       ├── queries.ts         # DB queries
│   │   │   │       ├── components/        # Feature-specific components
│   │   │   │       └── __tests__/
│   │   │   ├── worker/                    # Worker process (archetypes that need it)
│   │   │   │   ├── index.ts               # pg-boss startup + processor registration
│   │   │   │   └── processors/
│   │   │   ├── db/
│   │   │   │   ├── schema.ts              # Product-specific Drizzle schema
│   │   │   │   └── migrations/            # Product-specific migration files
│   │   │   ├── theme/
│   │   │   │   ├── tokens.ts              # Product design tokens
│   │   │   │   └── globals.css            # CSS custom property application
│   │   │   └── providers.ts               # SOLE file importing adapter packages
│   │   ├── docs/                          # Product documentation (all 11 required)
│   │   │   ├── ARCHITECTURE.md
│   │   │   ├── SETUP.md
│   │   │   ├── DEPLOYMENT.md
│   │   │   ├── DATABASE.md
│   │   │   ├── PROVIDERS.md
│   │   │   ├── API.md
│   │   │   ├── TESTING.md
│   │   │   ├── SECURITY.md
│   │   │   ├── OPERATIONS.md
│   │   │   └── ACQUISITION.md
│   │   ├── e2e/                           # Playwright tests
│   │   │   ├── flows/                     # Critical path tests
│   │   │   └── security/                  # Auth, IDOR, injection tests
│   │   ├── Dockerfile                     # Web process
│   │   ├── Dockerfile.worker              # Worker process (if archetype requires)
│   │   ├── docker-compose.yml             # Full local development stack
│   │   ├── product.manifest.ts            # Primary archetype, capabilities, plans
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│
├── packages/
│   │
│   ├── shared/                            # LAYER 0 — Shared kernel
│   │   ├── src/
│   │   │   ├── result.ts                  # Result<T, E>
│   │   │   ├── errors.ts                  # Error base types
│   │   │   ├── pagination.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── domain/                            # Shared domain primitives
│   │   ├── src/
│   │   │   ├── primitives/
│   │   │   │   ├── severity.ts            # Severity enum (OPTIONAL)
│   │   │   │   ├── finding.ts             # BaseFinding (OPTIONAL)
│   │   │   │   ├── job-status.ts          # JobStatus (REQUIRED where jobs exist)
│   │   │   │   ├── artifact.ts            # Artifact (OPTIONAL)
│   │   │   │   ├── diagnostic.ts          # Diagnostic (OPTIONAL)
│   │   │   │   ├── metric.ts              # Metric (OPTIONAL)
│   │   │   │   ├── policy-decision.ts     # PolicyDecision (OPTIONAL)
│   │   │   │   ├── report-summary.ts      # ReportSummary (OPTIONAL)
│   │   │   │   └── recommendation.ts      # Recommendation (OPTIONAL)
│   │   │   ├── archetypes/
│   │   │   │   ├── analyzer.ts            # AnalyzerEngine contract
│   │   │   │   ├── optimizer.ts           # OptimizerEngine contract
│   │   │   │   ├── generator.ts           # GeneratorEngine contract
│   │   │   │   ├── transformer.ts         # TransformerEngine contract
│   │   │   │   ├── middleware.ts          # MiddlewareEngine contract
│   │   │   │   └── gateway.ts             # GatewayEngine contract
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── config/                            # Configuration types
│   │   ├── src/
│   │   │   ├── product-manifest.ts        # ProductManifest, Archetype, Capability
│   │   │   ├── env.ts                     # Base environment schema (Zod)
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── db/                                # Database utilities
│   │   ├── src/
│   │   │   ├── client.ts                  # Drizzle client factory
│   │   │   ├── migrate.ts                 # Migration runner
│   │   │   ├── schema/                    # Shared platform schema
│   │   │   │   ├── users.ts
│   │   │   │   ├── organizations.ts
│   │   │   │   ├── members.ts
│   │   │   │   ├── subscriptions.ts
│   │   │   │   ├── usage-records.ts
│   │   │   │   └── audit-events.ts
│   │   │   ├── helpers.ts                 # withOrg(), withProduct() scoping
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── ui/                                # UI primitives and theme system
│   │   ├── src/
│   │   │   ├── primitives/                # Button, Input, Card, Dialog, etc.
│   │   │   ├── composites/                # DataTable, FormField, StatusBadge
│   │   │   ├── layouts/                   # Shell, Sidebar, TopNav (structural)
│   │   │   ├── charts/                    # Chart container wrappers
│   │   │   ├── theme/
│   │   │   │   ├── types.ts               # ThemeTokens interface
│   │   │   │   ├── defaults.ts            # Default token values
│   │   │   │   └── apply.ts               # Token → CSS variable generation
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── auth/                              # Auth port
│   │   ├── src/
│   │   │   ├── port.ts                    # AuthPort interface
│   │   │   ├── middleware-port.ts         # AuthMiddleware interface
│   │   │   ├── webhook-port.ts            # AuthWebhookHandler interface
│   │   │   ├── types.ts                   # AuthUser, AuthOrganization
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── billing/                           # Billing port
│   │   ├── src/
│   │   │   ├── port.ts                    # BillingPort interface
│   │   │   ├── webhook-port.ts            # BillingWebhookHandler interface
│   │   │   ├── types.ts                   # Subscription, Plan, Usage
│   │   │   ├── entitlements.ts            # Entitlement check utility
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── email/                             # Email port
│   │   ├── src/
│   │   │   ├── port.ts                    # EmailPort interface
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── analytics/                         # Analytics and feature flag ports
│   │   ├── src/
│   │   │   ├── port.ts                    # AnalyticsPort interface
│   │   │   ├── flags-port.ts              # FeatureFlagPort interface
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── storage/                           # File storage port
│   │   ├── src/
│   │   │   ├── port.ts                    # StoragePort interface
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── jobs/                              # Job queue port
│   │   ├── src/
│   │   │   ├── port.ts                    # JobQueuePort interface
│   │   │   ├── types.ts                   # Job, JobStatus, JobOptions, JobInfo
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── ai-provider/                       # AI model port (for products using LLMs)
│   │   ├── src/
│   │   │   ├── port.ts                    # AIModelPort interface
│   │   │   ├── types.ts                   # Prompt, Completion, Embedding
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── reporting/                         # Optional reporting subsystem
│   │   ├── src/
│   │   │   ├── types.ts                   # ReportTemplate interface, ReportFormat enum
│   │   │   ├── generators/
│   │   │   │   ├── json.ts
│   │   │   │   ├── markdown.ts
│   │   │   │   ├── html.ts
│   │   │   │   └── pdf.ts                 # HTML → PDF (Puppeteer, optional)
│   │   │   └── pipeline.ts                # findings → format → storage orchestration
│   │   └── package.json
│   │
│   ├── testing/                           # Test infrastructure
│   │   ├── src/
│   │   │   ├── conformance/               # Port conformance suites
│   │   │   │   ├── auth.ts
│   │   │   │   ├── billing.ts
│   │   │   │   ├── email.ts
│   │   │   │   ├── jobs.ts
│   │   │   │   ├── storage.ts
│   │   │   │   └── ai-provider.ts
│   │   │   ├── factories/                 # Test data factories
│   │   │   └── mocks/                     # Mock adapters for all ports
│   │   └── package.json
│   │
│   └── adapters/
│       ├── clerk/                         # Clerk → AuthPort
│       │   ├── src/
│       │   │   ├── adapter.ts
│       │   │   ├── middleware.ts
│       │   │   ├── webhook.ts
│       │   │   └── index.ts
│       │   ├── __tests__/
│       │   └── package.json
│       ├── stripe/                        # Stripe → BillingPort
│       ├── resend/                        # Resend → EmailPort
│       ├── posthog/                       # PostHog → AnalyticsPort + FeatureFlagPort
│       ├── pg-boss/                       # pg-boss → JobQueuePort (DEFAULT)
│       ├── bullmq/                        # BullMQ → JobQueuePort (FUTURE, when needed)
│       ├── s3/                            # S3-compatible → StoragePort
│       ├── supabase-storage/              # Supabase Storage → StoragePort (INITIAL)
│       ├── openai/                        # OpenAI → AIModelPort
│       ├── anthropic/                     # Anthropic → AIModelPort
│       └── env-flags/                     # Env vars → FeatureFlagPort (fallback)
│
└── tools/
    ├── create-product/                    # Product scaffolding
    │   ├── src/
    │   │   ├── index.ts
    │   │   ├── archetype-templates/       # Per-archetype scaffolding
    │   │   └── shared-templates/          # Dockerfile, docker-compose, docs stubs
    │   └── package.json
    ├── arch-check/                        # Architecture enforcement
    │   ├── src/
    │   │   ├── index.ts
    │   │   └── checks/
    │   │       ├── vendor-leakage.ts
    │   │       ├── domain-infra.ts
    │   │       ├── cross-product.ts
    │   │       ├── circular-deps.ts
    │   │       ├── unauthorized-deps.ts
    │   │       ├── unused-deps.ts
    │   │       ├── adapter-bypass.ts
    │   │       ├── db-scoping.ts
    │   │       └── product-isolation.ts
    │   └── package.json
    ├── extract-product/                   # Acquisition extraction
    │   ├── src/
    │   │   ├── index.ts
    │   │   ├── analyzer.ts                # Classifies each dependency
    │   │   ├── copier.ts
    │   │   ├── db-snapshot.ts             # Per-product schema export
    │   │   ├── validator.ts               # Validates extracted repo
    │   │   └── report.ts                 # Generates acquisition report
    │   └── package.json
    └── validate-docs/                     # Documentation completeness check
        ├── src/
        │   └── index.ts
        └── package.json
```

---

## 4. Final Dependency Graph

### 4.1 Dependency Direction (Absolute Rules)

```
apps/*
  → packages/ui
  → packages/domain
  → packages/auth         (port only)
  → packages/billing      (port only)
  → packages/email        (port only)
  → packages/analytics    (port only)
  → packages/jobs         (port only)
  → packages/storage      (port only)
  → packages/ai-provider  (port only, if used by this product)
  → packages/db
  → packages/shared
  → packages/config
  → packages/reporting    (if archetype uses it)

apps/*/src/providers.ts ADDITIONALLY:
  → packages/adapters/*   (ONLY THIS FILE IN THE ENTIRE APP)

packages/adapters/*
  → packages/[port they implement]
  → packages/shared
  → [vendor SDK they wrap]

packages/domain
  → packages/shared
  → zod
  [NOTHING ELSE — machine enforced]

packages/db
  → packages/shared
  → drizzle-orm
  → postgres  (postgres.js connection driver)

packages/reporting
  → packages/domain
  → packages/shared

packages/[port]  (auth, billing, email, analytics, jobs, storage, ai-provider)
  → packages/shared
  [NO adapter imports — machine enforced]

packages/testing
  → packages/[all ports]
  → packages/shared

tools/*
  → packages/*  (analysis only — tools are never imported by apps)
```

### 4.2 Forbidden Dependencies (All Enforced by arch-check)

```
apps/[product-A]  ✕  apps/[product-B]         # Cross-product import
packages/[port]   ✕  packages/adapters/*       # Port importing adapter
packages/domain   ✕  packages/db               # Domain importing infrastructure
packages/domain   ✕  packages/auth             # Domain importing infrastructure
packages/domain   ✕  packages/adapters/*       # Domain importing adapter
packages/domain   ✕  next                      # Domain importing framework
packages/domain   ✕  react                     # Domain importing framework
packages/adapters/[A]  ✕  packages/adapters/[B]  # Adapter importing adapter
apps/*/src/(anything except providers.ts)  ✕  packages/adapters/*
packages/*        ✕  apps/*                    # Package importing app
```

---

## 5. Final Provider Architecture

### 5.1 Design Boundary Stated Precisely

**What the port abstracts:** The operational contract with an external vendor service. The adapter translates between that contract and the vendor's specific API.

**What the port does NOT abstract:** The database (PostgreSQL is not a provider plugin). The web framework (React/Next.js is not replaceable via an adapter). The programming language.

**The replacement guarantee:** Every port has a conformance test suite. Any adapter that passes the suite is a valid replacement. This is a technical guarantee, not a documentation claim.

### 5.2 Port Contracts

**AuthPort**
```
getCurrentUser(): Promise<AuthUser | null>
requireUser(): Promise<AuthUser>
getOrganization(orgId: string): Promise<AuthOrganization | null>
requireOrganization(orgId: string): Promise<AuthOrganization>
getUserOrganizations(userId: string): Promise<AuthOrganization[]>
```

**AuthMiddleware**
```
protect(options?: { organizationRequired?: boolean }): NextMiddleware
```

**AuthWebhookHandler**
```
verifyWebhookSignature(request: Request): Promise<unknown>
handleUserCreated(payload: unknown): Promise<void>
handleUserUpdated(payload: unknown): Promise<void>
handleOrganizationCreated(payload: unknown): Promise<void>
```

**BillingPort**
```
createCustomer(params: CreateCustomerParams): Promise<BillingCustomer>
createCheckoutSession(params: CreateCheckoutParams): Promise<{ url: string }>
createBillingPortalSession(params: { customerId: string; returnUrl: string }): Promise<{ url: string }>
getActiveSubscription(customerId: string): Promise<BillingSubscription | null>
cancelSubscription(subscriptionId: string): Promise<void>
reportUsage(params: ReportUsageParams): Promise<void>
```

**BillingWebhookHandler**
```
verifyWebhookSignature(request: Request): Promise<unknown>
handleCheckoutCompleted(payload: unknown): Promise<void>
handleSubscriptionUpdated(payload: unknown): Promise<void>
handleSubscriptionDeleted(payload: unknown): Promise<void>
handleInvoicePaymentFailed(payload: unknown): Promise<void>
```

**EmailPort**
```
send(message: EmailMessage): Promise<{ id: string }>
sendBatch(messages: EmailMessage[]): Promise<{ ids: string[] }>
```

**AnalyticsPort**
```
identify(userId: string, traits: Record<string, unknown>): void
track(event: string, properties?: Record<string, unknown>): void
page(name: string, properties?: Record<string, unknown>): void
```

**FeatureFlagPort**
```
isEnabled(flag: string, userId?: string): Promise<boolean>
getVariant(flag: string, userId?: string): Promise<string | null>
```

**StoragePort**
```
upload(key: string, data: Buffer | ReadableStream, contentType: string): Promise<string>
download(key: string): Promise<Buffer>
getSignedUrl(key: string, expiresIn: number): Promise<string>
delete(key: string): Promise<void>
list(prefix: string): Promise<StorageObject[]>
```

**JobQueuePort**
```
enqueue<T>(jobName: string, data: T, options?: JobOptions): Promise<string>
getJob(jobId: string): Promise<JobInfo | null>
registerProcessor<T>(jobName: string, processor: JobProcessor<T>): void
start(): Promise<void>
stop(): Promise<void>
```

**AIModelPort** (for products using language models)
```
complete(prompt: string, options?: CompletionOptions): Promise<CompletionResult>
completeStructured<T>(prompt: string, schema: ZodSchema<T>, options?: CompletionOptions): Promise<T>
embed(text: string): Promise<number[]>
```

### 5.3 Provider Capability Requirements vs. Initial Operational Choices

| Capability Required | Initial Provider | Replacement Boundary |
|--------------------|-----------------|---------------------|
| PostgreSQL-compatible database host | Supabase (connection string) | `DATABASE_URL` environment variable + migration run |
| Authentication provider | Clerk | New AuthPort adapter + providers.ts update |
| Transactional email | Resend | New EmailPort adapter + providers.ts update |
| Billing/payments | Stripe | New BillingPort adapter + providers.ts update |
| Product analytics + feature flags | PostHog | New AnalyticsPort/FeatureFlagPort adapters |
| Object storage | Supabase Storage | New StoragePort adapter |
| Container/serverless web host | Vercel (optional) | Any Docker-capable host |
| Persistent container worker host | Any container host | Any Docker-capable host |
| AI model (if product needs it) | OpenAI or Anthropic | New AIModelPort adapter |

> **TIME-SENSITIVE OPERATIONAL ASSUMPTION:** All provider selections above reflect operational convenience at the time of writing. Provider pricing, free-tier terms, and availability change. Verify all provider terms at the time of deployment. The architecture does not depend on any specific provider remaining viable.

---

## 6. Final Database Architecture

### 6.1 Stated Precisely

```
Application
    ↓
Drizzle ORM (SQL-like TypeScript queries)
    ↓
postgres.js (connection driver)
    ↓
PostgreSQL (the database)
    ↓
Supabase (initial managed host — connection string only)
```

No further abstraction exists. No `IDatabaseAdapter`. Drizzle IS the data access layer. PostgreSQL is not swappable with MySQL without rewriting queries. This is documented honestly.

### 6.2 Logical Ownership vs. Physical Deployment

**Architectural invariant (P20):** Every persistent record that belongs to a product must be identifiable and extractable without redesigning the application.

**Implementation:** PostgreSQL named schemas. Each product owns a named schema. No product may read or write another product's schema.

```
PHYSICAL HOST: One Supabase Postgres instance (initial)

LOGICAL OWNERSHIP:
  schema: platform          ← shared platform tables
  schema: mcp_gateway       ← Product 1 data
  schema: jwt_scanner       ← Product 16 data
  schema: sbom_generator    ← Product 18 data
  ...
```

**Promotion path:** When a product is extracted or reaches scale requiring isolation:
1. `pg_dump --schema=jwt_scanner` exports all product data.
2. Restore to a dedicated Postgres instance.
3. Rename schema to `public` (or keep named schema).
4. Update `DATABASE_URL`.
5. Run `pnpm db:migrate`.
6. Done. No application code changes.

### 6.3 Shared Platform Schema — Ownership Classification

| Table | Classification | Acquisition Handling |
|-------|---------------|---------------------|
| `platform.users` | A — globally shared | Export rows for users who belong to product's organizations |
| `platform.organizations` | A — globally shared | Export rows for organizations using this product |
| `platform.organization_members` | A — globally shared | Export rows for above organizations |
| `platform.subscriptions` | B — product-scoped by org | Export subscriptions for product's organizations |
| `platform.usage_records` | B — product-scoped | Must include `product_id` column. Export by product_id. |
| `platform.audit_events` | B — product-scoped | Must include `product_id` column. Export by product_id. |

**Required invariant for shared platform tables:** Every row in `usage_records` and `audit_events` must carry a `product_id` foreign key referencing a product registry. This ensures extractability. Without this, it is impossible to know which usage or audit records belong to which product.

**Product registry table** (small, shared):
```
platform.products
  id           uuid PK
  slug         varchar unique   ← matches directory name
  display_name varchar
  created_at   timestamptz
```

This is the anchor that makes audit and usage records extractable per product.

### 6.4 Product-Specific Schema Requirements

Every product's schema must satisfy:

1. All product-specific tables live in the product's named schema.
2. Foreign keys to `platform.organizations` and `platform.users` are allowed and expected.
3. No foreign keys to another product's schema.
4. All tenant-scoped tables carry `organization_id` as a non-nullable column.
5. The `withOrg(orgId)` helper must be used in every query on a tenant-scoped table.

### 6.5 Migration Architecture

```
packages/db/src/migrations/        ← Platform schema migrations (run first)
apps/[product]/src/db/migrations/   ← Product schema migrations (run after platform)
```

Migration execution order is deterministic:
1. Platform migrations (shared across all products)
2. Product migrations (product-specific)

Each product's `pnpm db:migrate` script runs both in order.

### 6.6 Database Separability — Required Ownership Keys

For extraction to work, every product-scoped table must be reachable via:

```
platform.products.id
    ↓
platform.organizations (via subscription or direct project FK)
    ↓
[product schema].projects.organization_id
    ↓
[product schema].analysis_jobs.project_id
    ↓
[product schema].findings.job_id
    ↓
[product schema].reports.job_id
```

And:
```
platform.usage_records.product_id = platform.products.id
platform.audit_events.product_id = platform.products.id
```

This chain enables complete extraction of all product-related data from any shared Postgres instance.

---

## 7. Final Job Architecture

### 7.1 Consistent Architecture Statement

```
DEFAULT (initial, all products that need background processing):

  JobQueuePort interface
        ↓
  pg-boss adapter
        ↓
  PostgreSQL (product's schema)

No Redis. No BullMQ. No additional infrastructure.

FUTURE (only when a concrete product requirement justifies it):

  JobQueuePort interface
        ↓
  BullMQ adapter
        ↓
  Redis

Migration: implement BullMQAdapter → pass conformance tests → update providers.ts.
Zero domain code changes required.
```

### 7.2 Job System Components

| Component | Description | Location |
|-----------|-------------|----------|
| **JobQueuePort** | Interface contract | `packages/jobs/src/port.ts` |
| **pg-boss adapter** | Implements JobQueuePort using pg-boss | `packages/adapters/pg-boss/` |
| **Job persistence** | pg-boss job tables in product's Postgres schema | Created by pg-boss on first start |
| **Retry mechanism** | Configured via JobOptions (attempts, backoff) | pg-boss built-in |
| **Scheduling** | Cron-style scheduling via pg-boss | pg-boss built-in |
| **Progress tracking** | Percentage progress via job update | pg-boss built-in, polled by UI |
| **Web process** | Next.js application | `apps/[product]/src/app/` |
| **Worker process** | Separate Node.js process, registers processors | `apps/[product]/src/worker/` |

### 7.3 Archetype Job Requirements

| Archetype | Background Jobs Needed | Worker Process | Scheduling |
|-----------|----------------------|----------------|------------|
| Analyzer | Yes — analysis runs | Yes | Optional (on-demand + scheduled scans) |
| Optimizer | Yes — optimization runs | Yes | Optional |
| Generator | Sometimes — depends on duration | Conditional | Rarely |
| Transformer | Rarely — most are fast | Only if needed | No |
| Runtime Middleware | No | No | No |
| Gateway | No | No | No |

Products that do not use the job queue do not import `@forge/jobs` or `@forge/adapter-pg-boss`. The pg-boss adapter is not default infrastructure — it is selected by products that need it.

### 7.4 No Redis Statement

Redis does not appear in initial infrastructure. pg-boss uses the same Postgres connection already required by the application. There is no Upstash, no Redis Labs, no self-hosted Redis in the initial deployment for any product. If a product's domain engine produces requirements that pg-boss cannot satisfy, that is a concrete justification to introduce Redis at that time, for that product, via the BullMQ adapter.

---

## 8. Final Product Archetype + Capability Model

### 8.1 Model Design

**V2 Decision:** Products belong to exactly one archetype.
**V3 Decision:** Products have a primary archetype and declare optional capabilities.
**Reason:** Products like MCP Gateway (transformer + gateway + runtime policy) and PostgreSQL EXPLAIN Repair (analyzer + optimizer) cannot be honestly assigned a single archetype without losing information or creating a false contract.

A product's `product.manifest.ts` declares:

```typescript
// packages/config/src/product-manifest.ts

export const Archetype = {
  ANALYZER: 'analyzer',
  OPTIMIZER: 'optimizer',
  GENERATOR: 'generator',
  TRANSFORMER: 'transformer',
  MIDDLEWARE: 'middleware',
  GATEWAY: 'gateway',
} as const;
export type Archetype = typeof Archetype[keyof typeof Archetype];

export const Capability = {
  REPORTING: 'reporting',        // Produces document-style reports
  SCHEDULING: 'scheduling',      // Supports scheduled runs
  REMEDIATION: 'remediation',    // Produces actionable fixes
  TRANSFORMATION: 'transformation', // Produces transformed artifacts
  POLICY: 'policy',              // Enforces runtime policy
  ANALYSIS: 'analysis',          // Produces findings
  OPTIMIZATION: 'optimization',  // Produces metrics + recommendations
  GENERATION: 'generation',      // Produces new artifacts
  AI_ASSISTED: 'ai-assisted',    // Uses AI model for processing
  STREAMING: 'streaming',        // Produces streaming output
} as const;
export type Capability = typeof Capability[keyof typeof Capability];

export interface ProductManifest {
  id: string;                    // matches directory name slug
  displayName: string;
  tagline: string;
  primaryArchetype: Archetype;
  capabilities: Capability[];    // Optional additional capabilities
  plans: PlanDefinition[];
  requiresWorker: boolean;       // Does this product need a worker process?
  requiresAIProvider: boolean;   // Does this product use the AIModelPort?
}
```

The primary archetype determines which engine contract the product's `domain/engine.ts` implements. Capabilities inform which shared subsystems the product opts into (reporting, job queue, AI provider, etc.).

### 8.2 Archetype Contracts

Each archetype defines a minimal TypeScript interface in `packages/domain/src/archetypes/`. Products implement the interface appropriate to their primary archetype.

**Analyzer**
```
Purpose:     Accepts structured input, executes analysis, produces findings.
Input:       validateInput(raw: unknown): TInput
Execution:   execute(input, config, progress): Promise<AnalyzerResult<TFinding>>
Output:      findings[], summary, artifacts (optional), metadata
Jobs:        Yes (analysis runs are background jobs)
Reporting:   Yes (findings → report formats)
Persistence: projects, analysis_jobs, findings, reports
```

**Optimizer**
```
Purpose:     Analyzes for inefficiency, produces metrics, recommendations, optional remediation.
Input:       validateInput(raw: unknown): TInput
Execution:   execute(input, config, progress): Promise<OptimizerResult<TMetric, TRecommendation>>
Output:      metrics[], recommendations[], estimatedSavings, remediations (optional), summary
Jobs:        Yes
Reporting:   Yes (metrics + recommendations)
Persistence: projects, optimization_runs, metrics, recommendations
```

**Generator**
```
Purpose:     Produces a new artifact from a description or input source.
Input:       validateInput(raw: unknown): TInput
Execution:   generate(input, config, progress): Promise<GeneratorResult<TArtifact>>
Output:      artifact, validationResult (optional), diagnostics (optional), metadata
Jobs:        Conditional on execution duration
Reporting:   Minimal (artifact summary, optional)
Persistence: projects, generation_runs, artifacts
```

**Transformer**
```
Purpose:     Maps an existing artifact from one format or protocol to another.
Input:       validateInput(raw: unknown): TInput
Execution:   transform(input, config): Promise<TransformerResult<TOutput>>
Output:      output, diagnostics (optional), warnings (optional), metadata
Jobs:        Rarely (most transformations are request-scoped)
Reporting:   Diagnostics only
Persistence: source_configs, transform_results, transform_history
```

**Runtime Middleware**
```
Purpose:     Intercepts requests, evaluates policy, returns decision.
Input:       validateRequest(raw: unknown): TRequest
Execution:   evaluate(request, context): Promise<PolicyDecision<TDecision>>
Output:      action (allow/block/transform/rate-limit), transformed (optional), reason, metadata
Jobs:        No
Reporting:   Dashboard analytics, not document reports
Persistence: policy_configs, violation_records (sampled), analytics_events (sampled)
```

**Gateway**
```
Purpose:     Manages endpoint configurations, protocol translation, traffic routing.
Input:       validateRequest(raw: unknown): TRequest
Execution:   process(request, routingConfig): Promise<GatewayResult>
Output:      forwardedRequest or blockedResponse, transformedPayload (optional), diagnostics
Jobs:        No (config changes are synchronous)
Reporting:   Traffic dashboards, configuration audit trail
Persistence: endpoint_configs, routing_rules, traffic_metrics
```

### 8.3 Capability Composition

Capabilities tell the product which shared subsystems to instantiate. The `create-product` tool reads the manifest and scaffolds accordingly.

| Capability | Effect on Product |
|-----------|------------------|
| `reporting` | Adds `packages/reporting` dependency. Requires `ReportTemplate` implementation. |
| `scheduling` | Configures pg-boss scheduler in worker. Adds scheduled-run UI. |
| `remediation` | Adds remediation code fields to findings schema. Adds remediation UI. |
| `transformation` | Enables artifact generation in engine output. |
| `policy` | Adds policy configuration UI and `PolicyDecision` types. |
| `ai-assisted` | Adds `AIModelPort` to providers. Requires `requiresAIProvider: true` in manifest. |
| `streaming` | Enables Server-Sent Events for streaming output from engine. |

Capabilities are declared, not inherited. A product that declares `capabilities: ['reporting', 'scheduling']` gets scaffolding for those features. A product that declares `capabilities: []` gets none.

### 8.4 Product Archetype Assignments (All 20)

| # | Product | Primary Archetype | Capabilities |
|---|---------|------------------|-------------|
| 1 | MCP Gateway | Gateway | transformation, policy |
| 2 | MCP Security Auditor | Analyzer | reporting, scheduling |
| 3 | Prompt Injection Shield | Middleware | policy, ai-assisted |
| 4 | AI Agent Deadlock Interceptor | Middleware | policy, ai-assisted |
| 5 | Next.js Action Security Auditor | Analyzer | reporting |
| 6 | Tree-Sitter AST Scanner | Analyzer | reporting, scheduling |
| 7 | OpenAPI Drift Detector | Analyzer | reporting |
| 8 | GraphQL N+1 Inspector | Analyzer | reporting |
| 9 | PostgreSQL EXPLAIN Repair | Analyzer | reporting, remediation, optimization |
| 10 | PostgreSQL Bloat Analyzer | Analyzer | reporting, remediation |
| 11 | pgvector HNSW Optimizer | Optimizer | reporting, remediation |
| 12 | K8s RBAC Analyzer | Analyzer | reporting, scheduling |
| 13 | K8s Secret Scanner | Analyzer | reporting, scheduling |
| 14 | K8s Right-Sizing | Optimizer | reporting, remediation |
| 15 | OAuth PKCE Middleware | Middleware | policy |
| 16 | JWT Scanner | Analyzer | reporting |
| 17 | GraphQL Rate Limiter | Middleware | policy |
| 18 | SBOM Generator | Generator | reporting |
| 19 | CVE Risk Analyzer | Analyzer | reporting, scheduling, ai-assisted |
| 20 | License Compliance Scanner | Analyzer | reporting, scheduling |

---

## 9. Final Domain Contracts

### 9.1 Classification Principles

Three questions determine a primitive's classification:

1. Is it used identically by two or more products across different archetypes? → Shared primitive.
2. Is it meaningful only within one archetype's domain? → Archetype-specific.
3. Would sharing it require artificial adaptation to fit products that have different but superficially similar concepts? → Keep product-specific or make optional.

### 9.2 Complete Primitive Classification

| Primitive | Classification | Who Uses It | In packages/domain? | Mandatory? |
|-----------|---------------|-------------|-------------------|------------|
| `Result<T, E>` | REQUIRED SHARED | All products | Yes (`packages/shared`) | Yes — every engine returns one |
| `JobStatus` | REQUIRED SHARED (where jobs exist) | Analyzer, Optimizer, Generator (when async) | Yes | Yes for products with jobs |
| `Severity` | OPTIONAL SHARED | Analyzer, Optimizer | Yes | No — products opt in |
| `BaseFinding` | OPTIONAL SHARED | Analyzer, Optimizer (where findings apply) | Yes | No — not mandatory |
| `Recommendation` | OPTIONAL SHARED | Analyzer, Optimizer | Yes | No — field in finding or standalone |
| `ReportSummary` | OPTIONAL SHARED | Analyzer, Optimizer, Generator (summary) | Yes | No — reporting capability only |
| `Diagnostic` | OPTIONAL SHARED | Generator, Transformer, Gateway | Yes | No |
| `Metric` | OPTIONAL SHARED | Optimizer | Yes | No — Optimizer capability only |
| `Artifact` | OPTIONAL SHARED | Generator, Transformer, Gateway (when transforming) | Yes | No |
| `PolicyDecision` | OPTIONAL SHARED | Middleware, Gateway | Yes | No — policy capability only |
| `Remediation` | ARCHETYPE-SPECIFIC | Optimizer (remediation capability) | Yes (optional) | No |
| Finding categories | PRODUCT-SPECIFIC | Each product defines its own | No | N/A |
| Input shapes | PRODUCT-SPECIFIC | Every product has different input | No | N/A |
| Evidence structure | PRODUCT-SPECIFIC | Every analyzer has different evidence | No | N/A |
| Scoring algorithms | PRODUCT-SPECIFIC | Each product defines severity meaning | No | N/A |

### 9.3 Primitive Definitions

**Result\<T, E\>** (required shared — lives in `packages/shared`)
```
Why: Every engine function returns either a success value or a typed error.
     Result<T, E> makes this explicit without throwing exceptions.
Who: All archetype engine contracts use it.
Mandatory: Yes.
```

**JobStatus** (required shared where jobs exist — lives in `packages/domain`)
```
Why: Any product using the job queue needs consistent status vocabulary.
Who: Analyzer, Optimizer, Generator (async), and the JobQueuePort itself.
Mandatory: For products with jobs only.
Values: PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
```

**Severity** (optional shared — lives in `packages/domain`)
```
Why: 16 of 20 products produce findings with severity levels.
     A shared enum means consistent language across products.
Who: Analyzer and Optimizer products.
Mandatory: No. Products may define their own severity if the standard doesn't fit.
Values: CRITICAL, HIGH, MEDIUM, LOW, INFO
```

**BaseFinding** (optional shared — lives in `packages/domain`)
```
Why: The core structure of a security/quality finding is genuinely shared
     across 14+ products. Sharing the structure enables shared reporting
     infrastructure.
Who: Analyzer and Optimizer products that produce findings.
Mandatory: No. A product may define its own finding shape if BaseFinding
     doesn't fit. If it doesn't use BaseFinding, it cannot use the shared
     reporting subsystem's finding-specific generators.
Fields: id, severity, category, title, description,
        evidence (unknown — product-specific), recommendation (optional),
        remediationCode (optional), references (optional)
```

**Recommendation** (optional shared — lives in `packages/domain`)
```
Why: Analyzers and Optimizers both produce recommendations.
     As a separate type it enables recommendation tracking independent
     of findings (e.g., Optimizer may produce recommendations without findings).
Who: Analyzer (as field in finding), Optimizer (as standalone entity).
Mandatory: No.
Note: When used as a field in BaseFinding, it is a string. When standalone
     (Optimizer), it is a typed object with priority and effort fields.
```

**ReportSummary** (optional shared — lives in `packages/domain`)
```
Why: Report generation needs a consistent summary shape to drive shared
     HTML/Markdown/JSON generators.
Who: Products with the 'reporting' capability.
Mandatory: No — only for reporting capability.
Fields: totalFindings, findingsBySeverity, score (optional), generatedAt, metadata
```

**Diagnostic** (optional shared — lives in `packages/domain`)
```
Why: Generator, Transformer, and Gateway products produce informational
     messages that are not findings (no severity, no remediation implied).
Who: Generator, Transformer, Gateway.
Mandatory: No.
Fields: level (info/warning/error), message, code (optional), context (unknown)
```

**Metric** (optional shared — lives in `packages/domain`)
```
Why: Optimizer products produce quantified measurements.
Who: Optimizer archetype only.
Mandatory: No — only for Optimizer.
Fields: name, value, unit, baseline (optional), target (optional), timestamp
```

**Artifact** (optional shared — lives in `packages/domain`)
```
Why: Generator, Transformer, and Gateway (when outputting transformed payloads)
     all produce files or data blobs. A shared Artifact type enables shared
     storage handling.
Who: Generator, Transformer, Gateway (transformation capability).
Mandatory: No.
Fields: key, contentType, size, metadata
```

**PolicyDecision** (optional shared — lives in `packages/domain`)
```
Why: Middleware and Gateway products both produce pass/fail/transform decisions.
     Sharing this type enables shared policy logging and dashboard components.
Who: Middleware, Gateway.
Mandatory: No — only for policy capability.
Fields: action (allow/block/transform/rate-limit), reason (optional),
        transformed (unknown, optional), latencyMs, metadata
```

**Remediation** (optional shared, Optimizer-oriented — lives in `packages/domain`)
```
Why: Optimizer products (and Analyzer products with remediation capability)
     produce actionable fix instructions.
Who: Optimizer (remediation capability), Analyzer (remediation capability).
Mandatory: No.
Fields: description, code (optional — SQL/YAML/shell), effort, automated (boolean)
```

### 9.4 What Remains Product-Specific (Not Abstracted)

These concepts are explicitly not placed in `packages/domain`:

- **Finding categories** — every product defines its own taxonomy (`seq_scan`, `jwt_alg_confusion`, `rbac_privilege_escalation`).
- **Evidence structure** — the raw data that produced a finding is product-specific (EXPLAIN output, JWT header, Kubernetes manifest).
- **Input shapes** — every product has different valid input (connection string, token string, repository path, Kubernetes API endpoint).
- **Scoring logic** — what makes a finding CRITICAL vs. HIGH is domain-specific.
- **Remediation templates** — SQL for database products, YAML for Kubernetes products.
- **Business rules** — entitlement logic, usage limits, and plan features are product-specific.

---

## 10. Final UI/Theme Architecture

### 10.1 Principle Confirmed

Theme tokens, not visual templates. The `packages/ui` package provides structural primitives. Products define visual identity via design tokens. Two products built on the same framework must be capable of looking substantially different.

### 10.2 Design Token Schema

```typescript
// packages/ui/src/theme/types.ts

export interface ThemeTokens {
  colors: {
    brand: {
      primary: string;                   // HSL string
      primaryForeground: string;
      secondary: string;
      secondaryForeground: string;
      accent: string;
      accentForeground: string;
    };
    surface: {
      background: string;
      foreground: string;
      muted: string;
      mutedForeground: string;
      border: string;
      input: string;
      ring: string;
    };
    semantic: {
      success: string;
      warning: string;
      error: string;
      info: string;
    };
    severity?: {                         // Optional — Analyzer/Optimizer products
      critical: string;
      high: string;
      medium: string;
      low: string;
      info: string;
    };
  };

  typography: {
    fontFamily: {
      sans: string;                      // CSS font-family string
      mono: string;
    };
    scale: 'compact' | 'default' | 'relaxed';
    headingWeight: '400' | '500' | '600' | '700';
    monoProminence: 'low' | 'normal' | 'high'; // How prominent monospace is in UI
  };

  spacing: {
    base: number;                        // Base unit in px (typically 4)
    scale: 'tight' | 'default' | 'loose';
  };

  density: 'compact' | 'default' | 'comfortable';

  borders: {
    radius: 'none' | 'sm' | 'md' | 'lg' | 'full';
    width: 'thin' | 'default' | 'thick';
    style: 'solid' | 'dashed' | 'none';
  };

  shadows: 'none' | 'subtle' | 'default' | 'prominent';

  navigation: {
    style: 'sidebar' | 'topnav' | 'minimal' | 'hybrid';
    sidebarWidth?: 'narrow' | 'default' | 'wide';
    sidebarVariant?: 'floating' | 'inset' | 'default';
  };

  components: {
    card: 'flat' | 'bordered' | 'elevated' | 'glass';
    button: 'default' | 'sharp' | 'rounded';
    input: 'default' | 'underline' | 'filled';
    table: 'default' | 'striped' | 'minimal' | 'bordered';
    badge: 'default' | 'pill' | 'square';
  };

  charts?: {                             // Optional — products using charts
    style: 'minimal' | 'detailed' | 'filled';
    colorPalette: string[];
    gridLines: boolean;
    animations: boolean;
  };

  icons: {
    set: 'lucide' | 'heroicons' | 'radix' | 'custom';
  };

  product: {
    name: string;
    tagline?: string;
    logoMark?: string;                   // SVG string or URL
    wordmark?: string;                   // SVG string or URL
  };
}
```

### 10.3 What the UI Package Provides

| Provided | Not Provided |
|----------|-------------|
| Primitive components (Button, Input, Card, Dialog, Select, Tabs, Table, Badge, Checkbox, Toggle) | Color choices |
| Composite components (DataTable, FormField, StatusBadge, SeverityBadge, EmptyState, LoadingState, Pagination) | Typography choices |
| Layout shells (Shell, Sidebar, TopNav — structural, unstyled) | Landing page layouts |
| Chart container components (wraps any chart library) | Chart library selection |
| ThemeTokens interface (the contract) | Token values |
| CSS custom property application system | Navigation item content |
| Theme defaults (overridable baseline) | Product wordmark/logo |
| SeverityBadge primitive (uses severity tokens if defined) | Severity category definitions |

### 10.4 Visual Differentiation in Practice

A security tool product vs. a database tool product differ by:

- Color palette: security tool uses dark navy/red alerts; database tool uses blue-green with amber warnings
- Navigation: security tool uses narrow sidebar (data-dense); database tool uses default sidebar with section grouping
- Typography scale: security tool uses compact (more findings visible); database tool uses default
- Monospace prominence: database tool has high mono prominence (SQL output everywhere); security tool has normal
- Card style: security tool uses bordered (clear data boundaries); database tool uses elevated
- Chart style: security tool uses minimal; database tool uses detailed (performance graphs)
- Severity system: security tool has prominent severity colors; database/infrastructure tools may use performance-oriented color scales

These differences are expressed entirely through token overrides. Zero UI code is duplicated.

### 10.5 Landing Pages

Landing pages are product-owned. The UI package provides structural primitives (Hero, FeatureList, PricingTable, CTA, Testimonials — unstyled). Products compose these with their own layout, copy, imagery, and visual identity. The same primitive renders completely differently with different token values and layout choices.

---

## 11. Final Security Architecture

### 11.1 Honest Statement

The framework provides security primitives. Security must be implemented per product. The existence of an `AuthPort` does not mean a product is authenticated. The existence of a `withOrg()` helper does not mean a product enforces tenant isolation. The developer must call these correctly in every relevant location.

The following table distinguishes what the framework provides from what the developer must implement.

### 11.2 Security Requirements by Layer

| Security Concern | Framework Provides | Developer Must Implement |
|-----------------|-------------------|------------------------|
| **Authentication** | AuthPort, Clerk adapter, middleware pattern | Call `authMiddleware.protect()` in `middleware.ts`. Call `authPort.requireUser()` in every protected Server Action. |
| **Authorization** | `getOrganization()`, org types | Verify the authenticated user belongs to the organization for every resource access. Never trust a URL parameter alone. |
| **Tenant isolation** | `withOrg()` helper, ESLint rule detecting unscoped queries | Use `withOrg()` in every query on a tenant-scoped table. No exceptions. |
| **Input validation** | Zod schemas in `packages/domain` | Define Zod schemas for every Server Action input and API route body. Parse before using. |
| **Output sanitization** | React's default JSX escaping | Use DOMPurify for any user-supplied HTML rendered in reports. Do not render raw HTML without sanitization. |
| **CSRF protection** | Next.js Server Actions (built-in) | Use Server Actions for mutations, not raw API routes where possible. |
| **Rate limiting** | None provided by default | Implement middleware-based rate limiting on expensive endpoints (analysis triggers, API routes). |
| **Audit logging** | `platform.audit_events` table, `product_id` column | Insert an audit event for every significant mutation (project created, analysis started, report exported, settings changed). |
| **Secret management** | None (operational concern) | Store secrets in environment variables. Never commit secrets. Document all required variables in `docs/SETUP.md`. |
| **Security headers** | Shared config utility in `packages/shared` | Apply in `next.config.ts` via the shared config. Review CSP per product (some products serve more dynamic content). |
| **Dependency security** | `pnpm audit` in CI | Review audit results. Update vulnerable dependencies. Do not ship with known high/critical vulnerabilities. |
| **SQL injection** | Drizzle ORM parameterized queries | Never concatenate strings into Drizzle queries. Use Drizzle's sql template literal with typed parameters if raw SQL is needed. |
| **Sensitive data at rest** | None provided by default | Encrypt credential fields (DB connection strings, API keys stored by user) using AES-256-GCM. Key stored in environment variable. |
| **Credential handling** | None provided by default | Never log credential values. Mark credential fields as sensitive in Zod schemas. Scrub from error messages. |

### 11.3 Security Requirements for Specific Archetypes

**Analyzer and Optimizer products** that accept user-supplied credentials (database connection strings, API keys, kubeconfig, cloud credentials):

- Encrypt at rest. Encryption key is a product-specific environment variable.
- Validate credential format before use (Zod schema).
- Use credentials ephemerally during analysis. Do not store raw credential values in job records, logs, or error messages.
- Document the credential lifecycle in `docs/SECURITY.md`.
- Test: attempt to retrieve another organization's credentials via API (IDOR test).

**Runtime Middleware products:**

- The middleware logic itself must be reviewed for injection (particularly prompt injection for AI-adjacent products).
- Policy bypass attempts must be included in E2E security tests.
- Request sampling/logging must not capture sensitive request bodies.

**Gateway products:**

- Protocol translation must not introduce injection vulnerabilities (e.g., SOAP/REST → MCP translation must sanitize inputs).
- Endpoint configurations must be scoped to the organization that created them.

---

## 12. Final Testing Architecture

### 12.1 Coverage as a Signal, Not a Gate

> Code coverage is a quality signal, not proof of correctness. A product with 90% coverage and superficial tests is less ready than one with 75% coverage and thorough edge-case tests.

The launch gate requires 80% domain code coverage AND a set of test categories that must be present. Coverage is measured but not sufficient alone.

### 12.2 Required Test Categories for Launch

For every product, the following test categories must be demonstrably present:

| Category | What It Tests | Required? |
|----------|--------------|-----------|
| **Normal-case tests** | Expected input produces expected output | Yes |
| **Edge-case tests** | Boundary values, empty inputs, maximum sizes | Yes |
| **Invalid-input tests** | Malformed, unexpected, wrong-type inputs | Yes |
| **Failure tests** | What happens when a dependency fails | Yes |
| **Security tests** | Auth bypass, IDOR, injection, unscoped data access | Yes |
| **Integration tests** | Server Actions + DB queries + job creation | Yes |
| **Critical-path E2E** | Signup → core workflow → output | Yes |
| **Regression tests** | Tests for any bug found post-launch | At first bug |
| **Conformance tests** | Active adapters pass port conformance suites | Yes |

### 12.3 Test Anti-Patterns to Reject

AI agents are capable of generating tests that increase coverage without increasing confidence. The human review gate must reject:

- Tests that mock every dependency and test only the mock wiring
- Tests that assert output equals a hard-coded copy of the implementation's own output
- Tests with no assertions
- Tests that do not cover the described behavior
- Tests that pass vacuously (assertions on always-true conditions)
- E2E tests that only test the happy path with no error or validation scenarios

### 12.4 Test Architecture by Layer

| Layer | Test Type | Tool | Location |
|-------|-----------|------|----------|
| Domain engine | Unit | Vitest | `apps/[product]/src/domain/__tests__/` |
| Zod schemas | Unit | Vitest | Co-located with schemas |
| Feature modules | Unit + Integration | Vitest | `apps/[product]/src/features/[name]/__tests__/` |
| Server Actions | Integration (test DB) | Vitest | `apps/[product]/src/__tests__/integration/` |
| API routes / webhooks | Integration | Vitest | `apps/[product]/src/__tests__/integration/` |
| Report generation | Integration | Vitest | `apps/[product]/src/__tests__/integration/` |
| Adapter conformance | Conformance | Vitest | `packages/testing/src/conformance/` |
| Critical paths | E2E | Playwright | `apps/[product]/e2e/flows/` |
| Security scenarios | E2E | Playwright | `apps/[product]/e2e/security/` |

### 12.5 Archetype-Specific Test Requirements

| Archetype | Additional Required Tests |
|-----------|--------------------------|
| Analyzer | Domain engine with known-malicious inputs. Finding severity assignment tests. |
| Optimizer | Metric calculation tests. Recommendation threshold tests. |
| Generator | Output format validation. Artifact schema validation. |
| Transformer | Protocol translation correctness. Round-trip tests where applicable. |
| Middleware | Policy enforcement tests. Bypass attempt tests. Decision correctness tests. |
| Gateway | Routing correctness. Protocol transformation tests. Org-scoped endpoint isolation. |

---

## 13. Final CI/CD Architecture

### 13.1 Pipeline Stages

```
ON EVERY PUSH / PR:

1. DETECT CHANGES
   └── Turborepo affected analysis
       Only affected packages/apps proceed to subsequent stages

2. STATIC ANALYSIS (parallel, fast)
   ├── TypeScript: tsc --noEmit (zero errors required)
   ├── ESLint: lint + boundary rules (zero violations)
   └── Architecture check: tools/arch-check (all checks)

3. DEPENDENCY SECURITY
   └── pnpm audit --audit-level=high (high/critical = blocking)

4. UNIT TESTS
   └── Vitest (affected packages/apps only, via Turborepo)

5. INTEGRATION TESTS
   └── Vitest (requires test database connection)

6. BUILD
   ├── Next.js build (pnpm build)
   └── Docker build (docker build)

7. DOCUMENTATION CHECK
   └── tools/validate-docs (all 11 documents, non-stub content)

8. E2E TESTS (after build)
   └── Playwright (critical paths + security scenarios)

ON MAIN BRANCH ONLY (after all above pass):

9. DEPLOY
   └── Triggered per-product via deploy.yml

MONTHLY (scheduled):

10. EXTRACTION VALIDATION
    └── tools/extract-product → validate → report artifact
```

### 13.2 Mandatory Gates (Blocking)

| Gate | Failure Action |
|------|---------------|
| TypeScript compiles | Block merge |
| ESLint passes | Block merge |
| Architecture check passes | Block merge |
| No high/critical npm vulnerabilities | Block merge |
| Unit tests pass | Block merge |
| Integration tests pass | Block merge |
| Build succeeds | Block merge |
| Docker build succeeds | Block merge |
| E2E critical paths pass | Block merge |
| Documentation complete | Block merge |
| Domain coverage ≥ 80% | Block merge (signal — see 12.1) |

### 13.3 Warning-Only Checks (Not Blocking)

| Check | Action |
|-------|--------|
| Unused dependencies (depcheck) | Warning in CI report |
| Code duplication >5% (jscpd) | Warning in CI report |
| Unused exports (ts-prune) | Warning in CI report |
| Extraction validation failed | High-priority alert (investigated same day) |

---

## 14. Final AI Coding Architecture

### 14.1 Principles Confirmed

- AI agents are bounded tools.
- Humans make all architecture decisions.
- AI agents operate under explicit file manifests.
- The pre-commit hook enforces manifests mechanically.
- Two-agent review process (implementation + review, separate sessions).
- Review agent's authority: compliance review only. Not architectural authority.

### 14.2 Final AI Task Contract

```markdown
## FORGE TASK CONTRACT — [FORGE-PRODUCT-NNN]

### Classification
Product: [product-name]
Archetype: [primary archetype]
Layer: [PRESENTATION | FEATURES | DOMAIN | WIRING]
Type: [NEW_FEATURE | BUG_FIX | REFACTOR | TEST | DOCUMENTATION]

### Objective
[Single, specific, testable statement. One contract = one objective.]

### Architecture Rules Applied
[Reference specific rules from .ai/rules.md by principle number, e.g., P4, P5, P11]

### Context (READ ONLY — do not modify)
[List files the agent must read to understand context]

### Allowed Created Files
[Exact paths. Every file not listed here that appears in the diff is a violation.]

### Allowed Modified Files
[Exact paths. Every file not listed here that is modified is a violation.]

### Forbidden Files (do not read, do not modify, do not create near)
- apps/[product]/src/providers.ts         (wiring — separate task)
- apps/[product]/src/domain/engine.ts     (domain — separate task, unless this IS a domain task)
- packages/**                              (shared packages — separate task)
- apps/[other-product]/**                  (other products — forbidden)

### Interfaces and Contracts Used
[List the specific port interfaces, archetype contracts, or shared types this task interacts with]

### New Dependencies
[ ] None (strongly preferred)
[ ] Authorized: [package-name] — [concrete reason]

### Acceptance Criteria
[Each criterion must be verifiable by reading or running the code]
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] TypeScript compiles with zero errors
- [ ] ESLint passes with zero boundary violations
- [ ] All required tests present and passing

### Required Tests
- [ ] Normal-case: [describe]
- [ ] Edge-case: [describe]
- [ ] Invalid-input: [describe]
- [ ] Failure: [describe]

### Explicit Non-Goals (do not implement, do not refactor)
- [ ] Do not modify files outside the allowed list above
- [ ] Do not add abstractions not required by this specific task
- [ ] Do not refactor existing code that is outside task scope
- [ ] Do not create files not listed above
- [ ] Do not add dependencies not authorized above
- [ ] [Any domain-specific non-goals]

### AI Self-Review Before Submission
- [ ] I only created/modified files listed above
- [ ] I did not import any vendor SDK outside packages/adapters/
- [ ] I did not import any infrastructure package in domain/ code
- [ ] I did not import from another product
- [ ] All new inputs are validated with Zod
- [ ] All DB queries on tenant-scoped tables include organizationId
- [ ] I did not add any unauthorized dependency
- [ ] Required tests are present and test real behavior
- [ ] I did not refactor code outside task scope
```

### 14.3 Two-Agent Review Protocol

**Implementation agent (Agent 1):**
- Receives: task contract + context files + pattern documentation from `.ai/patterns/`
- Produces: implementation within allowed files
- Runs: self-review checklist before submitting

**Review agent (Agent 2 — fresh session, different context window):**
- Receives: task contract + diff only (no implementation agent reasoning)
- Reviews against: does the implementation satisfy the acceptance criteria? does it violate any explicit constraints? are the tests meaningful?
- Does NOT: make architecture decisions, redesign the approach, comment on style preferences
- Returns: specific, addressable findings or "LGTM"

**Human (final authority):**
- Reviews: the diff, the review agent report, test results
- Decides: merge, request changes, or escalate to architecture review
- Checks: no architectural changes were made without authorization

**Conflict resolution:**
- Implementation agent and review agent disagree → human decides
- Review agent recommends architecture change → human evaluates separately
- Review agent finds boundary violation → implementation agent must fix before human review

### 14.4 Bloat Prevention Mechanisms

| Bloat Type | Prevention Mechanism |
|-----------|---------------------|
| Unnecessary files | Pre-commit hook: file manifest enforcement |
| Unnecessary dependencies | lock-file diff check on every PR; authorized list in task contract |
| Duplicate utilities | `jscpd` in CI (warning); check `packages/shared` first instruction in `.ai/boundaries.md` |
| Speculative abstraction | Architecture rule P6: two consumers before extraction |
| Unrelated refactoring | Non-goal in task contract; pre-commit file manifest |
| Test theater | Human review required; review agent checks test meaningfulness |
| Documentation theater | `validate-docs` checks length and required sections |

---

## 15. Final Architecture-Check System

### 15.1 Design Principle

Use the simplest mechanism capable of reliably enforcing each rule. Not every check needs a custom tool.

### 15.2 Complete Check Specification

| # | Check | Mechanism | Blocking | Notes |
|---|-------|-----------|---------|-------|
| 1 | **Vendor leakage** — vendor SDK imported outside its adapter | ESLint `no-restricted-imports` per package (configured per vendor SDK name) | Yes | Runs pre-commit on changed files. Full scan in CI. |
| 2 | **Domain → infrastructure** — domain/ importing db, auth, billing, etc. | ESLint `boundaries` plugin: domain group cannot import infrastructure group | Yes | Domain group = `apps/*/src/domain/**`. Infrastructure = db, auth, billing, jobs, adapters, next, react |
| 3 | **Cross-product import** — product A importing from product B | ESLint `boundaries` plugin: apps group cannot import from other apps | Yes | |
| 4 | **Circular dependencies** | `madge --circular` on the package import graph (not file level) | Yes | Runs in `tools/arch-check`. Madge parses TypeScript via `--ts-config`. |
| 5 | **Unauthorized dependencies** — new package added without task authorization | CI diff of `package.json` files; new entries require PR description acknowledgment | Yes | Human reviewer verifies. Not fully automated — lock file diff flags for attention. |
| 6 | **Unused dependencies** | `depcheck` per package | Warning | Not blocking — some packages are peer deps or type-only |
| 7 | **Package boundary violations** — import path violating declared boundaries | TypeScript project references (compile fails) + ESLint boundaries | Yes | TypeScript project references enforce at compile time |
| 8 | **Adapter bypass** — adapter package imported anywhere except `providers.ts` | ESLint custom rule: `packages/adapters/*` import forbidden except in `providers.ts` path pattern | Yes | |
| 9 | **Unscoped DB access** — query on tenant-scoped table without organizationId | ESLint custom rule that recognizes Drizzle `.where()` patterns on known tenant-scoped tables | Yes | Tables declared in a config file read by the ESLint rule |
| 10 | **Forbidden framework imports in domain** — next, react, node APIs in domain/ | ESLint `no-restricted-imports` on the domain/ directory | Yes | |
| 11 | **Missing product isolation** — product schema without product_id in audit/usage | Custom script in `tools/arch-check` that parses Drizzle schema files | Warning | Flags schemas that use platform.audit_events without product_id |
| 12 | **Prohibited imports in shared kernel** — packages/shared importing anything external | ESLint boundaries: shared-kernel group may only import zod | Yes | |

### 15.3 Check Execution Schedule

```
Pre-commit (changed files only, fast):
  Checks 1, 2, 3, 8, 9, 10

PR (full repo, thorough):
  All 12 checks via tools/arch-check
  TypeScript project reference compilation
  Circular dependency check (madge)

CI on main:
  All checks + depcheck (Check 6) + extraction validation

Weekly:
  pnpm audit (vulnerability scan)

Monthly:
  tools/extract-product → extraction validation report
```

---

## 16. Final Product Extraction System

### 16.1 Honest Statement of Automation vs. Human Work

**Automated extraction** produces a standalone repository with a verified build and test run. It does NOT perform human engineering work.

**Human acquisition migration** is the additional work an acquiring team does to integrate the product into their existing infrastructure, replace providers, and adapt to their coding standards.

The extraction tool is responsible for the former. Documentation is responsible for preparing the acquirer for the latter.

### 16.2 Dependency Classification per Shared Package

When extracting a product, every shared package is classified:

| Package | Classification | Reason |
|---------|---------------|--------|
| `packages/shared` | COPY | Small, foundational. Product owns the copy going forward. |
| `packages/domain` | COPY | Archetype contracts and primitives the product depends on. |
| `packages/config` | COPY | ProductManifest types. |
| `packages/ui` | COPY | Product's visual identity depends on this. The copy diverges. |
| `packages/auth` | COPY | Port interfaces only. No vendor code. |
| `packages/billing` | COPY | Port interfaces only. |
| `packages/email` | COPY | Port interfaces only. |
| `packages/analytics` | COPY | Port interfaces only. |
| `packages/jobs` | COPY | Port interfaces only. |
| `packages/storage` | COPY | Port interfaces only. |
| `packages/ai-provider` | COPY if used | Port interfaces only. |
| `packages/db` | COPY | Shared platform schema + Drizzle client. |
| `packages/reporting` | COPY if capability declared | The reporting subsystem. |
| `packages/testing` | COPY | Test utilities and conformance suites. |
| `packages/adapters/[active adapters only]` | COPY | Only adapters used by this product. Inactive adapters are not copied. |
| `packages/adapters/[inactive]` | REMOVE | Not needed. Reduces confusion. |
| `tools/arch-check` | COPY and RECONFIGURE | Acquiring team should run arch checks. |
| `tools/extract-product` | REMOVE | Not relevant to a standalone product. |
| `tools/create-product` | REMOVE | Not relevant to a standalone product. |
| `tools/validate-docs` | COPY | Documentation validation remains relevant. |
| `.ai/` | COPY | Helps acquiring team understand AI constraints. They adapt rules for their team. |

### 16.3 Extraction Workflow

```
1. PREPARATION
   tools/extract-product --product=[name] --output=../[name]-standalone

2. AUTOMATED STEPS (tools/extract-product performs):
   a. Classify all shared packages (table above)
   b. Copy product application (apps/[product]/ → standalone root)
   c. Copy classified packages (packages/ → standalone/packages/)
   d. Remove inactive adapters
   e. Generate standalone package.json, pnpm-workspace.yaml, turbo.json
   f. Transform internal import paths (workspace:* → relative file:)
   g. Export database snapshot (tools/extract-product calls db-snapshot logic)
       i.  pg_dump --schema=[product_schema] → product-schema.sql
       ii. Export platform rows for product's organizations → platform-data.sql
   h. Generate EXTRACTION-REPORT.md
   i. Validate: pnpm install → typecheck → lint → arch-check → test:unit → build → docker build

3. VALIDATION OUTPUT
   Pass: Extraction produces a verified standalone repository.
   Fail: Report identifies which validation step failed. This is a production defect.

4. HUMAN ACQUISITION MIGRATION (not automated — performed by acquirer):
   a. Replace providers in providers.ts (Clerk → their auth, Stripe → their billing, etc.)
   b. Run conformance tests for their adapters
   c. Restore database from snapshot to their infrastructure
   d. Update DATABASE_URL and other environment variables
   e. Configure their deployment infrastructure
   f. Run E2E tests against their deployment
   g. Review and adapt .ai/ rules for their team's workflow
```

### 16.4 EXTRACTION-REPORT.md Contents

The extraction tool automatically generates:

```
EXTRACTION REPORT — [product-name]
Generated: [timestamp]

PRODUCT OVERVIEW
  Display name: [...]
  Primary archetype: [...]
  Capabilities: [...]

WHAT WAS EXTRACTED
  Application code: apps/[product]/ → [standalone root]
  Packages copied: [list with version]
  Packages removed: [list]
  Adapters included: [list of active adapters]
  Adapters excluded: [list]

DATABASE
  Product schema: [schema_name]
  Platform tables extracted: users (N rows), organizations (N rows), ...
  Snapshot files: product-schema.sql, platform-data.sql

VALIDATION RESULTS
  pnpm install: PASS
  typecheck: PASS
  lint: PASS
  arch-check: PASS
  test:unit: PASS (coverage: N%)
  build: PASS
  docker build: PASS

PROVIDER REPLACEMENT REQUIRED
  Auth (Clerk): See docs/PROVIDERS.md → Replacing Authentication
  Billing (Stripe): See docs/PROVIDERS.md → Replacing Billing
  Email (Resend): See docs/PROVIDERS.md → Replacing Email
  [... for each active provider]

HUMAN MIGRATION STEPS
  See docs/ACQUISITION.md for the complete acquisition migration guide.

KNOWN LIMITATIONS
  [Any manual steps, caveats, or known issues discovered during extraction]
```

---

## 17. Final Acquisition Handoff Model

### 17.1 What an Acquirer Receives

A standalone repository containing:
- The product application (verified building, testing, and running)
- All required shared packages (copied, version-locked at extraction point)
- Active provider adapters only
- Complete documentation (all 11 required documents + archetype-specific additions)
- E2E tests
- Working Dockerfile and docker-compose.yml
- EXTRACTION-REPORT.md
- .ai/ directory (for their team's AI tooling)

### 17.2 What an Acquirer Does Not Receive

- Other products from the portfolio
- Inactive adapters
- The monorepo tooling (create-product, extraction tools)
- The framework's CI pipeline (they build their own)
- Supabase access (they provision their own PostgreSQL)
- Clerk tenant (they set up their own auth provider or implement their own adapter)

### 17.3 Provider Replacement Documentation

Every `docs/PROVIDERS.md` contains, for each provider:

1. Which port interface it implements
2. Location of the adapter: `packages/adapters/[name]/`
3. Environment variables required
4. Conformance test command: `pnpm test --filter=@forge/testing -- [provider-name]`
5. Replacement procedure (≤5 steps):
   - Step 1: Implement `[PortName]` interface
   - Step 2: Pass conformance tests
   - Step 3: Update `providers.ts`
   - Step 4: Update environment variables
   - Step 5: Redeploy

---

## 18. Final Definition of Done

A product is launch-ready when every item below is verified. Building and deploying are necessary but not sufficient conditions.

### 18.1 Launch Gate Checklist

**Code Quality**
- [ ] TypeScript compiles with zero errors in strict mode
- [ ] ESLint passes with zero violations (boundary rules included)
- [ ] Architecture check passes (all 12 checks)
- [ ] No high or critical dependency vulnerabilities (`pnpm audit`)
- [ ] Domain code coverage ≥ 80% (signal — see P22)
- [ ] All required test categories present (normal, edge, invalid-input, failure, security)
- [ ] Integration tests pass against test database
- [ ] E2E critical paths pass
- [ ] E2E security scenarios pass (auth bypass, IDOR, injection)
- [ ] Conformance tests pass for all active adapters

**Infrastructure**
- [ ] Docker build succeeds (`docker build`)
- [ ] `docker compose up` starts the full local stack without errors
- [ ] Worker process starts without errors (if archetype requires worker)
- [ ] All required environment variables documented in `docs/SETUP.md`
- [ ] Deployment to target environment succeeds
- [ ] Production environment verified (not just build)

**Security**
- [ ] Authentication enforced on all protected routes
- [ ] Authorization check: users cannot access another organization's data
- [ ] All Server Action inputs validated with Zod
- [ ] Audit logging implemented for significant mutations
- [ ] Security headers applied (CSP, HSTS, X-Frame-Options, etc.)
- [ ] Sensitive data (credentials) encrypted at rest (if archetype handles credentials)

**Observability**
- [ ] Errors reach a logging destination (structured logs at minimum)
- [ ] Job failures are observable (pg-boss job status + notification)
- [ ] Critical failures generate an alert (email or notification)

**Documentation**
- [ ] All 11 required documents present and non-stub (> 200 words each)
- [ ] `docs/SETUP.md` contains complete environment variable list
- [ ] `docs/PROVIDERS.md` documents all active providers with replacement procedure
- [ ] `docs/SECURITY.md` accurately describes the product's security model
- [ ] `docs/ACQUISITION.md` contains complete handoff instructions

**Acquisition Readiness**
- [ ] Extraction validation passes (manual or automated)
- [ ] Database schema documented in `docs/DATABASE.md`

**Business**
- [ ] Billing plans configured in Stripe and product manifest
- [ ] Entitlement checks active on billable features
- [ ] Free tier limits enforced
- [ ] Upgrade path functional (checkout session)

---

## 19. Final Product Creation Pipeline

### 19.1 Complete Pipeline

```
PRODUCT SPECIFICATION (Human)
  Define: name, problem, target user, differentiation
  Determine: primary archetype + capabilities from the archetype guide
  Determine: billing model (per-seat, usage-based, flat)
  Output: written specification document

        ↓ [Human decision]

PRODUCT MANIFEST (Human + tool assistance)
  Create: product.manifest.ts with:
    - id (slug matching directory name)
    - displayName, tagline
    - primaryArchetype
    - capabilities[]
    - requiresWorker
    - requiresAIProvider
    - plans[] with limits and Stripe price IDs
  Output: product.manifest.ts

        ↓ [Human decision: manifest complete]

SCAFFOLDING (Automated)
  Command: pnpm create-product --manifest=product.manifest.ts
  Generates:
    - apps/[product]/ directory structure
    - next.config.ts, tailwind.config.ts, tsconfig.json, package.json
    - Dockerfile, Dockerfile.worker (if requiresWorker), docker-compose.yml
    - src/providers.ts (default adapters wired for all capabilities)
    - src/domain/engine.ts (skeleton implementing primary archetype contract)
    - src/domain/types.ts (placeholder product types)
    - src/domain/schemas.ts (placeholder Zod schemas)
    - src/db/schema.ts (extends shared schema with placeholder product tables)
    - src/worker/index.ts (if requiresWorker)
    - src/theme/tokens.ts (default tokens)
    - src/theme/globals.css (CSS variable application)
    - src/app/(marketing)/page.tsx (minimal placeholder landing)
    - src/app/(dashboard)/page.tsx (minimal placeholder dashboard)
    - docs/ (11 stubs — headings only, no content)
    - e2e/ (smoke test placeholder)
  Output: Valid product structure. arch-check passes. Build succeeds on skeleton.

        ↓ [Automated — verify scaffold builds]

DOMAIN DESIGN (Human, with AI assistance)
  Define: domain types (finding categories, input shapes, config shapes)
  Define: product-specific Drizzle schema tables
  Define: Zod schemas for all inputs
  Implement: domain engine logic (primary archetype contract)
  Write: domain unit tests
  Gate: domain tests pass, coverage ≥ 80%, zero infra imports in domain/
  Output: Working domain engine with tests

        ↓ [Human review: domain logic correct]

THEME SELECTION (Human)
  Edit: src/theme/tokens.ts — customize all token values
  Apply: CSS variables via globals.css
  Verify: Product looks visually distinct from other products
  Output: Product visual identity established

        ↓ [Human decision: visual identity acceptable]

PROVIDER CONFIGURATION (Human)
  Set up: External provider accounts (Clerk app, Stripe products/prices)
  Configure: Environment variables in .env.local
  Verify: providers.ts wires correct adapters
  Update: product.manifest.ts with Stripe price IDs
  Output: Providers connected and testable

        ↓ [Human verification: providers functional]

DATABASE DESIGN (Human + AI assistance, guided by domain design)
  Finalize: src/db/schema.ts (product-specific tables)
  Run: pnpm db:generate (Drizzle migration generation)
  Run: pnpm db:migrate (apply to development database)
  Verify: All tables created with correct columns and indexes
  Output: Database schema applied

        ↓ [Automated — migration succeeds]

AI TASK BREAKDOWN (Human)
  Decompose: implementation into bounded AI tasks
  Create: task contracts for each AI task
  Sequence: tasks respecting dependency order (domain before features, features before pages)
  Output: Ordered list of task contracts

        ↓ [Human decision: task breakdown complete]

IMPLEMENTATION (AI under task contracts, Human review)
  For each task contract:
    1. AI implements within allowed files
    2. AI runs self-review checklist
    3. Pre-commit hook enforces file manifest
    4. Review agent reviews diff
    5. Human reviews and merges
  Output: Features implemented

        ↓ [Automated checks on every commit]

AUTOMATED ARCHITECTURE CHECKS
  Run: tools/arch-check (all 12 checks)
  Run: TypeScript compilation
  Run: ESLint with boundary rules
  Gate: All checks pass
  Output: Architecture integrity verified

        ↓ [Automated — all checks pass]

TESTING
  Run: pnpm test:unit (domain + feature unit tests)
  Run: pnpm test:integration (Server Actions + DB)
  Verify: All required test categories present
  Verify: Domain coverage ≥ 80%
  Gate: All tests pass
  Output: Test suite complete

        ↓ [Automated — tests pass]

SECURITY VALIDATION
  Run: pnpm test:e2e --grep=security (auth bypass, IDOR, injection tests)
  Review: Auth enforcement on all protected routes
  Review: Tenant isolation correctness
  Review: Input validation completeness
  Review: Sensitive data handling
  Gate: All security tests pass, manual review complete
  Output: Security validation passed

        ↓ [Human review: security sign-off]

DOCUMENTATION
  Complete: All 11 required documents (not stubs)
  Run: tools/validate-docs (completeness check)
  Gate: All documents present, > 200 words, required sections present
  Output: Documentation complete

        ↓ [Automated — documentation check passes]

DOCKER BUILD
  Run: docker build (web process)
  Run: docker build -f Dockerfile.worker (if applicable)
  Run: docker compose up (local full-stack verification)
  Gate: All builds succeed, full stack runs
  Output: Docker images verified

        ↓ [Automated — Docker build passes]

DEPLOYMENT
  Deploy: Web process to target host
  Deploy: Worker process to target host (if applicable)
  Configure: Production environment variables
  Verify: Application starts and responds in production
  Verify: Database migrations applied in production
  Verify: Auth, billing, email providers connected in production
  Gate: Production environment functional
  Output: Product deployed

        ↓ [Human verification: production functional]

LAUNCH
  Activate: Billing plans (ensure Stripe webhook connected)
  Activate: Analytics tracking
  Monitor: First 24 hours for errors
  Output: Product launched

        ↓

MARKET FEEDBACK
  Collect: User feedback, support requests, analytics
  Decide: Iterate, pivot, or proceed to next product
```

### 19.2 Automation Classification

| Stage | Automation Level | Human Required |
|-------|-----------------|----------------|
| Scaffolding | Fully automated | Review output |
| Domain design | AI-assisted | Design decisions + review |
| Theme selection | Manual | Always |
| Provider configuration | Manual (external services) | Always |
| Database design | AI-assisted | Schema review |
| AI task breakdown | Manual | Always |
| Implementation | AI under contracts | Review every task |
| Architecture checks | Fully automated | Only if violations |
| Testing | AI-assisted generation | Review test quality |
| Security validation | Automated tests + manual review | Security sign-off |
| Documentation | AI-drafted | Content review |
| Docker build | Fully automated | Only if failures |
| Deployment | Semi-automated | Production verification |
| Launch | Manual | Always |

---

## 20. Final 14-Day Framework Implementation Plan

### 20.1 Revised Rationale

The plan validates the framework with two products of different archetypes before scaling. No time is spent building theoretical framework features that no product has yet required.

### 20.2 Implementation Sequence

**Days 1–4: Foundation**

| Day | Build | Validation Gate |
|-----|-------|----------------|
| **1** | Turborepo monorepo. pnpm workspace. TypeScript base config (strict). ESLint with boundaries plugin. `.ai/` directory with all rule documents. GitHub Actions skeleton with correct workflow triggers. `.github/CODEOWNERS`. | `pnpm install` succeeds. `pnpm lint` runs on empty codebase. |
| **2** | `packages/shared` (Result\<T,E\>, error types, pagination). `packages/config` (ProductManifest, Archetype enum, Capability enum, env schema). `packages/domain/primitives/` (all optional shared primitives — Severity, BaseFinding, JobStatus, Artifact, Diagnostic, Metric, PolicyDecision, ReportSummary, Recommendation). | All packages typecheck. No circular deps. Primitives exported correctly. |
| **3** | `packages/domain/archetypes/` (all 6 engine contracts). `packages/auth`, `packages/billing`, `packages/email`, `packages/analytics`, `packages/jobs`, `packages/storage`, `packages/ai-provider` (port interfaces only). | All ports typecheck. ESLint boundary rules enforce no adapter imports in ports. |
| **4** | `packages/db` (Drizzle client factory, full shared platform schema with `product_id` on usage_records and audit_events, `products` registry table, `withOrg()` helper, migration runner). Connect to Supabase. Run migrations. | Platform schema created in Supabase. `withOrg()` helper tested. Migration runner works. |

**Days 5–8: Adapters and Infrastructure**

| Day | Build | Validation Gate |
|-----|-------|----------------|
| **5** | `packages/testing` (conformance framework, factories, mock adapters for all ports). `packages/adapters/clerk` (AuthPort, AuthMiddleware, AuthWebhookHandler). Conformance tests for Clerk adapter. | Clerk conformance tests pass. |
| **6** | `packages/adapters/stripe` (BillingPort, BillingWebhookHandler). `packages/adapters/resend` (EmailPort). `packages/adapters/pg-boss` (JobQueuePort — implements all methods, connects to Postgres). Conformance tests for all. | All three adapters pass their conformance suites. |
| **7** | `packages/adapters/posthog` (AnalyticsPort, FeatureFlagPort). `packages/adapters/supabase-storage` (StoragePort). `packages/adapters/env-flags` (FeatureFlagPort fallback). `packages/adapters/openai` (AIModelPort). `packages/adapters/anthropic` (AIModelPort). | All adapters pass conformance. AIModelPort adapters tested with mock responses. |
| **8** | `packages/reporting` (ReportTemplate interface, json/markdown/html generators, Puppeteer PDF wrapper as optional, pipeline orchestrator). `packages/ui` (all primitives, composites, layout shells, chart containers, ThemeTokens interface, default tokens, CSS variable application). | Reporting pipeline produces valid JSON, Markdown, HTML. Two contrasting token sets render differently. |

**Days 9–10: Tooling and CI**

| Day | Build | Validation Gate |
|-----|-------|----------------|
| **9** | `tools/arch-check` (all 12 checks implemented). Pre-commit hook (file manifest enforcement). `tools/validate-docs`. Full GitHub Actions CI pipeline (`ci.yml`, `deploy.yml`, `arch-check.yml`, `extraction-validate.yml`, `security-audit.yml`). Full `turbo.json` task graph. | Plant a deliberate boundary violation. arch-check detects it. Remove violation. CI pipeline runs end-to-end. |
| **10** | `tools/create-product` (scaffolding for all 6 archetypes). `tools/extract-product` (classifier, copier, db-snapshot, validator, report generator). Vitest workspace configuration. Playwright base configuration. | `pnpm create-product` generates a valid Analyzer skeleton. arch-check passes on skeleton. `pnpm extract-product` runs (with no product yet — validates tool doesn't crash). |

**Days 11–14: First Product (Analyzer archetype validation)**

Product: **JWT Algorithm Confusion & None-Alg Scanner** (Product 16)

*Rationale:* Analyzer archetype (most common — 12 of 20 products). Domain logic requires no external infrastructure — analyzes a JWT string or file. Fast enough to run synchronously (validates path without worker first). Clear input/output. Well-understood security domain.

| Day | Build | Validation Gate |
|-----|-------|----------------|
| **11** | Scaffold: `pnpm create-product --name=jwt-scanner --archetype=analyzer`. Customize theme tokens (security tool identity: dark palette, compact density, prominent severity colors). Define domain types (finding categories: `none_alg`, `weak_hmac`, `alg_confusion`, `expired_claim`). Define Zod schemas. Define DB schema. Run migrations. Configure providers.ts. | Scaffold builds. arch-check passes on scaffold. docker compose up runs. |
| **12** | Implement `domain/engine.ts` (JWT parsing, algorithm validation, none-alg detection, confusion attack detection). Write domain unit tests covering all categories, edge cases, invalid inputs, malformed JWTs. | Domain tests pass. Coverage ≥ 80%. Zero infrastructure imports in domain/. |
| **13** | Implement features (scan submission, results display, finding detail, report export). Implement landing page. Configure Stripe. Configure Clerk. | Integration tests pass. E2E critical path: signup → scan JWT → view findings → export JSON report. |
| **14** | Write security E2E tests (auth bypass, IDOR — attempt to view another org's scan results). Complete all 11 documentation files. Full launch gate checklist. Docker build. Deploy to Vercel (web) + worker host. | **All launch gate items checked. Product deployed.** |

**Days 15–21: Second Product (Generator archetype validation)**

Product: **SBOM Generator** (Product 18)

*Rationale:* Generator archetype (different from Analyzer — validates archetype system works for a different contract). Domain logic also self-contained (analyses dependency files). Validates that `capabilities: ['reporting']` scaffolding works. Validates that a product with different visual identity builds correctly on the same framework.

The second product confirms:
- The archetype system works for a genuinely different product shape
- Shared packages produce correct output across two products
- The framework is not accidentally coupled to Analyzer patterns
- Theme token system produces a genuinely different visual result

After two products validate these properties, the framework is confirmed. Subsequent products can be built with confidence.

### 20.3 Post-Day-21 Constraint

After two validated products: a maximum of one day of framework changes between each subsequent product. If building Product 3 reveals a shared package needs extension, extend it in one day and continue. Do not pause product development for framework refinement cycles.

---

## 21. Final V2 → V3 Decision Log

Only actual changes from v2 are recorded. Unchanged decisions are not repeated.

---

**Change 1**

V2 DECISION: Products belong to exactly one primary archetype.

V3 DECISION: Products have a primary archetype and declare optional capabilities in `product.manifest.ts`.

REASON: Five of the 20 products span multiple behavioral categories (MCP Gateway: transformer + gateway + policy; PostgreSQL EXPLAIN Repair: analyzer + optimizer + remediation; Prompt Injection Shield: middleware + AI-assisted; CVE Analyzer: analyzer + AI-assisted + scheduling). Forcing single archetype either loses information or creates a dishonest contract. The primary archetype determines the engine contract. Capabilities determine which shared subsystems to instantiate.

TRADEOFF: Slightly more complex manifest. Offset by scaffolding tool automation and clearer product description.

---

**Change 2**

V2 DECISION: `BaseFinding` is a required shared primitive.

V3 DECISION: `BaseFinding` is an optional shared primitive. Products opt into it.

REASON: Runtime Middleware and Gateway products (4 of 20) produce `PolicyDecision` not `BaseFinding`. Generator products produce `Artifact` not `BaseFinding`. Forcing `BaseFinding` on these products creates dead fields and artificial implementation. The primitive is genuinely useful for Analyzer and Optimizer products and remains available.

TRADEOFF: Products choosing `BaseFinding` get shared reporting infrastructure for free. Products not using it must implement their own finding/result types, which is correct given their different domains.

---

**Change 3**

V2 DECISION: `usage_records` and `audit_events` are globally shared without product scoping.

V3 DECISION: Both tables carry a `product_id` foreign key referencing `platform.products`. A `platform.products` registry table is added.

REASON: Without `product_id`, it is impossible to extract usage and audit records for a specific product during acquisition. This violates P20 (data separability is an architectural invariant).

TRADEOFF: Minor schema addition. The `products` table is small and static. Every insert to `usage_records` and `audit_events` requires `product_id`. This is a one-line addition to every insert call and is enforced by the Drizzle schema (non-nullable FK).

---

**Change 4**

V2 DECISION: Specific deployment provider names (Railway, Fly.io, Vercel, Supabase) appear as architectural requirements in the deployment section.

V3 DECISION: The architecture specifies required capabilities (PostgreSQL-compatible host, persistent container worker host, etc.). Provider names appear only as initial operational examples. All provider pricing and free-tier information is marked TIME-SENSITIVE OPERATIONAL ASSUMPTION.

REASON: Provider pricing and free-tier terms change. Building the architecture around Fly.io's current free tier or Railway's trial credits creates a dependency on business decisions made by external companies. The architecture must remain valid if any provider changes its offering.

TRADEOFF: Slightly less concrete initial deployment guide. Mitigated by the initial operational configuration section which names current providers while clearly marking them as non-architectural.

---

**Change 5**

V2 DECISION: 80% domain coverage is a launch gate requirement.

V3 DECISION: 80% domain coverage is a launch gate metric AND signal, combined with mandatory test category requirements. Coverage alone is not sufficient. Test theater is explicitly named as a failure mode to reject at human review.

REASON: AI agents can generate tests that achieve high coverage while testing nothing meaningful. A coverage number without test category verification creates a false confidence gate. The human review must assess test quality, not just coverage percentage.

TRADEOFF: More work for the human reviewer. This is the correct tradeoff — quality assurance cannot be fully automated.

---

**Change 6**

V2 DECISION: The extraction process is described as "automatic" in several places.

V3 DECISION: Explicit distinction between automated extraction (tool produces a verified standalone build) and human acquisition migration (acquirer integrates into their infrastructure). The EXTRACTION-REPORT.md clearly identifies both what was automated and what human work remains.

REASON: Claiming the extraction is "automatic" sets an incorrect expectation for acquirers. The tool automates what can be automated. Human engineering work is always required for provider replacement, infrastructure setup, and integration with the acquirer's systems.

TRADEOFF: More honest documentation. No architectural change required.

---

**Change 7**

V2 DECISION: The `Recommendation` concept was considered both a field in `BaseFinding` and a separate entity.

V3 DECISION: `Recommendation` is an optional shared primitive as a typed object (used by Optimizer as a standalone entity) and also exists as a string field within `BaseFinding` (for Analyzer products). These are distinct uses. Both are documented separately.

REASON: Optimizer products produce recommendations independent of findings (e.g., "add this index" without necessarily flagging a severity issue). Analyzer products embed recommendations in findings. Conflating these produced confusion.

TRADEOFF: Two representations of recommendation. Clarified by archetype contract — Optimizer uses standalone Recommendation type; Analyzer uses BaseFinding.recommendation string field.

---

## 22. Remaining Risks and Required Human Decisions

### 22.1 Risks That Are Accepted (and Why)

| Risk | Acceptance Rationale |
|------|---------------------|
| Next.js App Router is still maturing | The productivity gain is decisive. Pin Next.js version. Upgrade per-product on a schedule. Accept that some patterns may need revision. |
| pg-boss may not scale to high-volume products | pg-boss handles thousands of jobs per hour comfortably. For initial launch traffic, this is not a constraint. BullMQ adapter exists for when it is. |
| Supabase free tier changes | Supabase provides a Postgres connection string. If they change their terms, we change the connection string. Drizzle is the data access layer, not Supabase. |
| 20 products may be too many for one developer | Accepted. The architecture makes each product as easy to build as possible. The developer decides which products to launch vs. shelve vs. sell as code assets. |
| AI agents producing test theater | Mitigated by two-agent review and human review. Not fully eliminable. Requires ongoing discipline. |

### 22.2 Decisions That Remain Human

These decisions cannot be made in an architecture document:

1. **Which product to build first.** The architecture recommends JWT Scanner as the first Analyzer (Day 11). The developer may choose differently based on their domain expertise.

2. **Pricing for each product.** Plan definitions are product-specific. The architecture provides the billing infrastructure. The developer sets prices.

3. **When to launch vs. when to continue iterating.** The launch gate defines the minimum. The developer decides when they are satisfied beyond the minimum.

4. **When to promote a product to a dedicated database.** The architecture defines the promotion path. The developer decides based on traffic, isolation requirements, or acquisition opportunity.

5. **When to introduce Redis/BullMQ.** The architecture defines the trigger criterion (concrete product requirement). The developer identifies that requirement in practice.

6. **Which products to sell vs. continue operating.** Portfolio strategy is a business decision.

7. **Provider selection beyond the initial configuration.** If Clerk raises prices, the developer decides which alternative auth provider to implement. The architecture makes this a 5-step migration.

8. **Visual identity of each product.** Theme tokens define the system. The developer chooses the values.

---

## ARCHITECTURE FREEZE CHECK

**Q: Is the architecture implementable by one solo developer with AI assistance?**

YES. The framework is built on well-understood, well-documented technologies. The scaffolding tool reduces new-product setup to hours. AI task contracts constrain AI agents to bounded, correct work. The developer reviews and makes all architecture decisions. The 14-day plan produces a deployed product.

**Q: Can 20 products coexist without architectural chaos?**

YES. Each product is isolated in its own `apps/[product]/` directory. Package boundaries are machine-enforced. No product depends on another. The monorepo handles 20 apps efficiently via Turborepo's affected-package detection. Adding Product 20 does not affect Products 1–19.

**Q: Can a product be extracted for acquisition?**

YES. Extraction is validated monthly. The extraction tool produces a verified standalone repository. The classification table defines what is copied, what is removed, what is reconfigured. The database separability invariant (P20) ensures all product data is extractable. Human acquisition migration is documented honestly as a separate step.

**Q: Can major vendors be replaced without rewriting domain logic?**

YES. Every vendor is behind a port interface with a conformance test suite. Replacing Clerk: new AuthPort adapter, pass conformance tests, update providers.ts, update middleware.ts. No domain code changes. The database replacement boundary is the connection string. This is documented honestly (PostgreSQL is not a trivially swappable provider — it's the connection string that changes).

**Q: Can products look substantially different?**

YES. The theme token system provides independent control over colors, typography, density, navigation style, component variants, chart styles, spacing, and radius. A security tool product and a database tool product built on this framework can have entirely different visual identities without duplicating UI code.

**Q: Can AI agents work without uncontrolled code expansion?**

YES. Task contracts specify allowed files. Pre-commit hooks enforce them mechanically. ESLint boundary rules catch import violations at commit time. The two-agent review process catches semantic bloat. Human review is the final gate. Architecture drift is detected by the monthly arch-check.

**Q: Is initial infrastructure minimal?**

YES. Initial infrastructure requires: one PostgreSQL instance (Supabase free tier), no Redis, no additional services beyond what Postgres already provides for jobs (pg-boss). Optional: email (Resend), analytics (PostHog), auth (Clerk), billing (Stripe) — all available on free tiers. Worker process runs on any container host.

**Q: Are we avoiding premature scaling?**

YES. No microservices. No Kubernetes. No Redis by default. No queue system beyond what the existing database can provide. No caching infrastructure before it is needed. The architecture adds infrastructure only when a concrete product requirement demonstrates the need.

**Q: Are security and quality enforced?**

YES, with an honest qualification. The framework provides security primitives and documents what must be implemented per product. Security is not inherited automatically. The launch gate requires security E2E tests, manual security review, dependency audit, and authentication/authorization verification. Quality is enforced through mandatory test categories, coverage signals, two-agent review, and human sign-off.

**Q: Are there any unresolved architectural contradictions?**

NO. Job architecture is consistent: pg-boss by default, no Redis, BullMQ as a future adapter. Database architecture is consistent: Application → Drizzle → PostgreSQL, no generic abstraction, connection string as migration boundary. Archetype system is consistent: primary archetype + capabilities, no forced universal interface. Provider abstraction is consistent: ports with conformance tests, adapters with vendor SDKs, providers.ts as the sole wiring point.

---

**MASTER SAAS FRAMEWORK v3.0 — READY FOR IMPLEMENTATION**

*This document is frozen. Implementation begins from this specification. Changes to the architecture during implementation require a documented decision record, not a silent override. The 22 architectural principles are the governing constraints. The 14-day plan is the implementation sequence. The product creation pipeline is the repeatable process.*