/**
 * JWT Scanner billing feature service (V3 §5.2 BillingPort, P12, P21).
 *
 * Feature code reaches billing exclusively through the BillingPort wired in
 * src/providers.ts — never through a provider SDK. The service implements the
 * product's billing flow:
 *
 *   plan selection → ensure billing customer → hosted checkout session
 *   → subscription status projection (platform.subscriptions)
 *
 * Provider swap (e.g. Stripe → another BillingPort implementation) requires
 * changing only src/providers.ts and the adapter configuration — never this
 * module, the domain engine, the database model, or the report layer.
 */

import type { AuthPort } from "@forge/auth";
import type { BillingPort } from "@forge/billing";
import type { Result } from "@forge/shared";
import { getOrgUserContext } from "@/features/auth/session";
import { platformOrganizationId } from "@/features/auth/identity";
import { findPlan } from "./plans.js";
import type { SubscriptionPersistence } from "./subscription-persistence.js";
import { SubscriptionStatusValue } from "./subscription-persistence.js";

export interface BillingDeps {
  readonly auth: AuthPort;
  readonly billing: BillingPort;
  readonly subscriptions: SubscriptionPersistence;
  /** Base URL used to build success/cancel URLs for checkout. */
  readonly baseUrl?: string;
}

export interface BillingStatus {
  readonly planId: string | null;
  readonly status: string;
  readonly externalCustomerId: string | null;
  readonly externalSubscriptionId: string | null;
  readonly currentPeriodEnd: Date | null;
}

/** The org's current billing status projection (never a provider call shape). */
export async function getBillingStatus(
  deps: BillingDeps,
): Promise<Result<BillingStatus, string>> {
  const context = await getOrgUserContext(deps.auth);
  if (!context.ok) return context;

  const row = await deps.subscriptions.getByOrg(platformOrganizationId(context.value.org.id));
  if (row === null) {
    return {
      ok: true,
      value: {
        planId: null,
        status: "none",
        externalCustomerId: null,
        externalSubscriptionId: null,
        currentPeriodEnd: null,
      },
    };
  }
  return {
    ok: true,
    value: {
      planId: row.planId,
      status: row.status,
      externalCustomerId: row.externalCustomerId,
      externalSubscriptionId: row.externalSubscriptionId,
      currentPeriodEnd: row.currentPeriodEnd,
    },
  };
}

async function ensureCustomerId(
  deps: BillingDeps,
  orgId: string,
  email: string,
  orgName: string,
): Promise<Result<string, string>> {
  // orgId here is the platform (DB-scoped) organization id.
  
  const existing = await deps.subscriptions.getByOrg(orgId);
  if (existing?.externalCustomerId != null && existing.externalCustomerId !== "") {
    return { ok: true, value: existing.externalCustomerId };
  }
  try {
    const customer = await deps.billing.createCustomer({
      email,
      name: orgName,
      metadata: {
        organizationId: orgId,
        productId: "jwt-scanner",
      },
    });
    await deps.subscriptions.upsert(orgId, {
      externalCustomerId: customer.id,
      status: SubscriptionStatusValue.CHECKOUT,
    });
    return { ok: true, value: customer.id };
  } catch {
    return { ok: false, error: "Billing provider could not create a customer" };
  }
}

/**
 * Starts a hosted checkout for the given plan. Returns the hosted session URL
 * the caller redirects the user to.
 */
export async function startCheckout(
  deps: BillingDeps,
  planId: string,
): Promise<Result<{ url: string }, string>> {
  const plan = findPlan(planId);
  if (plan === undefined) {
    return { ok: false, error: `Unknown plan: ${planId}` };
  }

  const context = await getOrgUserContext(deps.auth);
  if (!context.ok) return context;

  const dbOrgId = platformOrganizationId(context.value.org.id);
  const customerId = await ensureCustomerId(
    deps,
    dbOrgId,
    context.value.user.email,
    context.value.org.name,
  );
  if (!customerId.ok) return customerId;

  const baseUrl = deps.baseUrl ?? "http://localhost:3000";
  try {
    const session = await deps.billing.createCheckoutSession({
      customerId: customerId.value,
      priceId: plan.priceId,
      successUrl: `${baseUrl}/billing?checkout=success`,
      cancelUrl: `${baseUrl}/billing?checkout=cancelled`,
    });
    await deps.subscriptions.upsert(dbOrgId, {
      planId: plan.id,
      status: SubscriptionStatusValue.CHECKOUT,
    });
    return { ok: true, value: { url: session.url } };
  } catch {
    return { ok: false, error: "Billing provider could not start checkout" };
  }
}

/** Opens the billing provider's self-service portal for the org. */
export async function openBillingPortal(
  deps: BillingDeps,
): Promise<Result<{ url: string }, string>> {
  const context = await getOrgUserContext(deps.auth);
  if (!context.ok) return context;

  const row = await deps.subscriptions.getByOrg(
    platformOrganizationId(context.value.org.id),
  );
  if (row?.externalCustomerId == null || row.externalCustomerId === "") {
    return { ok: false, error: "No billing customer exists for this organization" };
  }
  try {
    const session = await deps.billing.createBillingPortalSession({
      customerId: row.externalCustomerId,
      returnUrl: `${deps.baseUrl ?? "http://localhost:3000"}/billing`,
    });
    return { ok: true, value: { url: session.url } };
  } catch {
    return { ok: false, error: "Billing provider could not open the billing portal" };
  }
}
