/** Stripe signature verification and billing-event validation. */

import { BillingErrorCode, BillingPortError } from "@forge/billing";
import type { BillingWebhookHandler } from "@forge/billing";

export interface StripeEventLike {
  readonly type: string;
  readonly data: { readonly object: unknown };
}

/** Structural Stripe webhook API used for dependency injection. */
export interface StripeWebhookClient {
  readonly webhooks: {
    constructEventAsync(
      payload: string,
      signature: string,
      secret: string
    ): Promise<StripeEventLike>;
  };
}

export interface CreateStripeBillingWebhookHandlerOptions {
  readonly client: StripeWebhookClient;
  readonly webhookSecret: string;
}

function providerFailure(message: string, cause?: unknown): BillingPortError {
  return new BillingPortError(message, {
    code: BillingErrorCode.PROVIDER_FAILURE,
    ...(cause === undefined ? {} : { cause }),
  });
}

function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw providerFailure(`Invalid Stripe ${context} payload`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string, context: string): string {
  if (typeof value !== "string" || value === "") {
    throw providerFailure(`Invalid Stripe ${context} payload: missing ${field}`);
  }
  return value;
}

function relationId(value: unknown, field: string, context: string): string {
  if (typeof value === "string") return requiredString(value, field, context);
  const relation = asRecord(value, context);
  return requiredString(relation.id, field, context);
}

function eventObject(payload: unknown, expectedType: string, expectedObject: string): Record<string, unknown> {
  const event = asRecord(payload, expectedType);
  if (event.type !== expectedType) {
    throw providerFailure(`Expected Stripe ${expectedType} event`);
  }
  const data = asRecord(event.data, expectedType);
  const object = asRecord(data.object, expectedType);
  if (object.object !== expectedObject) {
    throw providerFailure(`Stripe ${expectedType} event has an invalid object`);
  }
  return object;
}

/**
 * Builds the Stripe BillingWebhookHandler.
 *
 * Stripe remains the source of truth for billing state. Event handlers validate
 * and map each supported provider event shape; application-specific persistence
 * is intentionally outside this adapter and outside the provider-neutral port.
 */
export function stripeBillingWebhookHandler(
  options: CreateStripeBillingWebhookHandlerOptions
): BillingWebhookHandler {
  return {
    async verifyWebhookSignature(request) {
      const signature = request.headers.get("stripe-signature");
      if (signature === null || signature === "") {
        throw new BillingPortError("Missing Stripe webhook signature", {
          code: BillingErrorCode.INVALID_WEBHOOK_SIGNATURE,
        });
      }

      let body: string;
      try {
        body = await request.text();
        return await options.client.webhooks.constructEventAsync(
          body,
          signature,
          options.webhookSecret
        );
      } catch (error) {
        if (
          error instanceof BillingPortError &&
          error.code === BillingErrorCode.INVALID_WEBHOOK_SIGNATURE
        ) {
          throw error;
        }
        throw new BillingPortError("Invalid Stripe webhook signature", {
          code: BillingErrorCode.INVALID_WEBHOOK_SIGNATURE,
          cause: error,
        });
      }
    },

    async handleCheckoutCompleted(payload) {
      const session = eventObject(payload, "checkout.session.completed", "checkout.session");
      relationId(session.customer, "customer", "checkout.session.completed");
      relationId(session.subscription, "subscription", "checkout.session.completed");
    },

    async handleSubscriptionUpdated(payload) {
      const subscription = eventObject(
        payload,
        "customer.subscription.updated",
        "subscription"
      );
      requiredString(subscription.id, "id", "customer.subscription.updated");
      relationId(subscription.customer, "customer", "customer.subscription.updated");
      requiredString(subscription.status, "status", "customer.subscription.updated");
    },

    async handleSubscriptionDeleted(payload) {
      const subscription = eventObject(
        payload,
        "customer.subscription.deleted",
        "subscription"
      );
      requiredString(subscription.id, "id", "customer.subscription.deleted");
      relationId(subscription.customer, "customer", "customer.subscription.deleted");
    },

    async handleInvoicePaymentFailed(payload) {
      const invoice = eventObject(payload, "invoice.payment_failed", "invoice");
      const parent = asRecord(invoice.parent, "invoice.payment_failed");
      const details = asRecord(parent.subscription_details, "invoice.payment_failed");
      relationId(details.subscription, "subscription", "invoice.payment_failed");
    },
  };
}
