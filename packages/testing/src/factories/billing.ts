/**
 * Billing test data factories — deterministic builders for @forge/billing types.
 * V3 §3.2 (packages/testing/src/factories/), Day 5.
 */

import {
  SubscriptionStatus,
  type BillingCustomer,
  type BillingPortalParams,
  type BillingSubscription,
  type CreateCheckoutParams,
  type CreateCustomerParams,
  type Entitlement,
  type Plan,
  type ReportUsageParams,
} from "@forge/billing";

let customerSequence = 0;

/** Builds a valid BillingCustomer with a unique id per call. */
export function makeBillingCustomer(overrides?: Partial<BillingCustomer>): BillingCustomer {
  customerSequence += 1;
  const n = customerSequence;
  return {
    id: `customer_${String(n).padStart(4, "0")}`,
    email: `customer-${n}@example.test`,
    name: `Test Customer ${n}`,
    ...overrides,
  };
}

/** Builds valid CreateCustomerParams. */
export function makeCreateCustomerParams(overrides?: Partial<CreateCustomerParams>): CreateCustomerParams {
  return {
    email: "new-customer@example.test",
    name: "New Customer",
    ...overrides,
  };
}

let subscriptionSequence = 0;

/** Builds a valid active BillingSubscription with a unique id per call. */
export function makeBillingSubscription(overrides?: Partial<BillingSubscription>): BillingSubscription {
  subscriptionSequence += 1;
  const n = subscriptionSequence;
  return {
    id: `sub_${String(n).padStart(4, "0")}`,
    customerId: "customer_0001",
    priceId: "price_0001",
    status: SubscriptionStatus.ACTIVE,
    currentPeriodEnd: "2026-12-31T23:59:59.000Z",
    ...overrides,
  };
}

/** Builds valid CreateCheckoutParams referencing an existing customer and price. */
export function makeCreateCheckoutParams(overrides?: Partial<CreateCheckoutParams>): CreateCheckoutParams {
  return {
    customerId: "customer_0001",
    priceId: "price_0001",
    successUrl: "https://app.example.test/checkout/success",
    cancelUrl: "https://app.example.test/checkout/cancel",
    ...overrides,
  };
}

/** Builds valid BillingPortalParams. */
export function makeBillingPortalParams(overrides?: Partial<BillingPortalParams>): BillingPortalParams {
  return {
    customerId: "customer_0001",
    returnUrl: "https://app.example.test/billing",
    ...overrides,
  };
}

/** Builds a valid Entitlement. */
export function makeEntitlement(overrides?: Partial<Entitlement>): Entitlement {
  return {
    key: "scans",
    limit: 100,
    ...overrides,
  };
}

/** Builds a valid Plan carrying at least one entitlement. */
export function makePlan(overrides?: Partial<Plan>): Plan {
  return {
    id: "plan_0001",
    name: "Test Plan",
    priceId: "price_0001",
    entitlements: [makeEntitlement()],
    ...overrides,
  };
}

/** Builds valid ReportUsageParams. */
export function makeReportUsageParams(overrides?: Partial<ReportUsageParams>): ReportUsageParams {
  return {
    subscriptionId: "sub_0001",
    meterKey: "scans",
    quantity: 1,
    ...overrides,
  };
}
