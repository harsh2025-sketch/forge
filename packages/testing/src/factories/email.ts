/**
 * Email test data factories — deterministic builders for @forge/email types.
 * V3 §3.2 (packages/testing/src/factories/), Day 5.
 */

import type { EmailAddress, EmailMessage } from "@forge/email";

let messageSequence = 0;

/** Builds a valid named mailbox. */
export function makeEmailAddress(overrides?: Partial<EmailAddress>): EmailAddress {
  return {
    email: "sender@example.test",
    name: "Test Sender",
    ...overrides,
  };
}

/**
 * Builds a valid EmailMessage carrying both html and text bodies.
 * Unique subject per call keeps batches distinguishable.
 */
export function makeEmailMessage(overrides?: Partial<EmailMessage>): EmailMessage {
  messageSequence += 1;
  const n = messageSequence;
  return {
    from: makeEmailAddress(),
    to: `recipient-${n}@example.test`,
    subject: `Test message ${n}`,
    html: `<p>Test body ${n}</p>`,
    text: `Test body ${n}`,
    ...overrides,
  };
}
