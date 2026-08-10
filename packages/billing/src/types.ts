/**
 * @forge/billing types — provider-neutral billing, subscription and entitlement types.
 * V3 §3.2 (packages/billing/src/types.ts), §5.2 (BillingPort contract), P21.
 *
 * Identifiers are generic (customerId, subscriptionId, priceId, planId).
 * No provider-specific identifier, object or error type may appear here.
 */

import { AppError, type AppErrorOptions } from "@forge/shared";

/** Opaque, provider-neutral identifier of a billing customer. */
export type CustomerId = string;

/** Opaque, provider-neutral identifier of a subscription. */
export type SubscriptionId = string;

/** Opaque, provider-neutral identifier of a purchasable price. */
export type PriceId = string;

/** Opaque, provider-neutral identifier of a plan offered by the product. */
export type PlanId = string;

/** ISO-8601 timestamp. Strings keep the contract serialization-safe. */
export type BillingTimestamp = string;

/** Lifecycle of a subscription, expressed in provider-neutral terms. */
export const SubscriptionStatus = {
  TRIALING: "trialing",
  ACTIVE: "active",
  PAST_DUE: "past_due",
  CANCELED: "canceled",
} as const;

export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const SUBSCRIPTION_STATUS_VALUES = Object.values(
  SubscriptionStatus
) as readonly SubscriptionStatus[];

/** Type guard — exact, case-sensitive. */
export function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return (
    typeof value === "string" && (SUBSCRIPTION_STATUS_VALUES as readonly string[]).includes(value)
  );
}

/** Returns true when the status grants access to paid capability. */
export function isActiveSubscriptionStatus(status: SubscriptionStatus): boolean {
  return status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.TRIALING;
}

export interface BillingCustomer {
  readonly id: CustomerId;
  readonly email: string;
  readonly name?: string;
}

export interface CreateCustomerParams {
  readonly email: string;
  readonly name?: string;
  /** Neutral key/value pairs used to map the customer back to a platform entity. */
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface BillingSubscription {
  readonly id: SubscriptionId;
  readonly customerId: CustomerId;
  readonly priceId: PriceId;
  readonly status: SubscriptionStatus;
  readonly currentPeriodEnd?: BillingTimestamp;
  readonly cancelAtPeriodEnd?: boolean;
}

/** A capability grant carried by a plan. */
export interface Entitlement {
  readonly key: string;
  /** Maximum permitted usage. `null` means unlimited. */
  readonly limit: number | null;
}

/** A plan offered by the product, mapped to a provider price by the adapter. */
export interface Plan {
  readonly id: PlanId;
  readonly name: string;
  readonly priceId: PriceId;
  readonly entitlements: readonly Entitlement[];
}

export interface CreateCheckoutParams {
  readonly customerId: CustomerId;
  readonly priceId: PriceId;
  readonly successUrl: string;
  readonly cancelUrl: string;
}

export interface BillingPortalParams {
  readonly customerId: CustomerId;
  readonly returnUrl: string;
}

/** A hosted session the application redirects the customer to. */
export interface BillingSession {
  readonly url: string;
}

export interface ReportUsageParams {
  readonly subscriptionId: SubscriptionId;
  /** Neutral meter key the product measures (matches an entitlement key). */
  readonly meterKey: string;
  readonly quantity: number;
  readonly occurredAt?: BillingTimestamp;
}

/**
 * Inbound billing events the application must handle.
 * One value per handler declared by `BillingWebhookHandler`.
 */
export const BillingEventType = {
  CHECKOUT_COMPLETED: "checkout.completed",
  SUBSCRIPTION_UPDATED: "subscription.updated",
  SUBSCRIPTION_DELETED: "subscription.deleted",
  INVOICE_PAYMENT_FAILED: "invoice.payment_failed",
} as const;

export type BillingEventType = (typeof BillingEventType)[keyof typeof BillingEventType];

/**
 * Minimal structural header reader.
 *
 * V3 §5.2 types webhook verification with a web-platform request object. A port
 * may not depend on a web framework or DOM lib types, so the contract is
 * structural: any WHATWG-style `Headers` value satisfies it.
 */
export interface BillingRequestHeaders {
  get(name: string): string | null;
}

/** Stable, provider-neutral failure codes for billing operations. */
export const BillingErrorCode = {
  CUSTOMER_NOT_FOUND: "BILLING_CUSTOMER_NOT_FOUND",
  SUBSCRIPTION_NOT_FOUND: "BILLING_SUBSCRIPTION_NOT_FOUND",
  INVALID_WEBHOOK_SIGNATURE: "BILLING_INVALID_WEBHOOK_SIGNATURE",
  PROVIDER_FAILURE: "BILLING_PROVIDER_FAILURE",
} as const;

export type BillingErrorCode = (typeof BillingErrorCode)[keyof typeof BillingErrorCode];

export interface BillingPortErrorOptions extends Omit<AppErrorOptions, "code"> {
  readonly code?: BillingErrorCode;
}

/**
 * Error raised by billing port implementations.
 *
 * Adapters translate provider failures into this type so callers never depend
 * on a provider's error shape.
 */
export class BillingPortError extends AppError {
  constructor(message: string, options?: BillingPortErrorOptions) {
    super(message, {
      code: options?.code ?? BillingErrorCode.PROVIDER_FAILURE,
      details: options?.details,
      cause: options?.cause,
    });
  }
}
