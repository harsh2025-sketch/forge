# JWT Scanner Security

## Security model

JWT Scanner follows the frozen Forge security model: security is implemented, not
inherited (frozen principle P18). The framework provides primitives; the product
implements the controls. The model has three layers: authentication establishes the
caller, authorization checks every data access, and the application never trusts
client-supplied input.

## Authentication

Authentication goes through the auth port (`authPort` from `src/providers.ts`),
implemented by the Clerk adapter (`@forge/adapter-clerk`). Routes and Server
Actions require an authenticated principal before they run; the dashboard
layout redirects unauthenticated requests to the landing page with an
`auth=required` hint, and every server action and route handler re-checks
authentication per request. Session material is handled exclusively by the
auth adapter (the request-bound session resolver verifies the Clerk session
token); product code never reads or stores passwords or session secrets.
`AUTH_MODE=test` substitutes a deterministic in-memory AuthPort for local and
E2E runs — never in live deployments.

## Authorization

Authorization is enforced per request, not per page. Every query of tenant-scoped data
uses `withOrg()` from `@forge/db` so that a user can never read or mutate another
organization's records (IDOR prevention). Server Actions re-check authorization after
validating input; authorization is never inferred from the URL.

## JWT analysis boundary

The domain parser accepts at most 64 KiB and requires exactly three compact JWT
segments. Header and payload are decoded as canonical, unpadded base64url,
rejected if they are not valid UTF-8 JSON, and validated with the product Zod
schemas. An empty signature segment is accepted for the `alg=none` static check;
the evidence records whether a signature segment was present. Duplicate JSON
members follow deterministic ECMAScript parsing semantics, where the last member
is retained.

Analysis is deliberately non-executing and non-cryptographic. It never follows
`jku`, `x5u`, or other URLs, resolves keys, reads credentials, verifies or mutates
a token, tests a secret, or claims that exploitation succeeded. A weak-HMAC
finding requires explicit caller-supplied key-size metadata and states that no
secret was recovered. Algorithm confusion is an observed mismatch against an
explicit caller-supplied allow-list. Expiration is evaluated only against the
required caller-supplied NumericDate, never the host clock.

## Data handling

The scanned token itself is never persisted (V3 §11.3): findings store only
decoded header/payload material (`sanitizeStoredEvidence` in
`src/features/scans/persistence.ts`), and the report export derives all output
from persisted results. The report and finding views show decoded evidence,
never the raw token. Billing state is a neutral projection
(`platform.subscriptions`); provider identifiers are stored only as opaque
external ids.

## Threat mitigations

- CSRF: state-changing actions are Next.js server actions (same-origin
  enforced); webhooks verify provider signatures before processing payloads.
- SQL injection: all queries are typed Drizzle queries; raw SQL appears only in
  reviewed migrations.
- XSS: React output is escaped; `dangerouslySetInnerHTML` is not used.
- Secrets: real credentials never appear in code, logs, or committed files; only
  `.env.example` documents variable names.
- Tenant isolation (IDOR): every read and write of tenant-scoped data is
  scoped by `withOrg()`, and service-layer tests assert cross-organization
  access is denied.
- Rate limiting: endpoints that create resources are rate limited.

## Reporting

Security incidents and suspected vulnerabilities are reported through the product's
operations channels documented in `docs/OPERATIONS.md`. Dependencies are audited in
CI.
