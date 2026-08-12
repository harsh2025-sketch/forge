# Getting started — create Product #3

This walkthrough shows how Forge is used as a factory, not how to finish JWT
Scanner. The goal is a new product that reuses framework infrastructure and
owns its own domain, screens, and visual identity.

## Prerequisites

- Node.js 22+
- pnpm 11.21.0 (pinned via `packageManager`)
- A checkout of this repository

```bash
pnpm install
pnpm build
```

## 1. Scaffold the product

```bash
pnpm create-product license-scanner --archetype analyzer --capabilities reporting --display-name "License Scanner"
```

This writes `apps/license-scanner/` only. JWT Scanner is not modified.

The scaffold includes:

- a Next.js app with a product-owned landing page and workspace
- `src/domain/engine.ts` implementing the analyzer contract
- test-mode `AuthPort` and `BillingPort` in `src/providers.ts`
- theme tokens starting from the framework baseline (light, not JWT navy)
- a product-scoped Drizzle schema
- Docker files and a Playwright smoke test
- the ten required product documents

## 2. Run it without credentials

```bash
cd apps/license-scanner
AUTH_MODE=test BILLING_MODE=test DATA_MODE=memory pnpm dev
```

Open the preview URL. The heading is "License Scanner", not JWT Scanner.

## 3. Add product-specific work

Keep framework files; change product files:

| Keep | Customize |
| --- | --- |
| `src/providers.ts` port wiring | `src/domain/` algorithms |
| `@forge/ui` primitives | `src/theme/tokens.ts` colors and density |
| `@forge/db` + `withOrg()` | `src/db/schema.ts` tables |
| Auth/Billing ports | `src/app/` landing, dashboard, workflows |
| `pnpm validate` | product tests and Playwright flows |

Do not import `apps/jwt-scanner`. Do not copy its landing page.

## 4. Validate

From the repository root:

```bash
pnpm validate
pnpm extraction-validate license-scanner
```

`pnpm validate` is the single quality gate: architecture, docs, lint,
typecheck, and tests.

## 5. Export when the product must stand alone

```bash
pnpm extract-product --export license-scanner ./license-scanner-standalone
cd license-scanner-standalone
pnpm install
pnpm validate
```

The destination contains this product and the Forge packages it uses. Other
products and factory tooling are not copied.

## 6. Configure live providers later

Live Clerk/Stripe/Resend adapters are added in `src/providers.ts` only.
Domain code, theme tokens, and screens do not mention vendor SDKs.
See `docs/ARCHETYPES.md` and the product's `docs/PROVIDERS.md`.
