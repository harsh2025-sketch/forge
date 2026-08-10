/**
 * @forge/billing — billing port.
 * Provider-neutral contracts only. Depends on @forge/shared and nothing else.
 * V3 §3.2, §4.1, §5.2.
 */

export type {
  BillingCustomer,
  BillingPortErrorOptions,
  BillingPortalParams,
  BillingRequestHeaders,
  BillingSession,
  BillingSubscription,
  BillingTimestamp,
  CreateCheckoutParams,
  CreateCustomerParams,
  CustomerId,
  Entitlement,
  Plan,
  PlanId,
  PriceId,
  ReportUsageParams,
  SubscriptionId,
} from "./types.js";
export {
  BillingErrorCode,
  BillingEventType,
  BillingPortError,
  SUBSCRIPTION_STATUS_VALUES,
  SubscriptionStatus,
  isActiveSubscriptionStatus,
  isSubscriptionStatus,
} from "./types.js";

export type { BillingPort } from "./port.js";

export type { BillingWebhookHandler, BillingWebhookRequest } from "./webhook-port.js";

export {
  findEntitlement,
  getEntitlementLimit,
  hasEntitlement,
  isWithinEntitlementLimit,
} from "./entitlements.js";
