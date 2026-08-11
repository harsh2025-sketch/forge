/** Resend-backed implementation of the provider-neutral EmailPort. */

import { EmailErrorCode, EmailPortError } from "@forge/email";
import type { EmailMessage, EmailPort, EmailRecipient } from "@forge/email";
import { Resend } from "resend";

interface ResendFailure {
  readonly message?: string;
}

interface ResendResponse<T> {
  readonly data: T | null;
  readonly error: ResendFailure | null;
}

interface ResendEmailPayload {
  readonly from: string;
  readonly to: string | readonly string[];
  readonly subject: string;
  readonly html?: string;
  readonly text?: string;
  readonly cc?: readonly string[];
  readonly bcc?: readonly string[];
  readonly replyTo?: string;
}

/** The small structural slice of Resend used by this adapter. */
export interface ResendClient {
  readonly emails: {
    send(payload: ResendEmailPayload): Promise<ResendResponse<{ readonly id: string }>>;
  };
  readonly batch: {
    send(
      payload: readonly ResendEmailPayload[],
      options: { readonly batchValidation: "strict" }
    ): Promise<ResendResponse<{ readonly data: readonly { readonly id: string }[] }>>;
  };
}

export interface CreateResendEmailAdapterOptions {
  readonly client: ResendClient;
}

/** Creates a production Resend client without reading process environment. */
export function createResendClient(apiKey: string): ResendClient {
  return new Resend(apiKey) as ResendClient;
}

function formatRecipient(recipient: EmailRecipient): string {
  return typeof recipient === "string"
    ? recipient
    : recipient.name === undefined
      ? recipient.email
      : `${recipient.name} <${recipient.email}>`;
}

function formatRecipients(recipients: readonly EmailRecipient[]): string[] {
  return recipients.map(formatRecipient);
}

function toResendPayload(message: EmailMessage): ResendEmailPayload {
  if (message.html === undefined && message.text === undefined) {
    throw new EmailPortError("Email message must include html or text content", {
      code: EmailErrorCode.SEND_FAILED,
    });
  }

  const payload: {
    from: string;
    to: string | readonly string[];
    subject: string;
    html?: string;
    text?: string;
    cc?: readonly string[];
    bcc?: readonly string[];
    replyTo?: string;
  } = {
    from: formatRecipient(message.from),
    to: Array.isArray(message.to)
      ? formatRecipients(message.to)
      : formatRecipient(message.to as EmailRecipient),
    subject: message.subject,
  };

  if (message.html !== undefined) payload.html = message.html;
  if (message.text !== undefined) payload.text = message.text;
  if (message.cc !== undefined) payload.cc = formatRecipients(message.cc);
  if (message.bcc !== undefined) payload.bcc = formatRecipients(message.bcc);
  if (message.replyTo !== undefined) payload.replyTo = formatRecipient(message.replyTo);
  return payload;
}

function sendFailed(message: string, cause?: unknown): EmailPortError {
  return new EmailPortError(message, {
    code: EmailErrorCode.SEND_FAILED,
    ...(cause === undefined ? {} : { cause }),
  });
}

/** Builds the Resend EmailPort adapter around an injected client. */
export function resendEmailAdapter(options: CreateResendEmailAdapterOptions): EmailPort {
  return {
    async send(message) {
      const payload = toResendPayload(message);
      let response: ResendResponse<{ readonly id: string }>;
      try {
        response = await options.client.emails.send(payload);
      } catch (error) {
        throw new EmailPortError("Email provider request failed", {
          code: EmailErrorCode.PROVIDER_FAILURE,
          cause: error,
        });
      }

      if (response.error !== null || response.data === null || response.data.id === "") {
        throw sendFailed(response.error?.message ?? "Email provider did not accept the message");
      }
      return { id: response.data.id };
    },

    async sendBatch(messages) {
      // Resend rejects an empty batch. The neutral contract defines it as an
      // exact no-op and requires no provider call.
      if (messages.length === 0) return { ids: [] };

      // Convert every message before making a request. This preserves
      // all-or-nothing behavior for locally invalid batches.
      const payload = messages.map(toResendPayload);
      let response: ResendResponse<{ readonly data: readonly { readonly id: string }[] }>;
      try {
        response = await options.client.batch.send(payload, { batchValidation: "strict" });
      } catch (error) {
        throw new EmailPortError("Email batch provider request failed", {
          code: EmailErrorCode.PROVIDER_FAILURE,
          cause: error,
        });
      }

      const accepted = response.data?.data;
      if (
        response.error !== null ||
        accepted === undefined ||
        accepted.length !== messages.length ||
        accepted.some((entry) => entry.id === "")
      ) {
        throw sendFailed(response.error?.message ?? "Email provider did not accept the complete batch");
      }
      return { ids: accepted.map((entry) => entry.id) };
    },
  };
}
