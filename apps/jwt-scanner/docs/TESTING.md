# JWT Scanner Testing

## Test layers

- Unit tests for domain logic live in `src/domain/__tests__/` and run with Vitest.
  Parser matrices cover valid compact JWTs, segment count, canonical base64url,
  malformed UTF-8/JSON, decoded schema failures, size limits, unusual claims,
  unexpected headers, and duplicate JSON members. Engine matrices cover all four
  frozen categories, temporal boundaries, HMAC key-size boundaries, configured
  algorithm mismatch, combined finding order, limits, summaries, and repeated-run
  determinism. Every timestamp is explicit and all fixtures are in memory.
- Integration tests for Server Actions, API routes, and webhooks live in
  `src/__tests__/integration/` and run against a test database.
- Conformance tests from `packages/testing/conformance` prove that every wired
  adapter satisfies its port contract; adapters are replaceable only when they pass.
- End-to-end tests (Playwright) cover critical user flows in `e2e/flows/` and
  security scenarios in `e2e/security/` once the application layer is implemented.

## Running tests

```bash
pnpm test              # all workspace tests
pnpm --filter jwt-scanner test
```

## Coverage

Domain logic is the quality gate: every branch of the engine is exercised, including
the error branch of each Zod validation. Coverage is a quality signal, not proof
(frozen principle P22); the required scenarios are documented in the product checklist.

## Conformance validation

When a provider is wired, its adapter must pass the conformance suite for its port
before the wiring is accepted. This is the machine-enforced proof that the provider can
be replaced without touching application code.

## Test data

Factories come from `@forge/testing`. Test data never persists in the development or
production database, and tests never send real emails, payments, or analytics events;
provider calls are mocked at the port boundary.

## CI

The repository CI runs `pnpm test` for every package; a failing test blocks merge.
