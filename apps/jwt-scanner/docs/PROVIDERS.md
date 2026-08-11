# JWT Scanner Providers

## Ports and adapters

JWT Scanner consumes external capabilities exclusively through Forge port
packages (`@forge/auth`, `@forge/billing`, `@forge/email`, `@forge/analytics`,
`@forge/jobs`, `@forge/storage`, `@forge/ai-provider`). Ports are
provider-neutral interfaces; adapters in `packages/adapters/*` implement them
for a concrete vendor.

The product declares the capabilities it needs in `product.manifest.ts`:
`reporting`.

## Composition root

`src/providers.ts` is the only file in the application allowed to import
adapter packages. Every other module imports the wired ports from it, for
example:

```ts
import { authPort } from "@/providers";
```

### Provider plan (Day-11 milestone)

The initial synchronous milestone wires no adapters, by design:

- **Scanning** is pure domain logic (`src/domain/`) — no provider involved.
- **Reporting** is provided by the `@forge/reporting` package, a shared Forge
  package (not a provider adapter). The report template implementation is
  product-owned and arrives with the report-export feature.
- **Persistence** is PostgreSQL via `@forge/db` (frozen principle P7 — the
  connection string is the replacement boundary; there is no database
  adapter).

Wiring a provider is a three step change:

1. Add the adapter package to this product's dependencies (for example
   `@forge/adapter-clerk`).
2. Import the adapter and export it as its port type in `src/providers.ts`.
3. Document the provider choice and its environment variables in this document
   and in `docs/SETUP.md`.

Authentication (Clerk) and billing (Stripe) are activated with the feature
milestone (V3 §20.2 Day 13); email, analytics, storage, jobs, and AI adapters
are added only when a concrete product requirement justifies them.

## Provider replacement

Replacing a provider must not change application or domain code:

1. Implement or select a new adapter that satisfies the port's conformance suite.
2. Verify the adapter passes the `packages/testing/conformance` tests.
3. Switch the wiring in `src/providers.ts`.
4. Update environment variables and this document.

If `pnpm arch-check` reports vendor leakage or adapter bypass, the wiring is
wrong; vendor SDKs may appear only inside adapter packages.

## Migration from a legacy application

Products imported with `pnpm extract-product` arrive with an
`extraction-report.json` that lists every provider integration found in the
source, classified REVIEW or MANUAL. Each integration must be migrated behind
its port before the product is compliant; the report's remediation notes
describe the required work.
