/**
 * BillingWebhookHandler — inbound billing event capability contract.
 * V3 §3.2 (packages/billing/src/webhook-port.ts), §5.2.
 *
 * Payloads are `unknown` by contract: their shape is provider-specific and must
 * be validated inside the adapter, never leaked through the port.
 */

import type { BillingRequestHeaders } from "./types.js";

/** Minimal structural request accepted by webhook verification. */
export interface BillingWebhookRequest {
  readonly headers: BillingRequestHeaders;
  text(): Promise<string>;
}

export interface BillingWebhookHandler {
  /**
   * Verifies the request authenticity and returns the verified payload.
   * Throws `BillingPortError` with code `BILLING_INVALID_WEBHOOK_SIGNATURE` when verification fails.
   */
  verifyWebhookSignature(request: BillingWebhookRequest): Promise<unknown>;

  handleCheckoutCompleted(payload: unknown): Promise<void>;

  handleSubscriptionUpdated(payload: unknown): Promise<void>;

  handleSubscriptionDeleted(payload: unknown): Promise<void>;

  handleInvoicePaymentFailed(payload: unknown): Promise<void>;
}
