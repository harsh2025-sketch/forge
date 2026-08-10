# Forge Product Pre-Launch Checklist

## Architecture Validation

- [ ] Product declares primary archetype in `product.manifest.ts`
- [ ] `src/domain/engine.ts` implements archetype contract (Analyzer, Optimizer, Generator, Transformer, Middleware, or Gateway)
- [ ] Domain code imports ONLY: Zod, @forge/shared, @forge/domain, local types, Node.js std lib
- [ ] Domain code has ZERO imports: next, react, @forge/db, @forge/auth, vendor SDKs, adapters
- [ ] `src/providers.ts` is the only file importing `packages/adapters/*`
- [ ] No cross-product imports (`apps/[product-A]` → `apps/[product-B]`)
- [ ] Database schema scoped to product's named schema

## Infrastructure & Ports

- [ ] Product manifest declares required ports (auth, billing, email, etc.)
- [ ] Product manifest declares optional capabilities (reporting, scheduling, remediation, ai-assisted, etc.)
- [ ] All port usage goes through `providers.ts` (e.g., `import { authPort } from "@/providers"`)
- [ ] No direct vendor SDK imports in product code
- [ ] Adapter implementations pass conformance tests

## Database & Migrations

- [ ] `src/db/schema.ts` defines product-specific Drizzle schema
- [ ] All tenant-scoped tables carry `organization_id` column
- [ ] All queries use `withOrg()` helper for tenant isolation
- [ ] `src/db/migrations/` contains all product migrations
- [ ] Migration files follow naming convention: `YYYYMMDD_HHmmss_description.sql`
- [ ] `docker-compose.yml` runs migrations on startup
- [ ] `pnpm db:migrate` completes without errors

## Testing

### Unit Tests (Domain)

- [ ] `src/domain/__tests__/` has unit tests for `engine.ts`
- [ ] All domain functions have test coverage
- [ ] Tests verify `Result` handling (ok branch and error branch)
- [ ] No mock infrastructure in domain tests (pure function tests)

### Integration Tests

- [ ] Critical user flows tested with Playwright
- [ ] Authentication flow tested (login, logout, org access)
- [ ] Authorization tested (user cannot access other orgs)
- [ ] At least 3 E2E flows in `e2e/flows/`

### Conformance Tests

- [ ] All port adapters pass conformance suites from `packages/testing/conformance/`
- [ ] Conformance test output included in CI

### Code Coverage

- [ ] Minimum coverage for domain logic achieved (specify target)
- [ ] Critical paths have E2E tests

## Documentation (11 Required Files)

- [ ] `docs/ARCHITECTURE.md` — Domain contracts, archetype implementation details
- [ ] `docs/SETUP.md` — Local development setup (docker-compose up, env vars)
- [ ] `docs/DEPLOYMENT.md` — Deployment to Vercel, Docker, other hosts
- [ ] `docs/DATABASE.md` — Schema documentation, tenant scoping, extraction strategy
- [ ] `docs/PROVIDERS.md` — Port implementation details, provider switching instructions
- [ ] `docs/API.md` — API routes (if any), Server Action contracts, webhook endpoints
- [ ] `docs/TESTING.md` — Test running instructions, coverage targets, conformance validation
- [ ] `docs/SECURITY.md` — Auth flow, IDOR prevention, CSRF protection, data isolation
- [ ] `docs/OPERATIONS.md` — Monitoring, logging, scaling, troubleshooting
- [ ] `docs/ACQUISITION.md` — Extraction steps, standalone deployment, data export

All docs must be >100 words and substantive (not stubs).

## Features & Server Actions

- [ ] All Server Actions follow pattern from `.ai/patterns/server-action.md`
- [ ] Server Actions validate input with Zod schemas
- [ ] Server Actions authorize with ports (authPort, etc.)
- [ ] Server Actions return `Result<T, E>` type (never throw)
- [ ] Server Actions use `revalidatePath()` or `revalidateTag()` for ISR
- [ ] `@/domain` imports only happen in Server Actions or middleware, never in components

## UI & Styling

- [ ] All components use `packages/ui` primitives
- [ ] Design tokens defined in `src/theme/tokens.ts`
- [ ] CSS custom properties applied in `src/theme/globals.css`
- [ ] Tailwind config references design tokens
- [ ] Responsive design validated on mobile (375px) and desktop (1920px)
- [ ] Dark mode supported (if required by product)

## Background Jobs (if applicable)

- [ ] Product declares `requiresWorker: true` in manifest
- [ ] `src/worker/index.ts` registers all job processors
- [ ] `Dockerfile.worker` builds worker process separately
- [ ] Job processors use `packages/jobs` port (JobQueuePort)
- [ ] Job processors handle progress updates via callback
- [ ] Job processors are idempotent (safe to retry)
- [ ] `docker-compose.yml` includes worker service

## Reporting (if applicable)

- [ ] Product declares `capabilities: ["reporting"]` in manifest
- [ ] Product can generate reports in at least JSON + one other format (Markdown or HTML)
- [ ] Report contains product-specific data (findings, metrics, recommendations)
- [ ] Report generation is tested in E2E tests

## Scheduling (if applicable)

- [ ] Product declares `capabilities: ["scheduling"]` in manifest
- [ ] Scheduled jobs are registered with pg-boss (or job queue port)
- [ ] UI shows next scheduled run and last run results
- [ ] Admin can manually trigger scheduled job on-demand

## AI-Assisted (if applicable)

- [ ] Product declares `requiresAIProvider: true` in manifest
- [ ] Product declares `capabilities: ["ai-assisted"]` in manifest
- [ ] AIModelPort is used (never direct LLM SDK imports)
- [ ] Prompts are tested for quality and consistency
- [ ] Structured outputs use Zod for validation

## Docker & Deployment

- [ ] `Dockerfile` builds successfully: `docker build -t product:latest .`
- [ ] `Dockerfile.worker` builds (if worker needed): `docker build -f Dockerfile.worker -t product-worker:latest .`
- [ ] `docker-compose.yml` includes all services (web, worker, postgres, etc.)
- [ ] `docker compose up` starts full stack locally without manual setup
- [ ] `docker-compose.yml` respects environment variables for secrets
- [ ] `.dockerignore` excludes unnecessary files
- [ ] Web and worker containers use non-root user
- [ ] Health check configured in docker-compose
- [ ] Graceful shutdown on SIGTERM

## Environment & Configuration

- [ ] `.env.example` documents all required environment variables
- [ ] Env schema in `packages/config` validates startup
- [ ] Missing required env vars cause app to fail fast with clear error
- [ ] Secrets are NOT committed to git
- [ ] `.env*` files are in `.gitignore`
- [ ] Public env vars prefixed with `NEXT_PUBLIC_`

## Analytics & Monitoring (if applicable)

- [ ] Product uses AnalyticsPort (never direct PostHog imports)
- [ ] Critical user actions tracked (sign up, create resource, run analysis)
- [ ] Dashboard shows basic metrics (daily active users, feature usage)
- [ ] Error rates and slow queries logged
- [ ] Health check endpoint available (`/api/health`)

## Acquisition Readiness (Critical)

- [ ] `pnpm extract-product [product-name]` produces standalone repo
- [ ] Extracted repo has independent `package.json`, migrations, docker-compose.yml
- [ ] Extracted repo `docker compose up` works without parent monorepo
- [ ] All product data is extractable without schema redesign
- [ ] Extracted database can be restored: `psql < schema_dump.sql`

## CI/CD & Quality Gates

- [ ] `pnpm lint` passes (ESLint + boundaries check)
- [ ] `pnpm typecheck` passes (TypeScript strict mode)
- [ ] `pnpm test` passes (unit + integration tests)
- [ ] `pnpm arch-check` passes (architecture validation)
- [ ] Coverage report generated and committed
- [ ] No console warnings or errors in CI output
- [ ] All docs present and validated
- [ ] Extraction validation runs successfully

## Security Checklist

- [ ] IDOR prevention: user cannot access other orgs' resources
- [ ] CSRF protection: state-changing actions use CSRF tokens
- [ ] SQL injection prevention: all Drizzle queries typed
- [ ] XSS prevention: React auto-escapes, no `dangerouslySetInnerHTML`
- [ ] Authentication required: all protected routes have auth checks
- [ ] Rate limiting: endpoints that create resources or send emails rate-limited
- [ ] Logging: sensitive data (passwords, tokens) never logged
- [ ] Data persistence: no test data in production

## Performance Checklist

- [ ] Lighthouse score ≥75 on all pages (Performance, Accessibility, Best Practices)
- [ ] Time to Interactive <3s on mobile (Slow 4G)
- [ ] Web Vitals targets met: LCP <2.5s, FID <100ms, CLS <0.1
- [ ] Database queries use indexes appropriately
- [ ] No N+1 queries in critical paths
- [ ] Images optimized (WebP, lazy-loaded where appropriate)
- [ ] Bundle size <100KB (JS) after compression

## Product-Specific Checklist

(Add custom items specific to this product)

- [ ] Item 1
- [ ] Item 2
- [ ] Item 3

## Sign-Off

- **Developer:** ________________  **Date:** __________
- **Architect Review:** ________________  **Date:** __________
- **Product Manager:** ________________  **Date:** __________

**Launch approved:** [ ] Yes  [ ] No

**Blocking issues:** (list any)

---

**Note:** This checklist must be 100% complete before deployment to production. CI/CD gates enforce many of these automatically.
