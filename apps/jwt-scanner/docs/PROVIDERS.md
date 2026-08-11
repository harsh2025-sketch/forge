# JWT Scanner Providers

## Ports and adapters

JWT Scanner consumes external capabilities exclusively through Forge port
packages (`@forge/auth`, `@forge/billing`, `@forge/email`, `@forge/analytics`,
`@forge/jobs`, `@forge/storage`, `@forge/ai-provider`). Ports are
provider-neutral interfaces; adapters in `packages/adapters/*` implement them
for a concrete vendor.

The product declares the capabilities it needs in `product.manifest.ts`:
`reporting`, plus the billing plans it offers (`free`, `pro`) with
provider-neutral `priceId` identifiers.

## Composition root

`src/providers.ts` is the only file in the application allowed to import
adapter packages. Every other module imports the wired ports from it, for
example:

```ts
import { authPort, billingPort } from "@/providers";
```

### Wired providers (Day-13 milestone)

| Port | Adapter | Vendor SDK | Requires |
| --- | --- | --- | --- |
| `AuthPort` (`authPort`) | `@forge/adapter-clerk` | `@clerk/backend` | `CLERK_SECRET_KEY` in live mode |
| `BillingPort` (`billingPort`) | `@forge/adapter-stripe` | `stripe` | `STRIPE_SECRET_KEY` in live mode |
| `BillingWebhookHandler` (`getBillingWebhookHandler()`) | `@forge/adapter-stripe` | `stripe` | `STRIPE_WEBHOOK_SECRET` in live mode |

Feature code consumes the ports; domain code never imports them. The Clerk
session token is read from the request cookies and verified with the adapter's
token verifier (`src/features/auth/session-resolver.ts`), so `@clerk/backend`
appears only inside the adapter package.

Billing follows the same rule: the feature layer (`src/features/billing/`)
uses `BillingPort` methods (`createCustomer`, `createCheckoutSession`,
`getActiveSubscription`, `createBillingPortalSession`). The Stripe SDK appears
only inside `@forge/adapter-stripe`. The product persists a neutral projection
of billing state in `platform.subscriptions` (customer id, subscription id,
plan id, status) — never provider objects.

## Runtime modes (deterministic test seams)

The whole application can run without live provider credentials. The seams
implement the frozen port contracts (they are not new abstractions) and are
selected explicitly in `src/providers.ts`:

| Variable | Values | Behavior |
| --- | --- | --- |
| `AUTH_MODE` | `live` (default) \| `test` | `test` uses `src/dev-mode/auth.ts` (fixed principal + one organization) |
| `BILLING_MODE` | `live` (default) \| `test` | `test` uses `src/dev-mode/billing.ts` (in-memory customers/checkout/webhook) |
| `DATA_MODE` | `postgres` (default) \| `memory` | `memory` uses the deterministic in-memory persistence seam |

In live mode without the required secrets the ports fail with a clear
configuration error at first use (never at import time), so builds and tests
without credentials keep working.

## Provider replacement

Replacing a provider must not change application or domain code:

1. Implement or select a new adapter that satisfies the port's conformance suite.
2. Verify the adapter passes the `packages/testing/conformance` tests.
3. Switch the wiring in `src/providers.ts` (and the env variables it reads).
4. Update the environment configuration and this document.

If `pnpm arch-check` reports vendor leakage or adapter bypass, the wiring is
wrong; vendor SDKs may appear only inside adapter packages. The product's own
neutrality tests (`src/__tests__/neutrality.test.ts`) pin the same contract at
the package level.

## Webhooks

The billing webhook endpoint (`/api/webhooks/billing`) verifies provider
signatures through the wired `BillingWebhookHandler` and projects verified
checkout events onto `platform.subscriptions`. Live Stripe deployments must
configure the Stripe dashboard webhook to send `checkout.session.completed`
(and optionally `customer.subscription.updated` / `deleted`,
`invoice.payment_failed`) with the `STRIPE_WEBHOOK_SECRET`. Identity sync of
Clerk organizations/users into `platform.organizations`/`platform.users`
happens on first use (`src/features/auth/identity.ts`); wiring the Clerk
webhook handler for proactive sync is operational setup for Day 14.

## Migration from a legacy application

Products imported with `pnpm extract-product` arrive with an
`extraction-report.json` that lists every provider integration found in the
source, classified REVIEW or MANUAL. Each integration must be migrated behind
its port before the product is compliant; the report's remediation notes
describe the required work.
