# JWT Scanner Deployment

## Deployment targets

JWT Scanner is a self-contained application that can be deployed to any Node.js
runtime: a container platform, a VM, or a serverless Node host. No cloud provider is
mandatory (frozen principle P16). The deployment is defined by the product's
`package.json` scripts and its `Dockerfile` and `docker-compose.yml` (added in
Task 014).

## Docker

The product ships a `Dockerfile` for the web process and a `docker-compose.yml`
(starting PostgreSQL 16 plus the web process in deterministic test mode). Because
`requiresWorker` is `false` in `product.manifest.ts`, there is no worker process
and no `Dockerfile.worker`. The container runs as the non-root `node` user,
respects environment variables for secrets, exposes the health check endpoint
(`GET /api/health`), and shuts down gracefully on SIGTERM.

```bash
# From the repository root:
docker compose -f apps/jwt-scanner/docker-compose.yml up --build
curl http://localhost:3000/api/health
```

## Environment

Every environment needs a complete set of validated environment variables (see
`docs/SETUP.md`). Configuration is read through `@forge/config`; startup fails fast
when a required variable is missing. Secrets are never baked into images; they are
injected at runtime by the deployment platform.

## Release process

1. Run the full quality gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
   `pnpm arch-check`, `pnpm validate-docs`.
2. Build the application (`pnpm build`).
3. Publish the container image with an immutable tag.
4. Deploy, then verify the health endpoint and the documented smoke checks.

## Rollback

Keep the previous image tag available. Rollback is a redeploy of the previous tag plus
any required database migration reversal; migrations must be backward compatible so the
previous application version can run while data converges.

## Monitoring

Every deployment must report health, error rates, and latency to the operations
tooling described in `docs/OPERATIONS.md`.
