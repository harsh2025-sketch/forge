/**
 * AuthWebhookHandler — inbound identity event capability contract.
 * V3 §3.2 (packages/auth/src/webhook-port.ts), §5.2.
 *
 * Payloads are `unknown` by contract: their shape is provider-specific and must
 * be validated inside the adapter, never leaked through the port.
 */

import type { AuthRequestHeaders } from "./types.js";

/** Minimal structural request accepted by webhook verification. */
export interface AuthWebhookRequest {
  readonly headers: AuthRequestHeaders;
  text(): Promise<string>;
}

export interface AuthWebhookHandler {
  /**
   * Verifies the request authenticity and returns the verified payload.
   * Throws `AuthPortError` with code `AUTH_INVALID_WEBHOOK_SIGNATURE` when verification fails.
   */
  verifyWebhookSignature(request: AuthWebhookRequest): Promise<unknown>;

  handleUserCreated(payload: unknown): Promise<void>;

  handleUserUpdated(payload: unknown): Promise<void>;

  handleOrganizationCreated(payload: unknown): Promise<void>;
}
