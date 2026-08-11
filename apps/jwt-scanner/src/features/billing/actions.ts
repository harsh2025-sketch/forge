/**
 * JWT Scanner billing feature — server actions.
 * Thin Next.js boundary over the billing service (src/features/billing/service.ts).
 */

"use server";

import type { Result } from "@forge/shared";
import { appConfig, authPort, billingPort, getSubscriptionPersistence } from "@/providers";
import {
  getBillingStatus,
  openBillingPortal,
  startCheckout,
  type BillingStatus,
} from "./service.js";

function billingDeps() {
  return {
    auth: authPort,
    billing: billingPort,
    subscriptions: getSubscriptionPersistence(),
    baseUrl: appConfig.baseUrl,
  };
}

/** Starts hosted checkout for a plan id. */
export async function startCheckoutAction(
  planId: string,
): Promise<Result<{ url: string }, string>> {
  return startCheckout(billingDeps(), planId);
}

/** Returns the org's billing status projection. */
export async function getBillingStatusAction(): Promise<Result<BillingStatus, string>> {
  return getBillingStatus(billingDeps());
}

/** Opens the billing provider's self-service portal. */
export async function openBillingPortalAction(): Promise<Result<{ url: string }, string>> {
  return openBillingPortal(billingDeps());
}
