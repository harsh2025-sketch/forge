/**
 * Mock email adapter — real behavioral in-memory implementation of EmailPort.
 * Validates messages the way a delivery provider would reject them, records
 * everything sent, and issues deterministic message ids. V3 §3.2
 * (packages/testing/src/mocks/), Day 5.
 */

import {
  EmailErrorCode,
  EmailPortError,
  type EmailMessage,
  type EmailPort,
} from "@forge/email";

/** Options for the mock email port. */
export interface MockEmailPortOptions {
  /** When true, the next send attempt fails with EMAIL_SEND_FAILED (once). */
  failNextSend?: boolean;
}

/** An EmailPort plus inspection of what was accepted for delivery. */
export type MockEmailPort = EmailPort & {
  /** All messages accepted for delivery, in send order. */
  sent(): readonly EmailMessage[];
};

function validateMessage(message: EmailMessage): void {
  if (message.html === undefined && message.text === undefined) {
    throw new EmailPortError("Message requires at least one of html or text", {
      code: EmailErrorCode.SEND_FAILED,
    });
  }
  const recipients = Array.isArray(message.to) ? message.to : [message.to];
  if (recipients.length === 0) {
    throw new EmailPortError("Message requires at least one recipient", {
      code: EmailErrorCode.SEND_FAILED,
    });
  }
}

/** Creates an in-memory EmailPort. */
export function createMockEmailPort(options?: MockEmailPortOptions): MockEmailPort {
  const delivered: EmailMessage[] = [];
  let messageSequence = 0;
  let failNextSend = options?.failNextSend ?? false;

  function maybeFail(): void {
    if (failNextSend) {
      failNextSend = false;
      throw new EmailPortError("Simulated delivery failure", {
        code: EmailErrorCode.SEND_FAILED,
      });
    }
  }

  async function send(message: EmailMessage) {
    validateMessage(message);
    maybeFail();
    messageSequence += 1;
    delivered.push(message);
    return { id: `mock_email_${String(messageSequence).padStart(4, "0")}` };
  }

  async function sendBatch(messages: readonly EmailMessage[]) {
    // All-or-nothing: a single invalid message rejects the whole batch.
    for (const message of messages) {
      validateMessage(message);
    }
    const ids: string[] = [];
    for (const message of messages) {
      const result = await send(message);
      ids.push(result.id);
    }
    return { ids };
  }

  return { send, sendBatch, sent: () => delivered };
}
