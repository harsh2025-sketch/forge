# JWT Scanner API

## Surface

JWT Scanner exposes its behavior through Next.js App Router routes and Server
Actions once the application layer is implemented. The skeleton defines the conventions
below; every route and action added to the product must follow them.

## Server Actions

State-changing operations are Server Actions in `src/features/*/actions.ts`. Every
action:

- validates its input with a Zod schema from `src/domain/schemas.ts` or a feature
  schema
- authorizes the caller through the auth port (`authPort`) before touching data
- returns `Result<T, E>` and never throws for expected failures
- uses `revalidatePath` or `revalidateTag` after mutations that affect rendered data

## API routes and webhooks

Machine-to-machine endpoints live in `src/app/api/`. Webhook endpoints are the only
places that consume raw provider payloads: each webhook handler is implemented by an
adapter (for example `BillingWebhookHandler` from `@forge/billing`) and verifies the
provider's signature before any data is changed.

## Contracts

Public contracts are documented here as they are implemented:

| Endpoint / action | Method | Input schema | Output | Authorization |
| --- | --- | --- | --- | --- |

## Errors

Every endpoint and action returns structured errors via `Result`. Error responses
never leak stack traces, connection strings, or provider secrets; `@forge/shared`
error types carry machine-readable codes that clients can branch on.

## Testing

Every route and action has integration coverage under `src/__tests__/integration/`
(see `docs/TESTING.md`). Webhook handlers are tested with signed fixture payloads.
