# JWT Scanner Security

## Security model

JWT Scanner follows the frozen Forge security model: security is implemented, not
inherited (frozen principle P18). The framework provides primitives; the product
implements the controls. The model has three layers: authentication establishes the
caller, authorization checks every data access, and the application never trusts
client-supplied input.

## Authentication

Authentication goes through the auth port (`authPort` from `src/providers.ts`).
Routes and Server Actions require an authenticated principal before they run;
unauthenticated requests are rejected by middleware. Credentials and session material
are handled exclusively by the auth adapter; product code never reads or stores
passwords or session secrets.

## Authorization

Authorization is enforced per request, not per page. Every query of tenant-scoped data
uses `withOrg()` from `@forge/db` so that a user can never read or mutate another
organization's records (IDOR prevention). Server Actions re-check authorization after
validating input; authorization is never inferred from the URL.

## Threat mitigations

- CSRF: state-changing actions require CSRF protection; webhooks verify provider
  signatures before processing payloads.
- SQL injection: all queries are typed Drizzle queries; raw SQL appears only in
  reviewed migrations.
- XSS: React output is escaped; `dangerouslySetInnerHTML` is not used.
- Secrets: real credentials never appear in code, logs, or committed files; only
  `.env.example` documents variable names.
- Rate limiting: endpoints that create resources or send email are rate limited.

## Reporting

Security incidents and suspected vulnerabilities are reported through the product's
operations channels documented in `docs/OPERATIONS.md`. Dependencies are audited in
CI.
