# JWT Scanner API

## Surface

JWT Scanner exposes its behavior through Next.js App Router routes and Server
Actions. Every route and action follows the product conventions below.

## Server Actions

State-changing operations are Server Actions in `src/features/*/actions.ts`.
Every action:

- validates its input with a Zod schema from `src/domain/schemas.ts` or a
  feature schema (`src/features/scans/service.ts`)
- authorizes the caller through the auth port (`authPort`) before touching data
- returns `Result<T, E>` and never throws for expected failures
- enforces organization scoping on every read and write (`withOrg()`)

### Actions

| Action | Input | Output | Authorization |
| --- | --- | --- | --- |
| `submitScanAction` | `{ token, projectName? }` (feature Zod schema) | `{ jobId, findings }` | authenticated + org |
| `getScanResultsAction` | `jobId` | scan results (job, project, findings, summary) | authenticated + org (scoped) |
| `getFindingDetailAction` | `jobId`, `findingId` | finding detail | authenticated + org (scoped) |
| `listRecentScansAction` | `limit?` | recent jobs (org-scoped) | authenticated + org |
| `startCheckoutAction` | `planId` | hosted checkout `url` | authenticated + org |
| `getBillingStatusAction` | — | billing status projection | authenticated + org |
| `openBillingPortalAction` | — | billing portal `url` | authenticated + org |

## API routes and webhooks

| Endpoint | Method | Purpose | Authorization |
| --- | --- | --- | --- |
| `/scans/[jobId]/export?format=json\|markdown\|html` | GET | Downloads the scan report rendered by `@forge/reporting` (attachment) | authenticated + org (scoped) |
| `/api/webhooks/billing` | POST | Billing provider webhook: verifies signature via `BillingWebhookHandler`, projects checkout events onto `platform.subscriptions` | provider signature |

Webhook endpoints are the only places that consume raw provider payloads: each
webhook handler is implemented by an adapter (for example
`BillingWebhookHandler` from `@forge/billing`) and verifies the provider's
signature before any data is changed.

## Contracts

The scan submission contract is the frozen product schema: a compact JWT
(`header.payload.signature`, base64url, at most 64 KiB) plus an optional
project name (max 200 characters). Analysis output is the analyzer archetype
result: findings (category, severity, title, description, token-free evidence,
recommendation, references) plus a summary (total findings, counts by
severity). Export formats are `json`, `markdown`, and `html`, all generated
from the same `ReportDocument` by the shared reporting pipeline.

## Errors

Every endpoint and action returns structured errors via `Result`. Error
responses never leak stack traces, connection strings, or provider secrets;
`@forge/shared` error types carry machine-readable codes that clients can
branch on.

## Testing

Every route and action has integration coverage under
`src/__tests__/integration/` and feature tests under
`src/features/*/__tests__/` (see `docs/TESTING.md`). Webhook handlers are
tested with signed fixture payloads.
