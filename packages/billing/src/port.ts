/**
 * BillingPort — billing capability contract.
 * V3 §5.2. Implemented by adapters only; never by this package.
 */

import type {
  BillingPortalParams,
  BillingSession,
  BillingSubscription,
  BillingCustomer,
  CreateCheckoutParams,
  CreateCustomerParams,
  CustomerId,
  ReportUsageParams,
  SubscriptionId,
} from "./types.js";

export interface BillingPort {
  /** Creates a billing customer for the given contact details. */
  createCustomer(params: CreateCustomerParams): Promise<BillingCustomer>;

  /** Creates a hosted checkout session the customer is redirected to. */
  createCheckoutSession(params: CreateCheckoutParams): Promise<BillingSession>;

  /** Creates a hosted self-service billing session for an existing customer. */
  createBillingPortalSession(params: BillingPortalParams): Promise<BillingSession>;

  /** Returns the customer's active subscription, or `null` when there is none. */
  getActiveSubscription(customerId: CustomerId): Promise<BillingSubscription | null>;

  /**
   * Cancels a subscription.
   * Throws `BillingPortError` with code `BILLING_SUBSCRIPTION_NOT_FOUND` when it does not exist.
   */
  cancelSubscription(subscriptionId: SubscriptionId): Promise<void>;

  /** Reports metered usage for a subscription. */
  reportUsage(params: ReportUsageParams): Promise<void>;
}
