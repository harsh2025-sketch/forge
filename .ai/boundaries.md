# Package Import Boundaries

## Enforced by ESLint + TypeScript + arch-check. Violations fail CI.

---

## packages/shared

**Purpose:** Shared kernel utilities — Result type, error base types, pagination.
**Exports:** Result, AppError, PaginationParams
**Allowed to import:**
- Node.js std lib
- External libraries ONLY: zod

**Other packages depend on:** ALL (this is the base)

---

## packages/domain

**Purpose:** Shared domain primitives and archetype engine contracts.
**Exports:** Archetype contracts, primitives (BaseFinding, Metric, Recommendation, Diagnostic, Artifact, etc.)
**Allowed to import:**
- packages/shared
- zod
- Node.js std lib

**FORBIDDEN imports:**
- next, react
- packages/db, packages/auth, packages/billing, etc.
- Any vendor SDK
- Any adapter

**Who depends on this:** apps/*, packages/ui, packages/testing

---

## packages/config

**Purpose:** Configuration types and environment schemas.
**Exports:** ProductManifest, Archetype, Capability, env schemas
**Allowed to import:**
- packages/shared
- zod

**Who depends on this:** All apps/*, tooling

---

## packages/db

**Purpose:** Database utilities, shared platform schema, helpers.
**Exports:** Drizzle client factory, migration runner, schema types, withOrg() scoping helper
**Allowed to import:**
- packages/shared
- drizzle-orm
- postgres.js (connection driver)
- Node.js std lib

**FORBIDDEN imports:**
- packages/domain (no domain logic here)
- Any adapter
- Next.js

**Who depends on this:** All apps/*, packages/[any that query the DB]

---

## packages/ui

**Purpose:** React UI primitives, theme system, structural components.
**Exports:** Button, Input, Card, Dialog, DataTable, StatusBadge, theme utilities
**Allowed to import:**
- react, react-dom
- packages/shared
- tailwindcss
- framer-motion, clsx, etc.

**FORBIDDEN imports:**
- packages/domain (UI must not import business logic)
- packages/db (UI must not query DB directly — use Server Actions)
- packages/[auth, billing, email, etc.] ports
- Any adapter

**Who depends on this:** All apps/*

---

## packages/auth (Port)

**Purpose:** Authentication port interface only.
**Exports:** AuthPort, AuthMiddleware, AuthWebhookHandler, types (AuthUser, AuthOrganization)
**Allowed to import:**
- packages/shared
- zod (for validation types, optional)

**FORBIDDEN imports:**
- packages/adapters/* (no adapter logic)
- Any vendor SDK (Clerk, Auth0, etc.)

**Who depends on this:**
- apps/* (to type-cast to port)
- packages/adapters/clerk (to implement)
- packages/testing (conformance tests)

---

## packages/billing (Port)

**Purpose:** Billing port interface (payment, subscriptions, usage).
**Exports:** BillingPort, BillingWebhookHandler, types (BillingCustomer, BillingSubscription, Plan)
**Allowed to import:**
- packages/shared

**FORBIDDEN imports:**
- packages/adapters/*
- Any vendor SDK

**Who depends on this:**
- apps/* (to type-cast)
- packages/adapters/stripe
- packages/testing

---

## packages/email (Port)

**Purpose:** Email sending port interface.
**Exports:** EmailPort, EmailMessage types
**Allowed to import:**
- packages/shared

**Who depends on this:**
- apps/*
- packages/adapters/resend
- packages/testing

---

## packages/analytics (Port)

**Purpose:** Analytics tracking and feature flag ports.
**Exports:** AnalyticsPort, FeatureFlagPort, types
**Allowed to import:**
- packages/shared

**Who depends on this:**
- apps/*
- packages/adapters/posthog
- packages/testing

---

## packages/storage (Port)

**Purpose:** Object storage port (upload, download, signed URLs).
**Exports:** StoragePort, StorageObject type
**Allowed to import:**
- packages/shared

**Who depends on this:**
- apps/* (if storing artifacts)
- packages/adapters/supabase-storage, packages/adapters/s3
- packages/testing

---

## packages/jobs (Port)

**Purpose:** Background job queue port interface.
**Exports:** JobQueuePort, JobProcessor, Job, JobStatus, JobOptions, JobInfo types
**Allowed to import:**
- packages/shared
- zod (for status validation)

**Who depends on this:**
- apps/* (to use job queue)
- packages/adapters/pg-boss, packages/adapters/bullmq
- packages/testing

---

## packages/ai-provider (Port)

**Purpose:** LLM provider port (completions, structured outputs, embeddings).
**Exports:** AIModelPort, CompletionOptions, CompletionResult types
**Allowed to import:**
- packages/shared
- zod

**Who depends on this:**
- apps/* (if using AI)
- packages/adapters/openai, packages/adapters/anthropic
- packages/testing

---

## packages/reporting (Optional)

**Purpose:** Report generation infrastructure.
**Exports:** ReportTemplate interface, ReportFormat enum, generators (JSON, Markdown, HTML, PDF)
**Allowed to import:**
- packages/shared
- packages/domain

**Who depends on this:**
- apps/* (if capabilities include "reporting")
- packages/testing

---

## packages/testing

**Purpose:** Test infrastructure, conformance suites, factories, mocks.
**Exports:** Port conformance tests, mock adapters, test data factories
**Allowed to import:**
- packages/shared
- packages/[all port packages]
- vitest, @testing-library/react, etc.

**Who depends on this:**
- apps/* (for E2E tests)
- packages/adapters/* (for conformance validation)

---

## packages/adapters/clerk

**Purpose:** Clerk → AuthPort adapter.
**Exports:** clerkAuthAdapter, clerkAuthMiddleware, clerkAuthWebhookHandler
**Allowed to import:**
- packages/auth (port)
- packages/shared
- @clerk/nextjs, @clerk/backend (the vendor SDK)

**FORBIDDEN imports:**
- packages/billing, packages/email, etc. (other ports)
- Any other adapter

**Used by:** apps/*/src/providers.ts ONLY

---

## packages/adapters/stripe

**Purpose:** Stripe → BillingPort adapter.
**Exports:** stripeBillingAdapter, stripeBillingWebhookHandler
**Allowed to import:**
- packages/billing (port)
- packages/shared
- stripe (the vendor SDK)

**Used by:** apps/*/src/providers.ts ONLY

---

## packages/adapters/resend

**Purpose:** Resend → EmailPort adapter.
**Exports:** resendEmailAdapter
**Allowed to import:**
- packages/email (port)
- packages/shared
- resend (vendor SDK)

**Used by:** apps/*/src/providers.ts ONLY

---

## packages/adapters/posthog

**Purpose:** PostHog → AnalyticsPort + FeatureFlagPort adapter.
**Exports:** posthogAnalyticsAdapter, posthogFeatureFlagAdapter
**Allowed to import:**
- packages/analytics (port)
- packages/shared
- posthog (vendor SDK)

**Used by:** apps/*/src/providers.ts ONLY

---

## packages/adapters/pg-boss

**Purpose:** pg-boss → JobQueuePort adapter (DEFAULT).
**Exports:** pgBossJobQueueAdapter
**Allowed to import:**
- packages/jobs (port)
- packages/shared
- pg-boss

**Used by:** apps/*/src/providers.ts ONLY

---

## packages/adapters/supabase-storage

**Purpose:** Supabase Storage → StoragePort adapter (INITIAL).
**Exports:** supabaseStorageAdapter
**Allowed to import:**
- packages/storage (port)
- packages/shared
- @supabase/storage-js

**Used by:** apps/*/src/providers.ts ONLY

---

## apps/[product]/src/domain

**Purpose:** Product-specific domain logic (pure business rules).
**Allowed to import:**
- packages/shared
- packages/domain
- Local types (types.ts, schemas.ts)
- Zod
- Node.js std lib

**FORBIDDEN imports:**
- next, react
- packages/db, packages/auth, packages/billing, etc.
- packages/adapters/* (no adapters in domain)
- Any vendor SDK

---

## apps/[product]/src/features

**Purpose:** Feature modules combining domain, UI, and data access.
**Allowed to import:**
- Local domain
- packages/db
- packages/ui
- packages/[ports] (via providers)
- react, next
- Server Actions

**FORBIDDEN imports:**
- packages/adapters/* (use providers.ts instead)

---

## apps/[product]/src/providers.ts

**Purpose:** SOLE FILE allowed to instantiate and export adapters.
**Allowed to import:**
- ALL adapters: packages/adapters/*
- ALL ports: packages/auth, packages/billing, etc.
- packages/shared

**Everywhere else in the app:** FORBIDDEN from importing adapters.

**Usage:** 
```
export const authPort = clerkAuthAdapter;
export const billingPort = stripeBillingAdapter;
// etc.
```

Then import from providers: `import { authPort } from "@/providers";`

---

## tools/create-product

**Purpose:** Product scaffolding tool (never imported by apps).
**Allowed to import:**
- packages/shared
- packages/config
- packages/domain (for archetype types)

---

## tools/arch-check

**Purpose:** Architecture validation tool (never imported by apps).
**Allowed to import:**
- packages/shared
- packages/config
- TypeScript compiler API
- ESLint

## tools/extract-product

**Purpose:** Import an existing application into the Forge V3 product structure (never imported by apps).
**Allowed to import:**
- packages/shared, packages/config
- tools/create-product (product templates)
- TypeScript compiler API
- Node.js stdlib

## tools/extraction-validate

**Purpose:** Validation gate for generated/extracted products (never imported by apps).
**Allowed to import:**
- packages/shared, packages/config
- tools/architecture-check (delegated architecture enforcement)
- tools/validate-docs (delegated documentation validation)
- tools/extract-product (extraction model and report schema)
- tools/create-product (manifest and template contracts)
- TypeScript compiler API
- Node.js stdlib

---

## Summary of Enforcement

```
Machine-enforced by ESLint (boundaries plugin):
  ✗ domain → infrastructure (db, auth, adapters, etc.)
  ✗ port → adapter
  ✗ any file except providers.ts → adapters/*
  ✗ app → app (cross-product)

Machine-enforced by TypeScript (project references):
  ✗ Circular dependencies
  ✗ Missing exports

Machine-enforced by arch-check tool:
  ✗ Vendor SDK in wrong place
  ✗ Infrastructure in domain
  ✗ Circular imports
  ✗ Unauthorized dependencies
```

All violations block CI/CD merge.
