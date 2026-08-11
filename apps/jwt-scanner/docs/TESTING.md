# JWT Scanner Testing

## Test layers

- **Domain unit tests** (`src/domain/__tests__/`) run with Vitest. Parser
  matrices cover valid compact JWTs, segment count, canonical base64url,
  malformed UTF-8/JSON, decoded schema failures, size limits, unusual claims,
  unexpected headers, and duplicate JSON members. Engine matrices cover all
  four frozen categories, temporal boundaries, HMAC key-size boundaries,
  configured algorithm mismatch, combined finding order, limits, summaries,
  and repeated-run determinism. Every timestamp is explicit and all fixtures
  are in memory.
- **Feature unit tests** (`src/features/*/__tests__/`) cover the Task-013
  feature layer: scan submission (valid/malformed/oversized JWTs, invalid
  schema, persistence, organization scoping), results rendering and severity
  display, finding detail (data, evidence, recommendation, missing findings),
  report export (content, determinism, @forge/reporting usage, format
  validation), authentication (denied/authenticated/org context) and billing
  (plan configuration, BillingPort seam usage, subscription persistence).
  Component tests render with `react-dom/server` (no jsdom required), the same
  technique `@forge/ui` uses.
- **Integration test** (`src/__tests__/integration/scan-flow.test.ts`) runs
  the actual product flow with injected ports: authenticated state → submit
  JWT → engine analysis → persist → load results → open finding → export
  report, plus a tenant-isolation (IDOR-style) check. It exercises the real
  feature wiring (service → port → engine → persistence → reporting), not
  isolated components.
- **Conformance tests** from `packages/testing/conformance` prove that every
  wired adapter satisfies its port contract; adapters are replaceable only
  when they pass.
- **End-to-end tests** (Playwright) live in `e2e/flows/` and run the Next.js
  application in deterministic test mode (`AUTH_MODE=test BILLING_MODE=test
  DATA_MODE=memory`): signup (auth seam) → scan JWT → view findings → export
  report.

## Running tests

```bash
pnpm test                          # all workspace tests
pnpm --filter jwt-scanner test     # product tests
pnpm --filter jwt-scanner e2e      # Playwright critical path
```

## Live vs mocked verification

- The product test suite uses `@forge/testing` mock adapters and the product's
  deterministic in-memory persistence seams — no live Clerk/Stripe credentials
  and no database are required.
- The Playwright E2E runs the real application (Next.js server + server
  actions + routing) with the port seams activated via environment variables.
  This verifies the actual wiring deterministically.
- Fully live verification (real Clerk signup, real Stripe checkout/webhooks,
  PostgreSQL persistence) requires external credentials and infrastructure and
  is an operational step, not part of the automated suite.

## Coverage

Domain logic is the quality gate: every branch of the engine is exercised,
including the error branch of each Zod validation. Coverage is a quality
signal, not proof (frozen principle P22); the required scenarios are
documented in the product checklist.

## Test data

Factories come from `@forge/testing` and the product's own
`src/__tests__/test-utils.ts`. Test data never persists in the development or
production database, and tests never send real emails, payments, or analytics
events; provider calls are mocked at the port boundary.

## CI

The repository CI runs `pnpm test` for every package; a failing test blocks
merge.
