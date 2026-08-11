# JWT Scanner Operations

## Monitoring

JWT Scanner reports health, error rates, and latency from every deployed
environment. A health check endpoint returns the application status and must be
configured in the container orchestrator and load balancer. Error rates are watched per
route and per provider; provider failures surface through the port boundaries and are
logged with their operation context.

## Logging

Logs are structured and machine-readable. Sensitive data is never logged: passwords,
tokens, API keys, webhook signatures, and full database connection strings are redacted
before anything is written. Correlation identifiers connect a request across the
application, worker, and provider boundaries.

## Scaling

The web process scales horizontally; the worker process scales independently because
the product does not require a worker process. The job queue is PostgreSQL-backed and follows the
frozen default (pg-boss). Scaling the database is a deployment concern; the product's
schema stays product-scoped so the database can be split per product if needed (frozen
principle P8).

## Backups

Database backups follow the product data boundary: every product-scoped record is
restorable independently (frozen principle P20). Backup and restore procedures are
documented in `docs/ACQUISITION.md` and are exercised at least monthly.

## Troubleshooting

Common failure modes:

- Startup failure with a configuration error: a required environment variable is
  missing; see `docs/SETUP.md`.
- `pnpm arch-check` failures: an import crossed a frozen boundary; fix the import, do
  not weaken the rule.
- Provider errors: verify credentials and webhook signatures, then check the provider
  status page; the port boundary isolates the provider from the rest of the product.

## Incident response

Every incident is documented with timeline, impact, and remediation. Post-incident
changes follow the normal CI gates (`pnpm test`, `pnpm arch-check`,
`pnpm validate-docs`).
