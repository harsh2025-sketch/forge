/**
 * @forge/email types — provider-neutral message types.
 * V3 §3.2 (packages/email/src/types.ts), §5.2 (EmailPort contract), P21.
 *
 * No provider request/response shape may appear here.
 */

import { AppError, type AppErrorOptions } from "@forge/shared";

/** A named mailbox. */
export interface EmailAddress {
  readonly email: string;
  readonly name?: string;
}

/** A mailbox, either as a bare address or as a named mailbox. */
export type EmailRecipient = string | EmailAddress;

/** A message to deliver. At least one of `html` or `text` must be provided. */
export interface EmailMessage {
  readonly from: EmailRecipient;
  readonly to: EmailRecipient | readonly EmailRecipient[];
  readonly subject: string;
  readonly html?: string;
  readonly text?: string;
  readonly cc?: readonly EmailRecipient[];
  readonly bcc?: readonly EmailRecipient[];
  readonly replyTo?: EmailRecipient;
}

/** Identifier assigned to an accepted message by the delivery provider. */
export type EmailMessageId = string;

export interface EmailSendResult {
  readonly id: EmailMessageId;
}

export interface EmailBatchSendResult {
  readonly ids: readonly EmailMessageId[];
}

/** Stable, provider-neutral failure codes for email operations. */
export const EmailErrorCode = {
  /** The provider rejected or failed to accept the message. */
  SEND_FAILED: "EMAIL_SEND_FAILED",
  /** The provider behind the port failed for any other reason. */
  PROVIDER_FAILURE: "EMAIL_PROVIDER_FAILURE",
} as const;

export type EmailErrorCode = (typeof EmailErrorCode)[keyof typeof EmailErrorCode];

export interface EmailPortErrorOptions extends Omit<AppErrorOptions, "code"> {
  readonly code?: EmailErrorCode;
}

/**
 * Error raised by email port implementations.
 *
 * Adapters translate provider failures into this type so callers never depend
 * on a provider's error shape.
 */
export class EmailPortError extends AppError {
  constructor(message: string, options?: EmailPortErrorOptions) {
    super(message, {
      code: options?.code ?? EmailErrorCode.PROVIDER_FAILURE,
      details: options?.details,
      cause: options?.cause,
    });
  }
}
