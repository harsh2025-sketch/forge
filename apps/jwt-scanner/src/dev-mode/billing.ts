/**
 * JWT Scanner deterministic test-mode seam — billing (BILLING_MODE=test).
 *
 * A product-local in-memory implementation of the existing BillingPort and
 * BillingWebhookHandler contracts used ONLY for deterministic local/test
 * application runs. It mirrors the behavior of the @forge/testing mock
 * billing adapter (the canonical implementation for the test suite) with the
 * same provider-neutral contract: customers, checkout sessions, portal
 * sessions, subscriptions and usage reports live in an in-memory store.
 *
 * Live mode always uses the Stripe adapter (src/providers.ts); swapping the
 * billing provider never touches feature, domain, database or report code.
 */

import { BillingErrorCode, BillingPortError, SubscriptionStatus } from "@forge/billing";
import type {
  BillingCustomer,
  BillingPort,
  BillingSession,
  BillingSubscription,
  BillingWebhookHandler,
  CreateCheckoutParams,
  CreateCustomerParams,
  CustomerId,
  ReportUsageParams,
  SubscriptionId,
} from "@forge/billing";

export interface DevBillingStore {
  readonly customers: Map<CustomerId, BillingCustomer>;
  readonly subscriptions: Map<SubscriptionId, BillingSubscription>;
  readonly usageReports: Array<{ subscriptionId: SubscriptionId; meterKey: string; quantity: number }>;
}

export function createDevBillingStore(): DevBillingStore {
  return { customers: new Map(), subscriptions: new Map(), usageReports: [] };
}

export function createDevBillingPort(store: DevBillingStore = createDevBillingStore()): BillingPort {
  let customerSequence = 0;
  let sessionSequence = 0;

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

  return {
    async createCustomer(params: CreateCustomerParams): Promise<BillingCustomer> {
      customerSequence += 1;
      const customer: BillingCustomer = {
        id: `dev_customer_${String(customerSequence).padStart(4, "0")}`,
        email: params.email,
        name: params.name,
      };
      store.customers.set(customer.id, customer);
      return customer;
    },

    async createCheckoutSession(params: CreateCheckoutParams): Promise<BillingSession> {
      requireCustomer(params.customerId);
      sessionSequence += 1;
      return {
        url: `https://checkout.dev/session_${String(sessionSequence).padStart(4, "0")}?customer=${encodeURIComponent(params.customerId)}&price=${encodeURIComponent(params.priceId)}`,
      };
    },

    async createBillingPortalSession(params: {
      customerId: CustomerId;
      returnUrl: string;
    }): Promise<BillingSession> {
      requireCustomer(params.customerId);
      sessionSequence += 1;
      return {
        url: `https://billing.dev/session_${String(sessionSequence).padStart(4, "0")}?customer=${encodeURIComponent(params.customerId)}`,
      };
    },

    async getActiveSubscription(customerId: CustomerId): Promise<BillingSubscription | null> {
      for (const subscription of store.subscriptions.values()) {
        if (
          subscription.customerId === customerId &&
          (subscription.status === SubscriptionStatus.ACTIVE ||
            subscription.status === SubscriptionStatus.TRIALING)
        ) {
          return subscription;
        }
      }
      return null;
    },

    async cancelSubscription(subscriptionId: SubscriptionId): Promise<void> {
      const subscription = store.subscriptions.get(subscriptionId);
      if (subscription === undefined) {
        throw new BillingPortError(`Subscription not found: ${subscriptionId}`, {
          code: BillingErrorCode.SUBSCRIPTION_NOT_FOUND,
          details: { subscriptionId },
        });
      }
      store.subscriptions.set(subscriptionId, { ...subscription, status: SubscriptionStatus.CANCELED });
    },

    async reportUsage(params: ReportUsageParams): Promise<void> {
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
    },
  };
}

/** Provider-shaped payloads accepted by the dev-mode billing webhook handler. */
export const devBillingPayloads = {
  checkoutCompleted(params: { customerId: CustomerId; priceId: string; subscriptionId: SubscriptionId }): unknown {
    return { type: "dev.checkout_completed", ...params };
  },
} as const;

/** Creates the dev-mode BillingWebhookHandler (signature: `x-dev-signature`). */
export function createDevBillingWebhookHandler(
  store: DevBillingStore = createDevBillingStore(),
  options: { readonly secret?: string } = {},
): BillingWebhookHandler {
  const secret = options.secret ?? "dev_billing_secret";

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

  return {
    async verifyWebhookSignature(request) {
      const signature = request.headers.get("x-dev-signature");
      if (signature === null || signature !== secret) {
        throw new BillingPortError("Invalid webhook signature", {
          code: BillingErrorCode.INVALID_WEBHOOK_SIGNATURE,
        });
      }
      const body = await request.text();
      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        throw new BillingPortError("Webhook body is not valid JSON", {
          code: BillingErrorCode.INVALID_WEBHOOK_SIGNATURE,
        });
      }
      return payload;
    },

    async handleCheckoutCompleted(payload) {
      const record = asRecord(payload, "checkout_completed");
      const customerId = requireString(record.customerId, "customerId", "checkout_completed");
      const priceId = requireString(record.priceId, "priceId", "checkout_completed");
      const subscriptionId = requireString(record.subscriptionId, "subscriptionId", "checkout_completed");
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

    async handleSubscriptionUpdated() {
      return undefined;
    },
    async handleSubscriptionDeleted() {
      return undefined;
    },
    async handleInvoicePaymentFailed() {
      return undefined;
    },
  };
}
