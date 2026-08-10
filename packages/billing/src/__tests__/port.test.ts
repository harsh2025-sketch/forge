import { describe, it, expect } from "vitest";
import { AppError } from "@forge/shared";
import * as billingPackage from "../index.js";
import {
  BillingErrorCode,
  BillingEventType,
  BillingPortError,
  SubscriptionStatus,
  findEntitlement,
  getEntitlementLimit,
  hasEntitlement,
  isActiveSubscriptionStatus,
  isSubscriptionStatus,
  isWithinEntitlementLimit,
  type BillingCustomer,
  type BillingSubscription,
  type Entitlement,
  type Plan,
} from "../index.js";
import type { BillingPort } from "../index.js";
import type { BillingWebhookHandler, BillingWebhookRequest } from "../index.js";

const customer: BillingCustomer = { id: "cus_1", email: "billing@example.com", name: "Acme" };

const subscription: BillingSubscription = {
  id: "sub_1",
  customerId: "cus_1",
  priceId: "price_1",
  status: SubscriptionStatus.ACTIVE,
  currentPeriodEnd: "2026-01-01T00:00:00.000Z",
  cancelAtPeriodEnd: false,
};

/** A dummy in-memory provider proving the port is implementable without a vendor. */
function createDummyBillingProvider(): BillingPort & {
  readonly usage: { subscriptionId: string; meterKey: string; quantity: number }[];
} {
  const subscriptions = new Map<string, BillingSubscription>([[subscription.id, subscription]]);
  const usage: { subscriptionId: string; meterKey: string; quantity: number }[] = [];

  return {
    usage,
    async createCustomer(params) {
      return { id: "cus_1", email: params.email, name: params.name };
    },
    async createCheckoutSession(params) {
      return { url: `https://checkout.test/${params.priceId}` };
    },
    async createBillingPortalSession(params) {
      return { url: `https://portal.test/${params.customerId}` };
    },
    async getActiveSubscription(customerId) {
      const found = [...subscriptions.values()].find(
        (candidate) =>
          candidate.customerId === customerId && isActiveSubscriptionStatus(candidate.status)
      );
      return found ?? null;
    },
    async cancelSubscription(subscriptionId) {
      if (!subscriptions.has(subscriptionId)) {
        throw new BillingPortError(`Subscription not found: ${subscriptionId}`, {
          code: BillingErrorCode.SUBSCRIPTION_NOT_FOUND,
        });
      }
      subscriptions.delete(subscriptionId);
    },
    async reportUsage(params) {
      usage.push({
        subscriptionId: params.subscriptionId,
        meterKey: params.meterKey,
        quantity: params.quantity,
      });
    },
  };
}

describe("BillingPort contract", () => {
  it("is implementable by a dummy provider", async () => {
    const provider = createDummyBillingProvider();

    await expect(
      provider.createCustomer({ email: "billing@example.com", name: "Acme" })
    ).resolves.toEqual(customer);
    await expect(
      provider.createCheckoutSession({
        customerId: "cus_1",
        priceId: "price_1",
        successUrl: "https://app.test/success",
        cancelUrl: "https://app.test/cancel",
      })
    ).resolves.toEqual({ url: "https://checkout.test/price_1" });
    await expect(
      provider.createBillingPortalSession({ customerId: "cus_1", returnUrl: "https://app.test" })
    ).resolves.toEqual({ url: "https://portal.test/cus_1" });
    await expect(provider.getActiveSubscription("cus_1")).resolves.toEqual(subscription);
  });

  it("resolves null when the customer has no active subscription", async () => {
    const provider = createDummyBillingProvider();
    await expect(provider.getActiveSubscription("cus_unknown")).resolves.toBeNull();
  });

  it("records metered usage through provider-neutral params", async () => {
    const provider = createDummyBillingProvider();

    await provider.reportUsage({ subscriptionId: "sub_1", meterKey: "scans", quantity: 3 });

    expect(provider.usage).toEqual([{ subscriptionId: "sub_1", meterKey: "scans", quantity: 3 }]);
  });

  it("cancelSubscription throws BillingPortError for an unknown subscription", async () => {
    const provider = createDummyBillingProvider();

    await provider.cancelSubscription("sub_1");
    const error = await provider.cancelSubscription("sub_1").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BillingPortError);
    expect((error as BillingPortError).code).toBe(BillingErrorCode.SUBSCRIPTION_NOT_FOUND);
  });
});

describe("BillingWebhookHandler contract", () => {
  it("is implementable and keeps payloads opaque", async () => {
    const handled: string[] = [];
    const handler: BillingWebhookHandler = {
      async verifyWebhookSignature(request) {
        if (request.headers.get("x-signature") !== "valid") {
          throw new BillingPortError("Invalid webhook signature", {
            code: BillingErrorCode.INVALID_WEBHOOK_SIGNATURE,
          });
        }
        return JSON.parse(await request.text()) as unknown;
      },
      async handleCheckoutCompleted() {
        handled.push(BillingEventType.CHECKOUT_COMPLETED);
      },
      async handleSubscriptionUpdated() {
        handled.push(BillingEventType.SUBSCRIPTION_UPDATED);
      },
      async handleSubscriptionDeleted() {
        handled.push(BillingEventType.SUBSCRIPTION_DELETED);
      },
      async handleInvoicePaymentFailed() {
        handled.push(BillingEventType.INVOICE_PAYMENT_FAILED);
      },
    };

    const request: BillingWebhookRequest = {
      headers: { get: (name) => (name === "x-signature" ? "valid" : null) },
      text: async () => JSON.stringify({ type: "checkout.completed" }),
    };

    await expect(handler.verifyWebhookSignature(request)).resolves.toEqual({
      type: "checkout.completed",
    });

    await handler.handleCheckoutCompleted({});
    await handler.handleSubscriptionUpdated({});
    await handler.handleSubscriptionDeleted({});
    await handler.handleInvoicePaymentFailed({});
    expect(handled).toEqual([
      "checkout.completed",
      "subscription.updated",
      "subscription.deleted",
      "invoice.payment_failed",
    ]);

    const invalid: BillingWebhookRequest = { headers: { get: () => null }, text: async () => "{}" };
    const error = await handler.verifyWebhookSignature(invalid).catch((caught: unknown) => caught);
    expect((error as BillingPortError).code).toBe(BillingErrorCode.INVALID_WEBHOOK_SIGNATURE);
  });
});

describe("subscription status", () => {
  it("recognises only neutral status values", () => {
    expect(isSubscriptionStatus("active")).toBe(true);
    expect(isSubscriptionStatus("trialing")).toBe(true);
    expect(isSubscriptionStatus("ACTIVE")).toBe(false);
    expect(isSubscriptionStatus("unknown")).toBe(false);
    expect(isSubscriptionStatus(undefined)).toBe(false);
  });

  it("treats active and trialing as paid access", () => {
    expect(isActiveSubscriptionStatus(SubscriptionStatus.ACTIVE)).toBe(true);
    expect(isActiveSubscriptionStatus(SubscriptionStatus.TRIALING)).toBe(true);
    expect(isActiveSubscriptionStatus(SubscriptionStatus.PAST_DUE)).toBe(false);
    expect(isActiveSubscriptionStatus(SubscriptionStatus.CANCELED)).toBe(false);
  });
});

describe("entitlements", () => {
  const entitlements: readonly Entitlement[] = [
    { key: "scans", limit: 100 },
    { key: "seats", limit: null },
  ];

  const plan: Plan = { id: "pro", name: "Pro", priceId: "price_1", entitlements };

  it("finds granted entitlements", () => {
    expect(findEntitlement(plan.entitlements, "scans")).toEqual({ key: "scans", limit: 100 });
    expect(findEntitlement(plan.entitlements, "missing")).toBeUndefined();
    expect(hasEntitlement(plan.entitlements, "seats")).toBe(true);
    expect(hasEntitlement(plan.entitlements, "missing")).toBe(false);
  });

  it("reports limits with null meaning unlimited", () => {
    expect(getEntitlementLimit(entitlements, "scans")).toBe(100);
    expect(getEntitlementLimit(entitlements, "seats")).toBeNull();
    expect(getEntitlementLimit(entitlements, "missing")).toBeNull();
  });

  it("enforces limits", () => {
    expect(isWithinEntitlementLimit(entitlements, "scans", 99)).toBe(true);
    expect(isWithinEntitlementLimit(entitlements, "scans", 100)).toBe(false);
    expect(isWithinEntitlementLimit(entitlements, "seats", 10_000)).toBe(true);
    expect(isWithinEntitlementLimit(entitlements, "missing", 0)).toBe(false);
  });
});

describe("BillingPortError", () => {
  it("extends AppError and defaults to PROVIDER_FAILURE", () => {
    const error = new BillingPortError("provider unavailable");

    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe("BillingPortError");
    expect(error.code).toBe(BillingErrorCode.PROVIDER_FAILURE);
  });

  it("carries a neutral code, details and cause", () => {
    const cause = new Error("timeout");
    const error = new BillingPortError("customer missing", {
      code: BillingErrorCode.CUSTOMER_NOT_FOUND,
      details: { customerId: "cus_x" },
      cause,
    });

    expect(error.code).toBe("BILLING_CUSTOMER_NOT_FOUND");
    expect(error.details).toEqual({ customerId: "cus_x" });
    expect(error.cause).toBe(cause);
  });
});

describe("package exports", () => {
  it("exposes exactly the runtime exports of the port", () => {
    expect(Object.keys(billingPackage).sort()).toEqual([
      "BillingErrorCode",
      "BillingEventType",
      "BillingPortError",
      "SUBSCRIPTION_STATUS_VALUES",
      "SubscriptionStatus",
      "findEntitlement",
      "getEntitlementLimit",
      "hasEntitlement",
      "isActiveSubscriptionStatus",
      "isSubscriptionStatus",
      "isWithinEntitlementLimit",
    ]);
  });

  it("exposes provider-neutral event types", () => {
    expect(Object.values(BillingEventType)).toEqual([
      "checkout.completed",
      "subscription.updated",
      "subscription.deleted",
      "invoice.payment_failed",
    ]);
  });
});
