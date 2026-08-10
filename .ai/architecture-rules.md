# Forge Architecture Rules — FROZEN (V3)

## Enforcement Status

**IMMUTABLE** — These rules are machine-enforced by ESLint, TypeScript project references, and the `arch-check` tool. Violations fail CI/CD.

---

## 22 Frozen Architectural Principles

**P1 — Modular monolith per product**
Each product is a self-contained Next.js application. No shared runtime between products. No microservices.

**P2 — Turborepo + pnpm workspaces**
One repository. Internal packages via `workspace:*`. No private package registry.

**P3 — Machine-enforced package boundaries**
Import rules enforced by ESLint, TypeScript project references, and `arch-check`. Violations fail CI.

**P4 — Domain logic has zero infrastructure imports**
Product domain code imports only: Zod, shared domain primitives, its own types. No Next.js, Drizzle, vendor SDK, or adapter.

**P5 — Vendor code lives in exactly one adapter package**
A vendor SDK (e.g., `@clerk/nextjs`) appears in one place. Any other occurrence fails CI.

**P6 — No speculative abstraction**
A shared abstraction requires two concrete consumers. The first product implements directly; the second motivates extraction.

**P7 — PostgreSQL is not a swappable provider**
Application → Drizzle → PostgreSQL. The connection string is the infrastructure boundary. No generic `IDatabaseAdapter`.

**P8 — Logical data ownership is product-scoped, physical deployment is flexible**
Each product owns its schema, migrations, jobs. Products can share a Postgres instance initially and be promoted to dedicated instances.

**P9 — Product archetypes, not a universal engine interface**
Products implement the archetype contract appropriate to their primary type. Optional capabilities are composed.

**P10 — pg-boss as the default job system**
No Redis by default. BullMQ is available as a future adapter when concrete requirements justify it.

**P11 — AI agents operate under explicit, enforced file manifests**
Task contracts specify allowed files. Pre-commit hooks enforce manifests. AI is never final authority on architecture.

**P12 — Conformance tests prove adapter replaceability**
Every port has a conformance test suite. Every adapter must pass it.

**P13 — Theme tokens, not visual templates**
Products define visual identity via design tokens. UI package provides structural primitives.

**P14 — Documentation is a CI gate**
Missing or stub documentation blocks deployment.

**P15 — Every product must survive extraction at any time**
Monthly extraction validation in CI. Products that cannot be extracted cannot be acquired.

**P16 — Docker portability is mandatory**
`docker compose up` works for every product. No cloud provider is mandatory.

**P17 — Reporting is archetype-dependent and optional**
Runtime Middleware and Gateway products do not require document-style reports.

**P18 — Security is implemented, not inherited**
The framework provides primitives. Developers implement security per product.

**P19 — Capability composition, not interface multiplication**
Products select a primary archetype and compose optional capabilities via manifest.

**P20 — Data separability is an architectural invariant**
Every persistent record belonging to a product must be identifiable and extractable without redesign.

**P21 — Provider capabilities, not provider names, are the requirement**
Architecture specifies what a deployment slot must be capable of. Specific providers are operational choices, not requirements.

**P22 — Code coverage is a quality signal, not proof**
Launch gate requires appropriate test cases across categories, not a coverage number.

---

## Dependency Graph (Machine-Enforced)

```
apps/* → packages/[ui, domain, auth, billing, email, analytics, jobs, storage, db, shared, config]
         ONLY apps/*/src/providers.ts → packages/adapters/*

packages/adapters/* → their port package + packages/shared + vendor SDK
packages/domain → packages/shared, Zod ONLY
packages/db → packages/shared, drizzle-orm, postgres.js
packages/[port] → packages/shared only

FORBIDDEN:
  ✕ Cross-product imports
  ✕ Port importing adapter
  ✕ Domain importing infrastructure
  ✕ Adapter importing adapter
  ✕ packages/* importing apps/*
```

---

## Conformance Checks

- `pnpm lint` — ESLint boundaries enforcement
- `pnpm arch-check` — Vendor leakage, domain purity, circular deps
- `pnpm test` — Unit + conformance tests (ports)
- `pnpm build` — TypeScript strict mode
- CI blocks merge if any check fails
