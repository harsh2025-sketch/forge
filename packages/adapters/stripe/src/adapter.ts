/** Stripe-backed implementation of the provider-neutral BillingPort. */

import {
  BillingErrorCode,
  BillingPortError,
  SubscriptionStatus,
} from "@forge/billing";
import type {
  BillingCustomer,
  BillingPort,
  BillingSubscription,
  SubscriptionStatus as NeutralSubscriptionStatus,
} from "@forge/billing";
import Stripe from "stripe";
import type { StripeWebhookClient } from "./webhook.js";

export interface StripeCustomerLike {
  readonly id: string;
  readonly email?: string | null;
  readonly name?: string | null;
}

interface StripePriceLike {
  readonly id: string;
}

interface StripeSubscriptionItemLike {
  readonly price: StripePriceLike;
  readonly current_period_end?: number;
}

export interface StripeSubscriptionLike {
  readonly id: string;
  readonly customer: string | { readonly id: string };
  readonly status: string;
  readonly cancel_at_period_end?: boolean;
  readonly items: { readonly data: readonly StripeSubscriptionItemLike[] };
}

interface StripeSessionLike {
  readonly url?: string | null;
}

interface StripeListLike<T> {
  readonly data: readonly T[];
}

/** The structural slice of the Stripe SDK required by this adapter. */
export interface StripeClient extends StripeWebhookClient {
  readonly customers: {
    create(params: {
      readonly email: string;
      readonly name?: string;
      readonly metadata?: Readonly<Record<string, string>>;
    }): Promise<StripeCustomerLike>;
  };
  readonly checkout: {
    readonly sessions: {
      create(params: {
        readonly customer: string;
        readonly mode: "subscription";
        readonly line_items: readonly [{ readonly price: string; readonly quantity: 1 }];
        readonly success_url: string;
        readonly cancel_url: string;
      }): Promise<StripeSessionLike>;
    };
  };
  readonly billingPortal: {
    readonly sessions: {
      create(params: {
        readonly customer: string;
        readonly return_url: string;
      }): Promise<StripeSessionLike>;
    };
  };
  readonly subscriptions: {
    list(params: {
      readonly customer: string;
      readonly status: "active" | "trialing";
      readonly limit: 1;
    }): Promise<StripeListLike<StripeSubscriptionLike>>;
    retrieve(id: string): Promise<StripeSubscriptionLike>;
    cancel(id: string): Promise<StripeSubscriptionLike>;
  };
  readonly billing: {
    readonly meterEvents: {
      create(params: {
        readonly event_name: string;
        readonly payload: Readonly<Record<string, string>>;
        readonly timestamp?: number;
      }): Promise<unknown>;
    };
  };
}

export interface CreateStripeBillingAdapterOptions {
  readonly client: StripeClient;
}

/** Creates a production Stripe client without reading process environment. */
export function createStripeClient(secretKey: string): StripeClient {
  return new Stripe(secretKey) as unknown as StripeClient;
}

interface StripeErrorLike {
  readonly code?: unknown;
  readonly param?: unknown;
  readonly statusCode?: unknown;
  readonly status?: unknown;
}

function stripeError(error: unknown): StripeErrorLike | null {
  return typeof error === "object" && error !== null ? (error as StripeErrorLike) : null;
}

function isMissingResource(error: unknown, expectedParam?: string): boolean {
  const candidate = stripeError(error);
  if (candidate === null) return false;
  const missing =
    candidate.code === "resource_missing" ||
    candidate.statusCode === 404 ||
    candidate.status === 404;
  if (!missing) return false;
  return expectedParam === undefined || candidate.param === undefined || candidate.param === expectedParam;
}

function customerNotFound(customerId: string, cause: unknown): BillingPortError {
  return new BillingPortError(`Customer not found: ${customerId}`, {
    code: BillingErrorCode.CUSTOMER_NOT_FOUND,
    details: { customerId },
    cause,
  });
}

function subscriptionNotFound(subscriptionId: string, cause: unknown): BillingPortError {
  return new BillingPortError(`Subscription not found: ${subscriptionId}`, {
    code: BillingErrorCode.SUBSCRIPTION_NOT_FOUND,
    details: { subscriptionId },
    cause,
  });
}

function providerFailure(message: string, cause?: unknown): BillingPortError {
  return new BillingPortError(message, {
    code: BillingErrorCode.PROVIDER_FAILURE,
    ...(cause === undefined ? {} : { cause }),
  });
}

function mapStatus(status: string): NeutralSubscriptionStatus {
  switch (status) {
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "trialing":
      return SubscriptionStatus.TRIALING;
    case "canceled":
      return SubscriptionStatus.CANCELED;
    case "past_due":
    case "incomplete":
    case "incomplete_expired":
    case "paused":
    case "unpaid":
      return SubscriptionStatus.PAST_DUE;
    default:
      throw providerFailure(`Stripe returned an unsupported subscription status: ${status}`);
  }
}

function relationId(value: string | { readonly id: string }): string {
  return typeof value === "string" ? value : value.id;
}

function mapSubscription(subscription: StripeSubscriptionLike): BillingSubscription {
  const item = subscription.items.data[0];
  if (item === undefined || item.price.id === "") {
    throw providerFailure(`Stripe subscription has no price: ${subscription.id}`);
  }

  const result: {
    id: string;
    customerId: string;
    priceId: string;
    status: NeutralSubscriptionStatus;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
  } = {
    id: subscription.id,
    customerId: relationId(subscription.customer),
    priceId: item.price.id,
    status: mapStatus(subscription.status),
  };
  if (item.current_period_end !== undefined) {
    result.currentPeriodEnd = new Date(item.current_period_end * 1000).toISOString();
  }
  if (subscription.cancel_at_period_end !== undefined) {
    result.cancelAtPeriodEnd = subscription.cancel_at_period_end;
  }
  return result;
}

async function hostedUrl(operation: () => Promise<StripeSessionLike>): Promise<{ url: string }> {
  const session = await operation();
  if (typeof session.url !== "string" || session.url === "") {
    throw providerFailure("Stripe did not return a hosted session URL");
  }
  return { url: session.url };
}

/** Builds the Stripe BillingPort around an injected Stripe client. */
export function stripeBillingAdapter(options: CreateStripeBillingAdapterOptions): BillingPort {
  const { client } = options;

  return {
    async createCustomer(params): Promise<BillingCustomer> {
      try {
        const customer = await client.customers.create({
          email: params.email,
          ...(params.name === undefined ? {} : { name: params.name }),
          ...(params.metadata === undefined ? {} : { metadata: params.metadata }),
        });
        return {
          id: customer.id,
          email: customer.email ?? params.email,
          ...(params.name === undefined && customer.name == null
            ? {}
            : { name: customer.name ?? params.name }),
        };
      } catch (error) {
        if (error instanceof BillingPortError) throw error;
        throw providerFailure("Stripe customer creation failed", error);
      }
    },

    async createCheckoutSession(params) {
      try {
        return await hostedUrl(() =>
          client.checkout.sessions.create({
            customer: params.customerId,
            mode: "subscription",
            line_items: [{ price: params.priceId, quantity: 1 }],
            success_url: params.successUrl,
            cancel_url: params.cancelUrl,
          })
        );
      } catch (error) {
        if (error instanceof BillingPortError) throw error;
        if (isMissingResource(error, "customer")) {
          throw customerNotFound(params.customerId, error);
        }
        throw providerFailure("Stripe checkout session creation failed", error);
      }
    },

    async createBillingPortalSession(params) {
      try {
        return await hostedUrl(() =>
          client.billingPortal.sessions.create({
            customer: params.customerId,
            return_url: params.returnUrl,
          })
        );
      } catch (error) {
        if (error instanceof BillingPortError) throw error;
        if (isMissingResource(error, "customer")) {
          throw customerNotFound(params.customerId, error);
        }
        throw providerFailure("Stripe billing portal session creation failed", error);
      }
    },

    async getActiveSubscription(customerId) {
      try {
        const active = await client.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
        const subscription = active.data[0];
        if (subscription !== undefined) return mapSubscription(subscription);

        const trialing = await client.subscriptions.list({
          customer: customerId,
          status: "trialing",
          limit: 1,
        });
        return trialing.data[0] === undefined ? null : mapSubscription(trialing.data[0]);
      } catch (error) {
        if (error instanceof BillingPortError) throw error;
        throw providerFailure("Stripe subscription lookup failed", error);
      }
    },

    async cancelSubscription(subscriptionId) {
      try {
        await client.subscriptions.cancel(subscriptionId);
      } catch (error) {
        if (isMissingResource(error)) throw subscriptionNotFound(subscriptionId, error);
        throw providerFailure("Stripe subscription cancellation failed", error);
      }
    },

    async reportUsage(params) {
      let subscription: StripeSubscriptionLike;
      try {
        subscription = await client.subscriptions.retrieve(params.subscriptionId);
      } catch (error) {
        if (isMissingResource(error)) throw subscriptionNotFound(params.subscriptionId, error);
        throw providerFailure("Stripe subscription lookup failed while reporting usage", error);
      }

      const timestamp = params.occurredAt === undefined
        ? undefined
        : Math.floor(Date.parse(params.occurredAt) / 1000);
      if (timestamp !== undefined && !Number.isFinite(timestamp)) {
        throw providerFailure("Usage timestamp must be a valid ISO-8601 timestamp");
      }

      try {
        await client.billing.meterEvents.create({
          event_name: params.meterKey,
          payload: {
            stripe_customer_id: relationId(subscription.customer),
            value: String(params.quantity),
          },
          ...(timestamp === undefined ? {} : { timestamp }),
        });
      } catch (error) {
        throw providerFailure("Stripe usage reporting failed", error);
      }
    },
  };
}
