import { describe, expect, it } from "vitest";
import { BillingErrorCode, BillingPortError, SubscriptionStatus } from "@forge/billing";
import {
  createMockBillingPort,
  createMockBillingStore,
  createMockBillingWebhookHandler,
  makeCreateCustomerParams,
  mockBillingPayloads,
} from "../index.js";
import { makeWebhookRequest } from "./helpers.js";

function setup(secret = "whsec_billing_mock") {
  const store = createMockBillingStore();
  return {
    store,
    port: createMockBillingPort(store),
    webhookHandler: createMockBillingWebhookHandler(store, { secret }),
    secret,
  };
}

describe("createMockBillingPort", () => {
  it("creates customers and echoes contact details", async () => {
    const { port } = setup();
    const params = makeCreateCustomerParams();
    const customer = await port.createCustomer(params);

    expect(customer.id).not.toBe("");
    expect(customer.email).toBe(params.email);
    expect(customer.name).toBe(params.name);
  });

  it("issues distinct session urls for checkout and portal", async () => {
    const { port } = setup();
    const customer = await port.createCustomer(makeCreateCustomerParams());

    const checkout = await port.createCheckoutSession({
      customerId: customer.id,
      priceId: "price_1",
      successUrl: "https://s",
      cancelUrl: "https://c",
    });
    const portal = await port.createBillingPortalSession({ customerId: customer.id, returnUrl: "https://r" });

    expect(checkout.url).not.toBe("");
    expect(portal.url).not.toBe("");
    expect(checkout.url).not.toBe(portal.url);
  });

  it("rejects sessions for unknown customers with BILLING_CUSTOMER_NOT_FOUND", async () => {
    const { port } = setup();
    const checkoutError = await port
      .createCheckoutSession({ customerId: "missing", priceId: "p", successUrl: "s", cancelUrl: "c" })
      .catch((caught: unknown) => caught);
    expect((checkoutError as BillingPortError).code).toBe(BillingErrorCode.CUSTOMER_NOT_FOUND);

    const portalError = await port
      .createBillingPortalSession({ customerId: "missing", returnUrl: "r" })
      .catch((caught: unknown) => caught);
    expect((portalError as BillingPortError).code).toBe(BillingErrorCode.CUSTOMER_NOT_FOUND);
  });

  it("activates subscriptions through the webhook flow and reports usage", async () => {
    const { port, webhookHandler, store } = setup();
    const customer = await port.createCustomer(makeCreateCustomerParams());

    await expect(port.getActiveSubscription(customer.id)).resolves.toBeNull();

    await webhookHandler.handleCheckoutCompleted(
      mockBillingPayloads.checkoutCompleted({
        customerId: customer.id,
        priceId: "price_1",
        subscriptionId: "sub_1",
      })
    );

    const subscription = await port.getActiveSubscription(customer.id);
    expect(subscription).toEqual({
      id: "sub_1",
      customerId: customer.id,
      priceId: "price_1",
      status: SubscriptionStatus.ACTIVE,
    });

    await port.reportUsage({ subscriptionId: "sub_1", meterKey: "scans", quantity: 3 });
    expect(store.usageReports).toEqual([{ subscriptionId: "sub_1", meterKey: "scans", quantity: 3 }]);
  });

  it("cancels subscriptions and rejects unknown ids with BILLING_SUBSCRIPTION_NOT_FOUND", async () => {
    const { port, webhookHandler } = setup();
    const customer = await port.createCustomer(makeCreateCustomerParams());
    await webhookHandler.handleCheckoutCompleted(
      mockBillingPayloads.checkoutCompleted({
        customerId: customer.id,
        priceId: "price_1",
        subscriptionId: "sub_1",
      })
    );

    await port.cancelSubscription("sub_1");
    await expect(port.getActiveSubscription(customer.id)).resolves.toBeNull();

    const error = await port.cancelSubscription("sub_missing").catch((caught: unknown) => caught);
    expect((error as BillingPortError).code).toBe(BillingErrorCode.SUBSCRIPTION_NOT_FOUND);
  });

  it("tracks subscription lifecycle events", async () => {
    const { port, webhookHandler, store } = setup();
    const customer = await port.createCustomer(makeCreateCustomerParams());
    await webhookHandler.handleCheckoutCompleted(
      mockBillingPayloads.checkoutCompleted({
        customerId: customer.id,
        priceId: "price_1",
        subscriptionId: "sub_1",
      })
    );

    await webhookHandler.handleInvoicePaymentFailed(
      mockBillingPayloads.invoicePaymentFailed({ subscriptionId: "sub_1" })
    );
    expect(store.subscriptions.get("sub_1")?.status).toBe(SubscriptionStatus.PAST_DUE);

    await webhookHandler.handleSubscriptionUpdated(
      mockBillingPayloads.subscriptionUpdated({ subscriptionId: "sub_1", status: "active" })
    );
    expect(store.subscriptions.get("sub_1")?.status).toBe(SubscriptionStatus.ACTIVE);

    await webhookHandler.handleSubscriptionDeleted(
      mockBillingPayloads.subscriptionDeleted({ subscriptionId: "sub_1" })
    );
    expect(store.subscriptions.has("sub_1")).toBe(false);
  });
});

describe("createMockBillingWebhookHandler", () => {
  it("verifies signatures and rejects bad ones with BILLING_INVALID_WEBHOOK_SIGNATURE", async () => {
    const { webhookHandler, secret } = setup();
    const payload = mockBillingPayloads.subscriptionDeleted({ subscriptionId: "sub_1" });

    const valid = makeWebhookRequest({ "x-mock-signature": secret }, JSON.stringify(payload));
    await expect(webhookHandler.verifyWebhookSignature(valid)).resolves.toEqual(payload);

    const invalid = makeWebhookRequest({ "x-mock-signature": "nope" }, JSON.stringify(payload));
    const error = await webhookHandler.verifyWebhookSignature(invalid).catch((caught: unknown) => caught);
    expect((error as BillingPortError).code).toBe(BillingErrorCode.INVALID_WEBHOOK_SIGNATURE);
  });

  it("rejects malformed event payloads with BillingPortError", async () => {
    const { webhookHandler } = setup();
    const cases = [
      () => webhookHandler.handleCheckoutCompleted({ customerId: "c", priceId: "p" }),
      () => webhookHandler.handleSubscriptionUpdated({ subscriptionId: "sub_1", status: "bogus" }),
      () => webhookHandler.handleSubscriptionDeleted(null),
      () => webhookHandler.handleInvoicePaymentFailed({}),
    ];
    for (const call of cases) {
      const error = await call().catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(BillingPortError);
    }
  });
});
