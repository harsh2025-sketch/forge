/**
 * Subscription persistence for JWT Scanner (V3 §6.3 classification B).
 *
 * The product records its organizations' billing state in the shared
 * `platform.subscriptions` table (org-scoped, `withOrg()` required). This is
 * the only billing data the product persists; the billing provider remains
 * the source of truth for payment state, and this table is the neutral
 * projection the product reads (customer ids, subscription ids, plan, status).
 *
 * Two implementations mirror the scan persistence seam:
 *   - drizzle-subscription-persistence.ts (production, withOrg-scoped)
 *   - memory-subscription-persistence.ts (tests / DATA_MODE=memory)
 */

import type { SubscriptionRow } from "@forge/db";

/** Neutral statuses the product writes to platform.subscriptions. */
export const SubscriptionStatusValue = {
  /** Checkout started; provider webhook has not confirmed it yet. */
  CHECKOUT: "checkout",
  ACTIVE: "active",
  TRIALING: "trialing",
  PAST_DUE: "past_due",
  CANCELED: "canceled",
} as const;

export type SubscriptionStatusValue =
  (typeof SubscriptionStatusValue)[keyof typeof SubscriptionStatusValue];

export interface SubscriptionUpdate {
  readonly planId?: string | null;
  readonly externalCustomerId?: string | null;
  readonly externalSubscriptionId?: string | null;
  readonly status?: SubscriptionStatusValue;
  readonly currentPeriodEnd?: Date | null;
}

export interface SubscriptionPersistence {
  /** Returns the org's subscription row, or null when none exists. */
  getByOrg(orgId: string): Promise<SubscriptionRow | null>;

  /** Creates or updates the org's subscription row. */
  upsert(orgId: string, update: SubscriptionUpdate): Promise<SubscriptionRow>;

  /**
   * Returns every subscription row carrying the given external customer id.
   * Used by the webhook boundary to resolve which organization a provider
   * event belongs to (the webhook payload has no internal org id).
   */
  rowsByCustomer(externalCustomerId: string): Promise<readonly SubscriptionRow[]>;
}
