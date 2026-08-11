/**
 * Mock billing adapters — real behavioral in-memory implementations of
 * BillingPort and BillingWebhookHandler over a shared store. Subscriptions
 * come into existence through the webhook flow (checkout completed), exactly
 * as they would with a real provider. V3 §3.2 (packages/testing/src/mocks/),
 * Day 5.
 */

import {
  BillingErrorCode,
  BillingPortError,
  SubscriptionStatus,
  isActiveSubscriptionStatus,
  isSubscriptionStatus,
  type BillingCustomer,
  type BillingPort,
  type BillingSubscription,
  type BillingWebhookHandler,
  type CreateCheckoutParams,
  type CreateCustomerParams,
  type CustomerId,
  type SubscriptionId,
} from "@forge/billing";

/** In-memory backing store shared by the mock port and webhook handler. */
export interface MockBillingStore {
  readonly customers: Map<CustomerId, BillingCustomer>;
  readonly subscriptions: Map<SubscriptionId, BillingSubscription>;
  /** Usage reports accepted from `reportUsage`, in report order. */
  readonly usageReports: Array<{
    readonly subscriptionId: SubscriptionId;
    readonly meterKey: string;
    readonly quantity: number;
  }>;
}

/** Creates an empty mock billing store. */
export function createMockBillingStore(): MockBillingStore {
  return { customers: new Map(), subscriptions: new Map(), usageReports: [] };
}

let customerSequence = 0;
let sessionSequence = 0;

/** Options for the mock billing webhook handler. */
export interface MockBillingWebhookOptions {
  readonly secret?: string;
}

/**
 * Creates an in-memory BillingPort over the given store.
 * Unknown customers/subscriptions fail with the documented BillingPortError
 * codes.
 */
export function createMockBillingPort(store: MockBillingStore = createMockBillingStore()): BillingPort {
  async function createCustomer(params: CreateCustomerParams): Promise<BillingCustomer> {
    customerSequence += 1;
    const customer: BillingCustomer = {
      id: `mock_customer_${String(customerSequence).padStart(4, "0")}`,
      email: params.email,
      name: params.name,
    };
    store.customers.set(customer.id, customer);
    return customer;
  }

  function requireCustomer(customerId: CustomerId): BillingCustomer {
    const customer = store.customers.get(customerId);
    if (customer === undefined) {
      throw new BillingPortError(`Customer not found: ${customerId}`, {
        code: BillingErrorCode.CUSTOMER_NOT_FOUND,
        details: { customerId },
      });
    }
    return customer;
  }

  async function createCheckoutSession(params: CreateCheckoutParams) {
    requireCustomer(params.customerId);
    sessionSequence += 1;
    return {
      url: `https://checkout.mock/session_${String(sessionSequence).padStart(4, "0")}?customer=${encodeURIComponent(params.customerId)}&price=${encodeURIComponent(params.priceId)}`,
    };
  }

  async function createBillingPortalSession(params: { customerId: CustomerId; returnUrl: string }) {
    requireCustomer(params.customerId);
    sessionSequence += 1;
    return {
      url: `https://billing.mock/session_${String(sessionSequence).padStart(4, "0")}?customer=${encodeURIComponent(params.customerId)}`,
    };
  }

  async function getActiveSubscription(customerId: CustomerId): Promise<BillingSubscription | null> {
    for (const subscription of store.subscriptions.values()) {
      if (subscription.customerId === customerId && isActiveSubscriptionStatus(subscription.status)) {
        return subscription;
      }
    }
    return null;
  }

  async function cancelSubscription(subscriptionId: SubscriptionId): Promise<void> {
    const subscription = store.subscriptions.get(subscriptionId);
    if (subscription === undefined) {
      throw new BillingPortError(`Subscription not found: ${subscriptionId}`, {
        code: BillingErrorCode.SUBSCRIPTION_NOT_FOUND,
        details: { subscriptionId },
      });
    }
    store.subscriptions.set(subscriptionId, { ...subscription, status: SubscriptionStatus.CANCELED });
  }

  async function reportUsage(params: {
    subscriptionId: SubscriptionId;
    meterKey: string;
    quantity: number;
  }): Promise<void> {
    if (!store.subscriptions.has(params.subscriptionId)) {
      throw new BillingPortError(`Subscription not found: ${params.subscriptionId}`, {
        code: BillingErrorCode.SUBSCRIPTION_NOT_FOUND,
        details: { subscriptionId: params.subscriptionId },
      });
    }
    store.usageReports.push({
      subscriptionId: params.subscriptionId,
      meterKey: params.meterKey,
      quantity: params.quantity,
    });
  }

  return {
    createCustomer,
    createCheckoutSession,
    createBillingPortalSession,
    getActiveSubscription,
    cancelSubscription,
    reportUsage,
  };
}

/** Provider-shaped payloads accepted by the mock billing webhook handler. */
export interface MockBillingPayloads {
  checkoutCompleted(params: {
    customerId: CustomerId;
    priceId: string;
    subscriptionId: SubscriptionId;
  }): unknown;
  subscriptionUpdated(params: { subscriptionId: SubscriptionId; status: string }): unknown;
  subscriptionDeleted(params: { subscriptionId: SubscriptionId }): unknown;
  invoicePaymentFailed(params: { subscriptionId: SubscriptionId }): unknown;
}

/** Builds the payloads the mock webhook handler understands. */
export const mockBillingPayloads: MockBillingPayloads = {
  checkoutCompleted({ customerId, priceId, subscriptionId }) {
    return { type: "mock.checkout_completed", customerId, priceId, subscriptionId };
  },
  subscriptionUpdated({ subscriptionId, status }) {
    return { type: "mock.subscription_updated", subscriptionId, status };
  },
  subscriptionDeleted({ subscriptionId }) {
    return { type: "mock.subscription_deleted", subscriptionId };
  },
  invoicePaymentFailed({ subscriptionId }) {
    return { type: "mock.invoice_payment_failed", subscriptionId };
  },
};

/**
 * Creates an in-memory BillingWebhookHandler over the given store. Signature
 * verification expects the configured secret in `x-mock-signature`.
 */
export function createMockBillingWebhookHandler(
  store: MockBillingStore,
  options?: MockBillingWebhookOptions
): BillingWebhookHandler {
  const secret = options?.secret ?? "mock_billing_secret";

  function asRecord(payload: unknown, context: string): Record<string, unknown> {
    if (typeof payload !== "object" || payload === null) {
      throw new BillingPortError(`Invalid ${context} payload`, {
        code: BillingErrorCode.PROVIDER_FAILURE,
      });
    }
    return payload as Record<string, unknown>;
  }

  function requireString(value: unknown, field: string, context: string): string {
    if (typeof value !== "string" || value === "") {
      throw new BillingPortError(`Invalid ${context} payload: missing ${field}`, {
        code: BillingErrorCode.PROVIDER_FAILURE,
      });
    }
    return value;
  }

  function requireSubscription(subscriptionId: SubscriptionId): BillingSubscription {
    const subscription = store.subscriptions.get(subscriptionId);
    if (subscription === undefined) {
      throw new BillingPortError(`Subscription not found: ${subscriptionId}`, {
        code: BillingErrorCode.SUBSCRIPTION_NOT_FOUND,
        details: { subscriptionId },
      });
    }
    return subscription;
  }

  return {
    async verifyWebhookSignature(request) {
      const signature = request.headers.get("x-mock-signature");
      if (signature === null || signature !== secret) {
        throw new BillingPortError("Invalid webhook signature", {
          code: BillingErrorCode.INVALID_WEBHOOK_SIGNATURE,
        });
      }
      const body = await request.text();
      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch (error) {
        throw new BillingPortError("Webhook body is not valid JSON", {
          code: BillingErrorCode.INVALID_WEBHOOK_SIGNATURE,
          cause: error,
        });
      }
      if (typeof payload !== "object" || payload === null) {
        throw new BillingPortError("Webhook payload must be an object", {
          code: BillingErrorCode.INVALID_WEBHOOK_SIGNATURE,
        });
      }
      return payload;
    },

    async handleCheckoutCompleted(payload) {
      const record = asRecord(payload, "checkout.completed");
      const customerId = requireString(record.customerId, "customerId", "checkout.completed");
      const priceId = requireString(record.priceId, "priceId", "checkout.completed");
      const subscriptionId = requireString(record.subscriptionId, "subscriptionId", "checkout.completed");
      if (!store.customers.has(customerId)) {
        throw new BillingPortError(`Customer not found: ${customerId}`, {
          code: BillingErrorCode.CUSTOMER_NOT_FOUND,
          details: { customerId },
        });
      }
      store.subscriptions.set(subscriptionId, {
        id: subscriptionId,
        customerId,
        priceId,
        status: SubscriptionStatus.ACTIVE,
      });
    },

    async handleSubscriptionUpdated(payload) {
      const record = asRecord(payload, "subscription.updated");
      const subscriptionId = requireString(record.subscriptionId, "subscriptionId", "subscription.updated");
      const status = record.status;
      if (!isSubscriptionStatus(status)) {
        throw new BillingPortError(`Invalid subscription status in subscription.updated payload`, {
          code: BillingErrorCode.PROVIDER_FAILURE,
        });
      }
      const subscription = requireSubscription(subscriptionId);
      store.subscriptions.set(subscriptionId, { ...subscription, status });
    },

    async handleSubscriptionDeleted(payload) {
      const record = asRecord(payload, "subscription.deleted");
      const subscriptionId = requireString(record.subscriptionId, "subscriptionId", "subscription.deleted");
      requireSubscription(subscriptionId);
      store.subscriptions.delete(subscriptionId);
    },

    async handleInvoicePaymentFailed(payload) {
      const record = asRecord(payload, "invoice.payment_failed");
      const subscriptionId = requireString(record.subscriptionId, "subscriptionId", "invoice.payment_failed");
      const subscription = requireSubscription(subscriptionId);
      store.subscriptions.set(subscriptionId, { ...subscription, status: SubscriptionStatus.PAST_DUE });
    },
  };
}
