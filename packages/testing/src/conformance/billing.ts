/**
 * Billing conformance suite — proves any BillingPort + BillingWebhookHandler
 * pair satisfies the @forge/billing contract, including the webhook-driven
 * subscription lifecycle. V3 §12.4, §5.2, P12.
 */

import { describe, expect, it } from "vitest";
import { isAppError } from "@forge/shared";
import {
  BillingErrorCode,
  BillingPortError,
  isActiveSubscriptionStatus,
  type BillingPort,
  type BillingWebhookHandler,
  type BillingWebhookRequest,
  type CreateCustomerParams,
  type CustomerId,
  type PriceId,
  type SubscriptionId,
  type SubscriptionStatus,
} from "@forge/billing";

/** Seeded inputs the billing conformance run promises. */
export interface BillingConformanceFixtures {
  /** Parameters used to create the conformance customer. */
  readonly customer: CreateCustomerParams;
  /** A price the conformance checkout can purchase. */
  readonly priceId: PriceId;
  /** A customer id guaranteed not to exist. */
  readonly absentCustomerId: CustomerId;
  /** A subscription id guaranteed not to exist. */
  readonly absentSubscriptionId: SubscriptionId;
}

/** Provider-shaped webhook payloads built by the harness under test. */
export interface BillingConformancePayloads {
  checkoutCompleted(params: {
    customerId: CustomerId;
    priceId: PriceId;
    subscriptionId: SubscriptionId;
  }): unknown;
  subscriptionUpdated(params: {
    subscriptionId: SubscriptionId;
    status: SubscriptionStatus;
  }): unknown;
  subscriptionDeleted(params: { subscriptionId: SubscriptionId }): unknown;
  invoicePaymentFailed(params: { subscriptionId: SubscriptionId }): unknown;
}

/**
 * Produces a BillingPort/BillingWebhookHandler implementation.
 * `createConnectedPair()` must return a port and webhook handler that share
 * backing state, so subscriptions created through webhook events are visible
 * to the port — exactly as with a real provider.
 */
export interface BillingConformanceHarness {
  readonly fixtures: BillingConformanceFixtures;
  createConnectedPair(): { port: BillingPort; webhookHandler: BillingWebhookHandler };
  /** A webhook request whose signature verifies and whose body is `payload`. */
  createValidWebhookRequest(payload: unknown): BillingWebhookRequest;
  /** A webhook request whose body is `payload` but whose signature is wrong. */
  createInvalidWebhookRequest(payload: unknown): BillingWebhookRequest;
  readonly payloads: BillingConformancePayloads;
}

/** Registers the Billing conformance suite against the harness. */
export function runBillingConformance(harness: BillingConformanceHarness): void {
  const { fixtures } = harness;

  describe("Billing conformance", () => {
    it("createCustomer resolves a customer echoing the contact details", async () => {
      const { port } = harness.createConnectedPair();
      const customer = await port.createCustomer(fixtures.customer);

      expect(customer.id).not.toBe("");
      expect(customer.email).toBe(fixtures.customer.email);
      if (fixtures.customer.name !== undefined) {
        expect(customer.name).toBe(fixtures.customer.name);
      }
    });

    it("createCheckoutSession resolves a hosted session url", async () => {
      const { port } = harness.createConnectedPair();
      const customer = await port.createCustomer(fixtures.customer);
      const session = await port.createCheckoutSession({
        customerId: customer.id,
        priceId: fixtures.priceId,
        successUrl: "https://app.example.test/success",
        cancelUrl: "https://app.example.test/cancel",
      });

      expect(session.url).not.toBe("");
    });

    it("createCheckoutSession rejects an unknown customer with BILLING_CUSTOMER_NOT_FOUND", async () => {
      const { port } = harness.createConnectedPair();
      const error = await port
        .createCheckoutSession({
          customerId: fixtures.absentCustomerId,
          priceId: fixtures.priceId,
          successUrl: "https://app.example.test/success",
          cancelUrl: "https://app.example.test/cancel",
        })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(BillingPortError);
      expect(isAppError(error)).toBe(true);
      expect((error as BillingPortError).code).toBe(BillingErrorCode.CUSTOMER_NOT_FOUND);
    });

    it("createBillingPortalSession resolves a hosted session url for a known customer", async () => {
      const { port } = harness.createConnectedPair();
      const customer = await port.createCustomer(fixtures.customer);
      const session = await port.createBillingPortalSession({
        customerId: customer.id,
        returnUrl: "https://app.example.test/billing",
      });

      expect(session.url).not.toBe("");
    });

    it("createBillingPortalSession rejects an unknown customer with BILLING_CUSTOMER_NOT_FOUND", async () => {
      const { port } = harness.createConnectedPair();
      const error = await port
        .createBillingPortalSession({
          customerId: fixtures.absentCustomerId,
          returnUrl: "https://app.example.test/billing",
        })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(BillingPortError);
      expect((error as BillingPortError).code).toBe(BillingErrorCode.CUSTOMER_NOT_FOUND);
    });

    it("getActiveSubscription resolves null before any checkout completes", async () => {
      const { port } = harness.createConnectedPair();
      const customer = await port.createCustomer(fixtures.customer);
      await expect(port.getActiveSubscription(customer.id)).resolves.toBeNull();
    });

    it("checkout flow: webhook completion activates a subscription visible to the port", async () => {
      const { port, webhookHandler } = harness.createConnectedPair();
      const customer = await port.createCustomer(fixtures.customer);
      const subscriptionId = "sub_conformance_0001";

      await webhookHandler.handleCheckoutCompleted(
        harness.payloads.checkoutCompleted({
          customerId: customer.id,
          priceId: fixtures.priceId,
          subscriptionId,
        })
      );

      const subscription = await port.getActiveSubscription(customer.id);
      expect(subscription).not.toBeNull();
      expect(subscription?.id).toBe(subscriptionId);
      expect(subscription?.customerId).toBe(customer.id);
      expect(subscription?.priceId).toBe(fixtures.priceId);
      expect(isActiveSubscriptionStatus(subscription!.status)).toBe(true);
    });

    it("subscription updates change what getActiveSubscription reports", async () => {
      const { port, webhookHandler } = harness.createConnectedPair();
      const customer = await port.createCustomer(fixtures.customer);
      const subscriptionId = "sub_conformance_0002";

      await webhookHandler.handleCheckoutCompleted(
        harness.payloads.checkoutCompleted({
          customerId: customer.id,
          priceId: fixtures.priceId,
          subscriptionId,
        })
      );
      await webhookHandler.handleSubscriptionUpdated(
        harness.payloads.subscriptionUpdated({ subscriptionId, status: "past_due" })
      );
      await expect(port.getActiveSubscription(customer.id)).resolves.toBeNull();

      await webhookHandler.handleSubscriptionUpdated(
        harness.payloads.subscriptionUpdated({ subscriptionId, status: "active" })
      );
      const subscription = await port.getActiveSubscription(customer.id);
      expect(subscription?.id).toBe(subscriptionId);
    });

    it("cancelSubscription resolves and deactivates the subscription", async () => {
      const { port, webhookHandler } = harness.createConnectedPair();
      const customer = await port.createCustomer(fixtures.customer);
      const subscriptionId = "sub_conformance_0003";

      await webhookHandler.handleCheckoutCompleted(
        harness.payloads.checkoutCompleted({
          customerId: customer.id,
          priceId: fixtures.priceId,
          subscriptionId,
        })
      );
      await expect(port.cancelSubscription(subscriptionId)).resolves.toBeUndefined();
      await expect(port.getActiveSubscription(customer.id)).resolves.toBeNull();
    });

    it("cancelSubscription rejects an unknown subscription with BILLING_SUBSCRIPTION_NOT_FOUND", async () => {
      const { port } = harness.createConnectedPair();
      const error = await port
        .cancelSubscription(fixtures.absentSubscriptionId)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(BillingPortError);
      expect((error as BillingPortError).code).toBe(BillingErrorCode.SUBSCRIPTION_NOT_FOUND);
    });

    it("reportUsage resolves for an active subscription", async () => {
      const { port, webhookHandler } = harness.createConnectedPair();
      const customer = await port.createCustomer(fixtures.customer);
      const subscriptionId = "sub_conformance_0004";

      await webhookHandler.handleCheckoutCompleted(
        harness.payloads.checkoutCompleted({
          customerId: customer.id,
          priceId: fixtures.priceId,
          subscriptionId,
        })
      );
      await expect(
        port.reportUsage({ subscriptionId, meterKey: "scans", quantity: 5 })
      ).resolves.toBeUndefined();
    });

    it("reportUsage rejects an unknown subscription with BILLING_SUBSCRIPTION_NOT_FOUND", async () => {
      const { port } = harness.createConnectedPair();
      const error = await port
        .reportUsage({ subscriptionId: fixtures.absentSubscriptionId, meterKey: "scans", quantity: 1 })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(BillingPortError);
      expect((error as BillingPortError).code).toBe(BillingErrorCode.SUBSCRIPTION_NOT_FOUND);
    });

    it("subscription deletion removes the subscription", async () => {
      const { port, webhookHandler } = harness.createConnectedPair();
      const customer = await port.createCustomer(fixtures.customer);
      const subscriptionId = "sub_conformance_0005";

      await webhookHandler.handleCheckoutCompleted(
        harness.payloads.checkoutCompleted({
          customerId: customer.id,
          priceId: fixtures.priceId,
          subscriptionId,
        })
      );
      await webhookHandler.handleSubscriptionDeleted(
        harness.payloads.subscriptionDeleted({ subscriptionId })
      );
      await expect(port.getActiveSubscription(customer.id)).resolves.toBeNull();
    });

    it("invoice payment failure marks the subscription past due", async () => {
      const { port, webhookHandler } = harness.createConnectedPair();
      const customer = await port.createCustomer(fixtures.customer);
      const subscriptionId = "sub_conformance_0006";

      await webhookHandler.handleCheckoutCompleted(
        harness.payloads.checkoutCompleted({
          customerId: customer.id,
          priceId: fixtures.priceId,
          subscriptionId,
        })
      );
      await webhookHandler.handleInvoicePaymentFailed(
        harness.payloads.invoicePaymentFailed({ subscriptionId })
      );
      await expect(port.getActiveSubscription(customer.id)).resolves.toBeNull();
    });

    it("verifyWebhookSignature resolves a validly signed payload", async () => {
      const { webhookHandler } = harness.createConnectedPair();
      const payload = harness.payloads.subscriptionDeleted({ subscriptionId: "sub_probe" });
      const request = harness.createValidWebhookRequest(payload);
      await expect(webhookHandler.verifyWebhookSignature(request)).resolves.toEqual(payload);
    });

    it("verifyWebhookSignature rejects an invalid signature with BILLING_INVALID_WEBHOOK_SIGNATURE", async () => {
      const { webhookHandler } = harness.createConnectedPair();
      const payload = harness.payloads.subscriptionDeleted({ subscriptionId: "sub_probe" });
      const request = harness.createInvalidWebhookRequest(payload);
      const error = await webhookHandler.verifyWebhookSignature(request).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(BillingPortError);
      expect((error as BillingPortError).code).toBe(BillingErrorCode.INVALID_WEBHOOK_SIGNATURE);
    });
  });
}
