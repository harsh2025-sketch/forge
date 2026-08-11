# Forge Manual Testing Guide — Windows + VS Code

This guide walks a developer through setting up and manually testing the Forge
framework and its first product, **JWT Scanner** (analyzer archetype), on a
Windows PC with Visual Studio Code. Every command is copied from the actual
repository (`package.json` scripts, `apps/jwt-scanner/`), so no command is
invented here.

> **Purpose:** This is Task 015 — manual verification of the framework built in
> Tasks 001–014. Automated checks (build, arch-check, lint, typecheck, unit +
> conformance + integration tests) run in CI and locally; this guide covers what
> only a human on a real machine can verify: the live UI, real browsers, a real
> PostgreSQL database, and optional live providers.

---

## 1. Prerequisites

| Tool | Minimum | Why |
|---|---|---|
| Windows 10/11 | — | any recent version |
| PowerShell | 5.1+ (PowerShell 7+ recommended) | the commands below are PowerShell syntax |
| Git | 2.40+ | clone the repository |
| Node.js | **22.x** (LTS) | pinned by `engines` in `package.json` (`>=22.0.0`) |
| pnpm | **11.21.0** (exact) | pinned by `packageManager` in `package.json` |
| VS Code | latest | recommended editor (this guide) |
| PostgreSQL | 16+ (optional) | needed only for `DATA_MODE=postgres` / `db:migrate`; not needed for test mode |
| Docker Desktop | latest (optional) | needed only for the Docker/compose workflow |
| Browser | Chrome or Edge | for manual UI testing |

You do **not** need any provider account (Clerk, Stripe) for the deterministic
test-mode workflow. Live-mode testing is optional (Section 17).

---

## 2. Windows setup

Run everything from **PowerShell**. If you have never enabled scripts:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Install Node.js 22 from <https://nodejs.org> (LTS installer) or via winget:

```powershell
winget install OpenJS.NodeJS.LTS
```

Install Git from <https://git-scm.com> or:

```powershell
winget install Git.Git
```

Install Docker Desktop (optional, for the compose workflow):

```powershell
winget install Docker.DockerDesktop
```

---

## 3. Node / pnpm / Git verification

Open a **new** PowerShell window (so `PATH` changes take effect) and verify:

```powershell
node --version      # expect v22.x.x
git --version       # expect git version 2.4x.x
corepack --version  # expect a corepack version (ships with Node)
```

Install the exact pnpm version pinned by the repository. **Do not use a
different pnpm version** — the repository declares `"packageManager":
"pnpm@11.21.0"` and CI installs that exact version. Locally, use corepack:

```powershell
corepack enable
corepack prepare pnpm@11.21.0 --activate
pnpm --version      # expect 11.21.0
```

> Alternative: `npm install -g pnpm@11.21.0` works too. The point is the
> **exact** version 11.21.0, matching the repository and CI.

---

## 4. VS Code setup

Open the repository folder in VS Code and install these extensions:

| Extension | ID | Purpose |
|---|---|---|
| ESLint | `dbaeumer.vscode-eslint` | boundary + code-quality linting in-editor |
| Prettier | `esbenp.prettier-vscode` | formatting (repo has `.prettierrc.json`) |
| Vitest | `vitest.explorer` | run/test individual tests from the editor |
| TypeScript + JavaScript | `vscode.typescript-language-features` | built-in; ensure the workspace version is used |

Recommended workspace settings (`.vscode/settings.json` at the repository
root — this file is allowed by the repo's `.gitignore`):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.validate": ["typescript", "typescriptreact"],
  "typescript.tsdk": "node_modules/typescript/lib",
  "search.exclude": { "**/dist": true, "**/.next": true, "**/node_modules": true }
}
```

---

## 5. Repository installation

```powershell
git clone <repository-url> forge
cd forge
```

Install workspace dependencies (this also installs the git hooks via the
`prepare` script):

```powershell
pnpm install
```

Build everything (packages must be compiled to `dist` before the app can run):

```powershell
pnpm build
```

Verify the baseline gates:

```powershell
pnpm arch-check
pnpm validate-docs
pnpm lint
pnpm typecheck
pnpm test
```

All must pass (see Section 21 for expected output).

---

## 6. Environment configuration

Copy the documented environment template into a local (never-committed) file:

```powershell
Copy-Item apps\jwt-scanner\.env.example apps\jwt-scanner\.env.local
```

For the **test-mode** workflow (no credentials, no database), no variables need
values — the runtime modes are selected with environment variables at start
time (Section 9):

| Variable | Value | Effect |
|---|---|---|
| `AUTH_MODE` | `test` | deterministic auth seam (fixed principal `scanner@example.test`, one organization) |
| `BILLING_MODE` | `test` | deterministic in-memory billing |
| `DATA_MODE` | `memory` | deterministic in-memory persistence (no database needed) |

For the **live-mode** workflow (Sections 7–8 + 17), set real values in
`.env.local` (see `apps/jwt-scanner/docs/SETUP.md` for the full table).

---

## 7. Database setup (optional — only for `DATA_MODE=postgres`)

Skip this section if you use `DATA_MODE=memory`.

**Option A — Docker (recommended):**

```powershell
docker compose -f apps\jwt-scanner\docker-compose.yml up -d db
```

This starts PostgreSQL 16 on `localhost:5432` with user/password/database all
`forge`. The web service in that compose file runs in test mode against this
database (Section 9 also works against it with `DATA_MODE=postgres`).

**Option B — local PostgreSQL:**

Create a database and user, then set the connection string. Example:

```powershell
$env:DATABASE_URL = "postgres://postgres:postgres@localhost:5432/forge"
```

---

## 8. Migration commands

Migrations apply the shared **platform** schema first, then the product
schema (`jwt_scanner`), in the deterministic order defined by V3 §6.5:

```powershell
$env:DATABASE_URL = "postgres://postgres:postgres@localhost:5432/forge"
pnpm --filter jwt-scanner db:migrate
```

> The script first compiles `src` to `dist` (`tsc -p tsconfig.build.json`) and
> then runs `node dist/db/migrate.js`. It is idempotent: applied migrations are
> tracked in `drizzle.__drizzle_migrations` and never re-applied.

Verify the tables exist (psql or any client):

```sql
SELECT table_schema, table_name FROM information_schema.tables
WHERE table_schema IN ('platform', 'jwt_scanner') ORDER BY 1, 2;
```

---

## 9. Starting the application

**Test mode (no credentials, no database):**

```powershell
cd apps\jwt-scanner
$env:AUTH_MODE="test"; $env:BILLING_MODE="test"; $env:DATA_MODE="memory"
pnpm dev
```

Open <http://localhost:3000>. You are signed in as `scanner@example.test`
("Test Organization") — there is no login screen in test mode by design.

**Test mode against the compose database:**

```powershell
docker compose -f apps\jwt-scanner\docker-compose.yml up --build
```

Then open <http://localhost:3000> (the web service runs `pnpm db:migrate`
first). Stop with `docker compose -f apps\jwt-scanner\docker-compose.yml down`.

**Live mode (real Clerk/Stripe):** set `AUTH_MODE=live`, `BILLING_MODE=live`,
`DATA_MODE=postgres` and the `CLERK_SECRET_KEY` / `STRIPE_SECRET_KEY`
variables from `.env.local` (see Section 17).

Health check (works in every mode):

```powershell
curl.exe http://localhost:3000/api/health
# → {"status":"ok","service":"jwt-scanner","time":"..."}
```

---

## 10. Authentication setup

**Test mode:** nothing to configure — the `src/dev-mode/auth.ts` seam resolves a
fixed authenticated principal with one organization. This is the canonical way
to exercise every authenticated surface without credentials.

**Live mode (optional, manual):**

1. Create a Clerk application at <https://dashboard.clerk.com>.
2. Set `CLERK_SECRET_KEY` in `apps\jwt-scanner\.env.local`.
3. Set `AUTH_SIGN_IN_URL` (e.g. your Clerk sign-in URL) so the landing page CTA
   points at your sign-in.
4. Restart with `AUTH_MODE=live`; sign in with a test user, create an
   organization, and re-verify Sections 11–16 under the real provider.
5. (Optional) wire the Clerk webhook for proactive identity sync — see
   `apps/jwt-scanner/docs/PROVIDERS.md`.

---

## 11. Organization / tenant setup

**Test mode:** the seam provides exactly one organization ("Test Organization").
Every scan, finding, report, and billing status you create belongs to it.

To observe **tenant isolation** with the real application:

1. In test mode, run a scan (Section 12) and note the job id in the URL
   (`/scans/<jobId>`).
2. Open a scan URL for a job id that does not exist:
   `http://localhost:3000/scans/00000000-0000-0000-0000-000000000000` → 404.
3. With live Clerk: create a **second organization**, and confirm that scans
   created in organization A are not visible in organization B — every
   tenant-scoped query is scoped with the `withOrg()` helper
   (`src/features/scans/drizzle-persistence.ts`).

---

## 12. Primary product workflow

1. Open <http://localhost:3000> — the landing page shows the tagline
   **"Scan JWTs for security issues"** and a **"Start scanning"** CTA.
2. Click **Start scanning** → the scanner page (auth seam signs you in).
3. Paste a JWT into **"JWT token to scan"** and click **Run scan**.

Use this token (it declares `alg=none` — a finding is guaranteed):

```
eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImV4cCI6NDEwMjQ0NDgwMH0.
```

(header: `{"alg":"none","typ":"JWT"}`, payload: `{"sub":"1234567890","name":"John Doe","admin":true,"exp":4102444800}`, empty signature)

4. You land on **Scan results** with the finding **"Unsecured JWT algorithm declared"**
   (severity **critical**).
5. The same token scanned twice produces the **same** findings (deterministic
   engine — the scan time is an explicit input).

---

## 13. Findings / results verification

- On the results page, verify: job status badge (**completed**), the severity
  count summary (critical/high/medium/low/info), and the finding list.
- Test an **expired** token: replace `"exp":4102444800` with `"exp":1` in the
  payload above → expect the **"JWT expiration time has passed"** finding
  (medium).
- Scan a **well-formed, unexpired HS256 token** with no weaknesses → expect
  **"No findings"** empty state.
- Scan **garbage** (`not-a-jwt`) → expect a validation error message, no crash.

---

## 14. Finding-detail verification

1. From a scan with findings, click a finding title.
2. The finding detail page shows: title, severity badge, description, the
   **Evidence** section (decoded header/payload, signature segment present) and
   the **Recommendation** section.
3. Back link (`← Back to scan results`) returns to the results page.
4. A finding id that does not belong to the job → 404.

---

## 15. Report generation

From a scan results page, the **Export report** links render the report through
`@forge/reporting`:

- **JSON** (`/scans/<jobId>/export?format=json`)
- **Markdown** (`?format=markdown`)
- **HTML** (`?format=html`)

Each export is recorded in `jwt_scanner.reports` (in `DATA_MODE=postgres`).
Verify the JSON report contains: title, subtitle, summary (totalFindings,
findingsBySeverity), and the findings array with evidence and references.
An unsupported format (`?format=csv`) → 400.

---

## 16. Export verification

1. Click **Export JSON** → the browser downloads
   `jwt-scanner-<jobId>.json`.
2. Open the downloaded file: it is valid JSON with `totalFindings`,
   `findingsBySeverity`, and one object per finding.
3. Repeat for Markdown and HTML; the content matches the on-page results.
4. Determinism check: export the same scan twice → byte-identical content.

---

## 17. Provider configuration

The composition root is `apps\jwt-scanner\src\providers.ts` — the **only** file
allowed to import adapters (machine-enforced). Current wiring:

| Port | Adapter | Vendor SDK | Requires (live mode) |
|---|---|---|---|
| `AuthPort` | `@forge/adapter-clerk` | `@clerk/backend` | `CLERK_SECRET_KEY` |
| `BillingPort` | `@forge/adapter-stripe` | `stripe` | `STRIPE_SECRET_KEY` |
| `BillingWebhookHandler` | `@forge/adapter-stripe` | `stripe` | `STRIPE_WEBHOOK_SECRET` |
| Persistence | Drizzle + PostgreSQL | — (P7) | `DATABASE_URL` |

Live-mode setup (manual):

1. Stripe: create a test-mode account; set `STRIPE_SECRET_KEY` and
   `STRIPE_WEBHOOK_SECRET` in `.env.local`.
2. Configure the Stripe dashboard webhook for
   `checkout.session.completed` (and optionally subscription/invoice events)
   pointing at `https://<host>/api/webhooks/billing`.
3. In test mode the webhook accepts the deterministic signature
   `x-dev-signature: dev_billing_secret` (see `src/dev-mode/billing.ts`) —
   useful for exercising the endpoint locally:

```powershell
curl.exe -X POST http://localhost:3000/api/webhooks/billing `
  -H "Content-Type: application/json" `
  -H "x-dev-signature: dev_billing_secret" `
  -d '{"type":"dev.checkout_completed","customerId":"dev_customer_0001","priceId":"price_jwt_scanner_pro_monthly","subscriptionId":"dev_sub_0001"}'
```

(Missing or wrong signature → 401.)

---

## 18. Provider swap demonstration

Prove the architecture's replacement guarantee (P12/P21) without changing any
product logic:

1. `pnpm arch-check` confirms today's adapter wiring is the only adapter
   import site (rules `ADAPTER_BYPASS`, `VENDOR_LEAKAGE`, `ADAPTER_CONTRACT_DEPENDENCY`).
2. Inspect the port contract `packages\auth\src\port.ts` and its conformance
   suite `packages\testing\src\conformance\auth.ts` — any implementation
   passing the suite is a valid replacement.
3. Simulate a swap: implement a throwaway `AuthPort` in `src/providers.ts`
   (e.g. return a fixed user), restart in `AUTH_MODE=live`, and observe that
   **no file other than `providers.ts` changes** — the scanner page, scans,
   results, finding detail, and export all keep working because they consume
   `authPort` (the port), not Clerk.
4. Run `pnpm test` — the feature/service tests use the `@forge/testing` mock
   ports and in-memory persistence, so they pass independent of the wired
   provider.

> The adapter packages themselves are conformance-tested
> (`packages/adapters/*/__tests__/conformance.test.ts`), so the swap is
> verified by the same suite the real adapters pass.

---

## 19. Architecture validation

```powershell
pnpm arch-check
```

Expect: `Architecture check passed: 24 package(s), 265 source file(s),
3 warning(s).`

The 3 warnings are **by design**: the frozen adapter contract
(`ADAPTER_CONTRACT_DEPENDENCY`) requires every adapter to declare
`@forge/shared`, which is unused in three adapters — the checker reports this
as a non-blocking `UNUSED_DEPENDENCY` warning. Never remove the dependency or
weaken the rule.

Sanity-test the checker (optional): temporarily add
`import { createClerkClient } from "@clerk/backend";` to
`apps\jwt-scanner\src\features\scans\service.ts`, run `pnpm arch-check`, and
confirm `VENDOR_LEAKAGE` fails. Revert the file.

## 20. Documentation validation

```powershell
pnpm validate-docs
```

Expect: `Documentation validation passed: 1 product(s), 17 document(s) checked.`

It checks the framework documents, the product's 10 required documents
(`apps\jwt-scanner\docs\*`), that required sections exist, and that no
document is a stub (TODO/TBD/FIXME/placeholder markers fail).

## 21. Test execution

```powershell
pnpm test
```

Expect: all **44 test tasks** pass (24 packages). Highlights:

- Adapter conformance: `@forge/adapter-clerk` (68 tests, incl. the AuthPort
  conformance suite), `@forge/adapter-stripe` (27), `@forge/adapter-resend`
  (16), `@forge/adapter-pg-boss` (18)
- Product: `jwt-scanner` 206 tests (domain engine, schemas, features,
  integration scan flow, components, theme, migrations, neutrality)
- Tools: architecture-check 27, create-product 20, extract-product 25,
  extraction-validate 27, validate-docs 9

Unit-level test filtering:

```powershell
cd apps\jwt-scanner
pnpm exec vitest run src/domain/__tests__/engine.test.ts
```

E2E (browser) — requires Playwright browsers (one-time download):

```powershell
cd apps\jwt-scanner
pnpm exec playwright install chromium
pnpm e2e
```

The E2E spec (`e2e\flows\critical-path.spec.ts`) drives the real app in test
mode: signup (seam) → scan the `alg=none` token → view findings → export JSON.

## 22. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `pnpm: command not found` | pnpm not installed; run `corepack enable` + `corepack prepare pnpm@11.21.0 --activate` and open a new terminal |
| `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL` | a subcommand failed; scroll up for the real error |
| `Dist` imports missing (`Cannot find module '@forge/shared'`) | run `pnpm build` from the repository root first |
| `pnpm install` fails on lockfile | you are on a different pnpm; verify `pnpm --version` = 11.21.0 |
| Port 3000 in use | `pnpm dev` uses 3000 by default; change with `pnpm dev -- -p 3100` |
| `DATABASE_URL` error at first DB use | you are in live/data mode without a database; use `DATA_MODE=memory` or set `DATABASE_URL` and run `pnpm --filter jwt-scanner db:migrate` |
| Auth error in live mode | `CLERK_SECRET_KEY` missing/expired; use `AUTH_MODE=test` to bypass |
| Webhook 401 | wrong/missing signature; test mode uses `x-dev-signature: dev_billing_secret` |
| 404 on a scan page | the scan belongs to another organization (isolation working as designed) or the id is wrong |
| `arch-check` fails | an import crossed a frozen boundary; fix the import — do not weaken the rule |
| E2E cannot launch browser | run `pnpm exec playwright install chromium` (or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`) |
| PowerShell quoting of JSON | use single quotes around JSON bodies, as in Section 17 |

---

## Manual test matrix

Use this matrix to record Task 015 verification. Expected results refer to the
test-mode workflow (Sections 5–16) unless noted.

| # | Test | Steps | Expected Result | Pass/Fail |
|---|------|-------|-----------------|-----------|
| 1 | Clean startup | `pnpm install` + `pnpm build` + `pnpm dev` (test mode) | install/build/dev succeed; no errors in the dev log | ☐ |
| 2 | Health check | `curl.exe http://localhost:3000/api/health` | HTTP 200, `{"status":"ok",...}` | ☐ |
| 3 | Authentication | Open `/scanner` in test mode | dashboard renders (fixed principal, "Test Organization"); no login prompt | ☐ |
| 4 | Unauthorized access | Live mode: open `/scanner` signed out | redirect to landing with `?auth=required` | ☐ |
| 5 | Organization isolation | Scan in org A; request the job URL from org B context | 404 / not visible (both `withOrg()` and memory persistence) | ☐ |
| 6 | Main product workflow | Landing → Start scanning → paste `alg=none` token → Run scan | results page renders; job id in URL | ☐ |
| 7 | Invalid input | Scan `not-a-jwt` | validation error message; no crash | ☐ |
| 8 | Findings | Scan the `alg=none` token | "Unsecured JWT algorithm declared", severity critical | ☐ |
| 9 | Finding details | Click the finding title | detail page: description, Evidence, Recommendation | ☐ |
| 10 | Reporting | Click Export JSON / Markdown / HTML | each renders; report rows recorded in `jwt_scanner.reports` (postgres mode) | ☐ |
| 11 | Export | Download JSON report | file `jwt-scanner-<jobId>.json`; valid JSON with summary + findings | ☐ |
| 12 | UI rendering | Landing, scanner, results, finding detail, billing pages | pages render with the product theme (dark tokens) | ☐ |
| 13 | Persistence | `DATA_MODE=postgres`: run a scan, restart the app, open the results URL | scan, findings, and reports survive restart | ☐ |
| 14 | Provider resolution | `src/providers.ts` inspection + `pnpm arch-check` | adapters imported only in `providers.ts`; no vendor SDK elsewhere | ☐ |
| 15 | Test mode | `AUTH_MODE=test BILLING_MODE=test DATA_MODE=memory pnpm dev` | full app works with zero credentials/database | ☐ |
| 16 | Architecture checker | `pnpm arch-check` | passes with the 3 known warnings | ☐ |
| 17 | Documentation validator | `pnpm validate-docs` | passes (1 product, 17 documents) | ☐ |
| 18 | Product tooling | `pnpm create-product demo --archetype analyzer --capabilities reporting` (in a scratch checkout) | valid skeleton scaffolded; `pnpm arch-check` passes on it | ☐ |
| 19 | Extraction tooling | `pnpm extraction-validate jwt-scanner` | passes (0 warnings, 0 errors) | ☐ |
| 20 | Error handling | bad webhook signature; unknown scan id; unsupported export format | 401 / 404 / 400 respectively; no 500s in normal flows | ☐ |
| 21 | Billing (test mode) | Billing page → plan cards; checkout action; webhook with dev signature | page renders plans; webhook 200 with valid signature | ☐ |
| 22 | E2E suite | `pnpm exec playwright install chromium` + `pnpm e2e` | critical path passes (signup → scan → findings → export) | ☐ |

---

## What this guide does not cover (and why)

- **Live Clerk sign-in / Stripe checkout** — requires real provider accounts
  and is intentionally a manual step (Section 17). The repository's automated
  coverage uses the deterministic port seams; nothing in the product code
  changes between test and live mode except the composition root.
- **Docker build verification** — `docker compose up` (Section 7/9) requires
  Docker Desktop and is a manual step. The `Dockerfile` and
  `docker-compose.yml` were added in Task 014 and must be built once on a
  machine with Docker (see `apps/jwt-scanner/docs/DEPLOYMENT.md`).
- **Performance / load testing** — out of scope for the frozen V3 plan.
