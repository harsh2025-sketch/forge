# Forge AI Governance Rules

## Authority

These rules are derived from the Forge Master Architecture V3 (FROZEN). Implementation agents must follow them precisely. No agent redesign of the architecture is permitted.

---

## Rule Set 1: Architecture Immutability

1.1 — The 22 architectural principles in `.ai/architecture-rules.md` are frozen.
1.2 — No architectural changes without formal documented decision.
1.3 — All changes must map to a numbered principle and explicitly state which principle governs the decision.

---

## Rule Set 2: Package Boundaries (Machine-Enforced)

2.1 — `packages/domain` contains only: Zod, shared primitives, archetype contracts. NO infrastructure imports.
2.2 — `packages/[port]` contains ONLY the port interface. NO adapter imports.
2.3 — `packages/adapters/*` contains ONLY adapter implementations of a single port.
2.4 — `apps/*/src/providers.ts` is the ONLY file allowed to import `packages/adapters/*`.
2.5 — Any other file importing an adapter causes CI failure.

---

## Rule Set 3: Vendor SDK Placement (P5 — Machine-Enforced)

3.1 — A vendor SDK (e.g., `@clerk/nextjs`, `stripe`) appears in exactly one adapter package.
3.2 — No product code imports vendor SDKs directly (only via adapters).
3.3 — No port interface imports vendor SDKs (only adapters do).

---

## Rule Set 4: Domain Purity (P4)

4.1 — Product domain code (`src/domain/*.ts`) imports ONLY:
  - Zod
  - `@forge/shared`
  - `@forge/domain`
  - Local types within the product
  - Standard Node.js libraries
4.2 — Product domain code NEVER imports:
  - `next`
  - `react`
  - `@forge/db`
  - `drizzle-orm`
  - Any adapter package
  - Any vendor SDK

---

## Rule Set 5: Product Isolation (P1)

5.1 — `apps/[product-A]` NEVER imports from `apps/[product-B]`.
5.2 — Products communicate only via shared framework types, not shared implementation.
5.3 — Products may share infrastructure (Postgres schema) but NEVER code.

---

## Rule Set 6: Data Ownership (P8, P20)

6.1 — Each product owns its named schema in PostgreSQL.
6.2 — Cross-product queries are forbidden. Use `withOrg()` scoping for shared data.
6.3 — Product extraction must be complete: every persistent record identifiable by product.
6.4 — Shared `platform.*` tables carry `product_id` in audit and usage records.

---

## Rule Set 7: Provider Replacement (P12)

7.1 — Every port has a conformance test suite.
7.2 — Any adapter passing the conformance suite is a valid replacement.
7.3 — Changing providers requires:
  - New adapter implementation
  - Passing conformance tests
  - Update `apps/[product]/src/providers.ts`
  - Zero domain or application code changes

---

## Rule Set 8: No Infrastructure in Domain (P4)

8.1 — `domain/engine.ts` implements the archetype contract only.
8.2 — Engine takes validated input, returns Result.
8.3 — Engine never instantiates database, jobs, providers, or services.
8.4 — Infrastructure (Drizzle queries, job enqueuing, auth checks) lives in `features/` or middleware.

---

## Rule Set 9: Archetype Selection (P9, P19)

9.1 — Every product declares a primary archetype in `product.manifest.ts`.
9.2 — Archetype determines which engine contract `domain/engine.ts` implements.
9.3 — Optional capabilities are listed in the manifest.
9.4 — Capabilities determine which shared subsystems are scaffolded (reporting, jobs, AI provider).

---

## Rule Set 10: Job Queue Architecture (P10)

10.1 — Default job queue is pg-boss (PostgreSQL-backed).
10.2 — No Redis in initial infrastructure.
10.3 — BullMQ adapter is available for future concrete product requirements.
10.4 — Changing job queues requires new adapter + `providers.ts` update.
10.5 — Products that don't need background jobs don't import `@forge/jobs`.

---

## Rule Set 11: Documentation Requirements (P14)

11.1 — Every product must include `/docs/` with all 11 required documents.
11.2 — Missing or stub documentation blocks deployment.
11.3 — Required docs: ARCHITECTURE, SETUP, DEPLOYMENT, DATABASE, PROVIDERS, API, TESTING, SECURITY, OPERATIONS, ACQUISITION.
11.4 — Framework-level documentation lives in `/docs/` root.

---

## Rule Set 12: Extraction Validation (P15)

12.1 — Every product must survive extraction at any time.
12.2 — Monthly extraction validation runs in CI.
12.3 — Extraction tool (`extract-product`) must produce a standalone repository.
12.4 — Extracted product must be deployable without the monorepo.

---

## Rule Set 13: Conformance Tests (P12)

13.1 — Every port has a conformance test suite in `packages/testing/conformance/`.
13.2 — Every adapter must pass the test suite for its port.
13.3 — Conformance suite specifies the exact contract an adapter must satisfy.

---

## Rule Set 14: No Speculative Abstraction (P6)

14.1 — Shared abstractions require two concrete consumers.
14.2 — First product implements the feature directly.
14.3 — Second product justifies extraction into `packages/`.
14.4 — No three-tier abstractions before concrete need is proven.

---

## Rule Set 15: Docker and Portability (P16)

15.1 — Every product includes `Dockerfile`, `Dockerfile.worker`, `docker-compose.yml`.
15.2 — `docker compose up` must work end-to-end locally.
15.3 — No cloud provider is mandatory.
15.4 — Docker images are the primary artifact for distribution and deployment.
