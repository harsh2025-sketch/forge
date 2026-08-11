import { describe, expect, it } from "vitest";
import {
  BillingErrorCode,
  BillingPortError,
  type BillingSubscription,
  type SubscriptionStatus,
} from "@forge/billing";
import { runBillingConformance } from "@forge/testing";
import {
  stripeBillingAdapter,
  stripeBillingWebhookHandler,
  type StripeClient,
  type StripeEventLike,
  type StripeSubscriptionLike,
} from "../src/index.js";

const WEBHOOK_SECRET = "whsec_offline";

function missing(param?: string): Error {
  return Object.assign(new Error("No such resource"), {
    code: "resource_missing",
    statusCode: 404,
    ...(param === undefined ? {} : { param }),
  });
}

function subscription(
  id: string,
  customerId: string,
  priceId: string,
  status: SubscriptionStatus = "active",
  currentPeriodEnd = 1_800_000_000
): StripeSubscriptionLike {
  return {
    id,
    customer: customerId,
    status,
    cancel_at_period_end: false,
    items: { data: [{ price: { id: priceId }, current_period_end: currentPeriodEnd }] },
  };
}

class FakeStripeClient implements StripeClient {
  readonly customersById = new Map<string, { id: string; email: string; name?: string }>();
  readonly subscriptionsById = new Map<string, StripeSubscriptionLike>();
  readonly meterEvents: unknown[] = [];
  readonly checkoutRequests: unknown[] = [];
  readonly portalRequests: unknown[] = [];
  customerSequence = 0;

  readonly customers: StripeClient["customers"] = {
    create: async (params) => {
      this.customerSequence += 1;
      const customer = {
        id: `cus_${this.customerSequence}`,
        email: params.email,
        ...(params.name === undefined ? {} : { name: params.name }),
      };
      this.customersById.set(customer.id, customer);
      return customer;
    },
  };

  readonly checkout: StripeClient["checkout"] = {
    sessions: {
      create: async (params) => {
        if (!this.customersById.has(params.customer)) throw missing("customer");
        this.checkoutRequests.push(params);
        return { url: `https://checkout.stripe.test/${params.customer}` };
      },
    },
  };

  readonly billingPortal: StripeClient["billingPortal"] = {
    sessions: {
      create: async (params) => {
        if (!this.customersById.has(params.customer)) throw missing("customer");
        this.portalRequests.push(params);
        return { url: `https://billing.stripe.test/${params.customer}` };
      },
    },
  };

  readonly subscriptions: StripeClient["subscriptions"] = {
    list: async (params) => ({
      data: [...this.subscriptionsById.values()]
        .filter((item) => item.customer === params.customer && item.status === params.status)
        .slice(0, params.limit),
    }),
    retrieve: async (id) => {
      const found = this.subscriptionsById.get(id);
      if (found === undefined) throw missing();
      return found;
    },
    cancel: async (id) => {
      const found = this.subscriptionsById.get(id);
      if (found === undefined) throw missing();
      const canceled = { ...found, status: "canceled" };
      this.subscriptionsById.set(id, canceled);
      return canceled;
    },
  };

  readonly billing: StripeClient["billing"] = {
    meterEvents: {
      create: async (params) => {
        this.meterEvents.push(params);
        return { identifier: `meter_${this.meterEvents.length}` };
      },
    },
  };

  readonly webhooks: StripeClient["webhooks"] = {
    constructEventAsync: async (payload, signature, secret) => {
      if (signature !== `signed:${secret}`) throw new Error("signature mismatch");
      return JSON.parse(payload) as StripeEventLike;
    },
  };
}

let currentClient: FakeStripeClient | undefined;

function requireCurrentClient(): FakeStripeClient {
  if (currentClient === undefined) throw new Error("Conformance pair was not created");
  return currentClient;
}

function event(type: string, object: Record<string, unknown>): StripeEventLike {
  return { type, data: { object } };
}

const payloads = {
  checkoutCompleted({ customerId, priceId, subscriptionId }: {
    customerId: string; priceId: string; subscriptionId: string;
  }) {
    requireCurrentClient().subscriptionsById.set(
      subscriptionId,
      subscription(subscriptionId, customerId, priceId)
    );
    return event("checkout.session.completed", {
      object: "checkout.session",
      id: "cs_conformance",
      customer: customerId,
      subscription: subscriptionId,
    });
  },
  subscriptionUpdated({ subscriptionId, status }: { subscriptionId: string; status: SubscriptionStatus }) {
    const client = requireCurrentClient();
    const previous = client.subscriptionsById.get(subscriptionId);
    if (previous !== undefined) client.subscriptionsById.set(subscriptionId, { ...previous, status });
    return event("customer.subscription.updated", {
      object: "subscription",
      id: subscriptionId,
      customer: previous?.customer ?? "cus_unknown",
      status,
    });
  },
  subscriptionDeleted({ subscriptionId }: { subscriptionId: string }) {
    const client = requireCurrentClient();
    const previous = client.subscriptionsById.get(subscriptionId);
    client.subscriptionsById.delete(subscriptionId);
    return event("customer.subscription.deleted", {
      object: "subscription",
      id: subscriptionId,
      customer: previous?.customer ?? "cus_unknown",
    });
  },
  invoicePaymentFailed({ subscriptionId }: { subscriptionId: string }) {
    const client = requireCurrentClient();
    const previous = client.subscriptionsById.get(subscriptionId);
    if (previous !== undefined) {
      client.subscriptionsById.set(subscriptionId, { ...previous, status: "past_due" });
    }
    return event("invoice.payment_failed", {
      object: "invoice",
      id: "in_conformance",
      parent: {
        type: "subscription_details",
        subscription_details: { subscription: subscriptionId },
      },
    });
  },
};

runBillingConformance({
  fixtures: {
    customer: { email: "billing@example.test", name: "Billing User", metadata: { tenantId: "t_1" } },
    priceId: "price_conformance",
    absentCustomerId: "cus_missing",
    absentSubscriptionId: "sub_missing",
  },
  createConnectedPair() {
    const client = new FakeStripeClient();
    currentClient = client;
    return {
      port: stripeBillingAdapter({ client }),
      webhookHandler: stripeBillingWebhookHandler({ client, webhookSecret: WEBHOOK_SECRET }),
    };
  },
  createValidWebhookRequest(payload) {
    return {
      headers: { get: (name) => name === "stripe-signature" ? `signed:${WEBHOOK_SECRET}` : null },
      text: async () => JSON.stringify(payload),
    };
  },
  createInvalidWebhookRequest(payload) {
    return {
      headers: { get: (name) => name === "stripe-signature" ? "invalid" : null },
      text: async () => JSON.stringify(payload),
    };
  },
  payloads,
});

describe("stripeBillingAdapter", () => {
  it("maps checkout, portal, subscription and current-period fields", async () => {
    const client = new FakeStripeClient();
    const port = stripeBillingAdapter({ client });
    const customer = await port.createCustomer({
      email: "owner@example.test",
      name: "Owner",
      metadata: { accountId: "account_1" },
    });
    await port.createCheckoutSession({
      customerId: customer.id,
      priceId: "price_pro",
      successUrl: "https://app.test/success",
      cancelUrl: "https://app.test/cancel",
    });
    await port.createBillingPortalSession({ customerId: customer.id, returnUrl: "https://app.test" });
    client.subscriptionsById.set("sub_1", subscription("sub_1", customer.id, "price_pro", "trialing"));

    await expect(port.getActiveSubscription(customer.id)).resolves.toEqual({
      id: "sub_1",
      customerId: customer.id,
      priceId: "price_pro",
      status: "trialing",
      currentPeriodEnd: new Date(1_800_000_000 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
    } satisfies BillingSubscription);
    expect(client.checkoutRequests).toEqual([{
      customer: customer.id,
      mode: "subscription",
      line_items: [{ price: "price_pro", quantity: 1 }],
      success_url: "https://app.test/success",
      cancel_url: "https://app.test/cancel",
    }]);
    expect(client.portalRequests).toEqual([{ customer: customer.id, return_url: "https://app.test" }]);
  });

  it("reports Stripe meter events using the subscription customer", async () => {
    const client = new FakeStripeClient();
    client.subscriptionsById.set("sub_1", subscription("sub_1", "cus_1", "price_1"));
    const port = stripeBillingAdapter({ client });
    await port.reportUsage({
      subscriptionId: "sub_1",
      meterKey: "scans",
      quantity: 7,
      occurredAt: "2026-08-11T10:00:00.000Z",
    });

    expect(client.meterEvents).toEqual([{
      event_name: "scans",
      payload: { stripe_customer_id: "cus_1", value: "7" },
      timestamp: Math.floor(Date.parse("2026-08-11T10:00:00.000Z") / 1000),
    }]);
  });

  it("does not misclassify a missing price as a missing customer", async () => {
    const client = new FakeStripeClient();
    client.checkout.sessions.create = async () => { throw missing("line_items[0][price]"); };
    const error = await stripeBillingAdapter({ client }).createCheckoutSession({
      customerId: "cus_1",
      priceId: "price_missing",
      successUrl: "https://app.test/success",
      cancelUrl: "https://app.test/cancel",
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BillingPortError);
    expect((error as BillingPortError).code).toBe(BillingErrorCode.PROVIDER_FAILURE);
  });

  it("maps missing subscriptions and generic provider failures to stable errors", async () => {
    const client = new FakeStripeClient();
    const port = stripeBillingAdapter({ client });
    await expect(port.cancelSubscription("sub_missing")).rejects.toMatchObject({
      code: BillingErrorCode.SUBSCRIPTION_NOT_FOUND,
    });
    const providerError = new Error("Stripe unavailable");
    client.customers.create = async () => { throw providerError; };
    await expect(port.createCustomer({ email: "x@example.test" })).rejects.toMatchObject({
      code: BillingErrorCode.PROVIDER_FAILURE,
      cause: providerError,
    });
  });

  it("rejects missing hosted URLs and invalid usage timestamps as provider failures", async () => {
    const client = new FakeStripeClient();
    client.customersById.set("cus_1", { id: "cus_1", email: "x@example.test" });
    client.checkout.sessions.create = async () => ({ url: null });
    const port = stripeBillingAdapter({ client });
    await expect(port.createCheckoutSession({
      customerId: "cus_1",
      priceId: "price_1",
      successUrl: "https://app.test/success",
      cancelUrl: "https://app.test/cancel",
    })).rejects.toMatchObject({ code: BillingErrorCode.PROVIDER_FAILURE });

    client.subscriptionsById.set("sub_1", subscription("sub_1", "cus_1", "price_1"));
    await expect(port.reportUsage({
      subscriptionId: "sub_1", meterKey: "scans", quantity: 1, occurredAt: "not-a-date",
    })).rejects.toMatchObject({ code: BillingErrorCode.PROVIDER_FAILURE });
    expect(client.meterEvents).toHaveLength(0);
  });
});

describe("stripeBillingWebhookHandler", () => {
  it("rejects a missing signature without invoking Stripe", async () => {
    const client = new FakeStripeClient();
    const handler = stripeBillingWebhookHandler({ client, webhookSecret: WEBHOOK_SECRET });
    await expect(handler.verifyWebhookSignature({
      headers: { get: () => null },
      text: async () => "{}",
    })).rejects.toMatchObject({ code: BillingErrorCode.INVALID_WEBHOOK_SIGNATURE });
  });

  it("validates each handler's Stripe event type and object shape", async () => {
    const handler = stripeBillingWebhookHandler({
      client: new FakeStripeClient(), webhookSecret: WEBHOOK_SECRET,
    });
    await expect(handler.handleCheckoutCompleted(event("customer.created", {
      object: "customer", id: "cus_1",
    }))).rejects.toMatchObject({ code: BillingErrorCode.PROVIDER_FAILURE });
    await expect(handler.handleInvoicePaymentFailed(event("invoice.payment_failed", {
      object: "invoice", id: "in_1", parent: null,
    }))).rejects.toMatchObject({ code: BillingErrorCode.PROVIDER_FAILURE });
  });
});
