import { describe, it, expect } from "vitest";
import { AppError } from "@forge/shared";
import * as emailPackage from "../index.js";
import { EmailErrorCode, EmailPortError, type EmailAddress, type EmailMessage } from "../index.js";
import type { EmailPort } from "../index.js";

/** A dummy in-memory provider proving the port is implementable without a vendor. */
function createDummyEmailProvider(): EmailPort & { readonly outbox: EmailMessage[] } {
  const outbox: EmailMessage[] = [];
  let counter = 0;

  const accept = (message: EmailMessage): string => {
    if (message.html === undefined && message.text === undefined) {
      throw new EmailPortError("Message has no content", { code: EmailErrorCode.SEND_FAILED });
    }
    outbox.push(message);
    counter += 1;
    return `msg_${counter}`;
  };

  return {
    outbox,
    async send(message) {
      return { id: accept(message) };
    },
    async sendBatch(messages) {
      return { ids: messages.map(accept) };
    },
  };
}

const sender: EmailAddress = { email: "no-reply@example.test", name: "Forge" };

const message: EmailMessage = {
  from: sender,
  to: "user@example.test",
  subject: "Welcome",
  text: "Hello",
};

describe("EmailPort contract", () => {
  it("is implementable by a dummy provider", async () => {
    const provider = createDummyEmailProvider();

    await expect(provider.send(message)).resolves.toEqual({ id: "msg_1" });
    expect(provider.outbox).toEqual([message]);
  });

  it("accepts named mailboxes, multiple recipients and copies", async () => {
    const provider = createDummyEmailProvider();
    const rich: EmailMessage = {
      from: sender,
      to: [{ email: "a@example.test", name: "A" }, "b@example.test"],
      cc: ["cc@example.test"],
      bcc: [{ email: "bcc@example.test" }],
      replyTo: sender,
      subject: "Report ready",
      html: "<p>Ready</p>",
      text: "Ready",
    };

    await expect(provider.send(rich)).resolves.toEqual({ id: "msg_1" });
    expect(provider.outbox[0]?.to).toHaveLength(2);
  });

  it("sends batches and returns one id per message in order", async () => {
    const provider = createDummyEmailProvider();

    const result = await provider.sendBatch([message, { ...message, subject: "Second" }]);

    expect(result.ids).toEqual(["msg_1", "msg_2"]);
    expect(provider.outbox.map((entry) => entry.subject)).toEqual(["Welcome", "Second"]);
  });

  it("throws EmailPortError with SEND_FAILED for a message without content", async () => {
    const provider = createDummyEmailProvider();
    const invalid: EmailMessage = { from: sender, to: "user@example.test", subject: "Empty" };

    const error = await provider.send(invalid).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(EmailPortError);
    expect((error as EmailPortError).code).toBe(EmailErrorCode.SEND_FAILED);
    expect(provider.outbox).toEqual([]);
  });
});

describe("EmailPortError", () => {
  it("extends AppError and defaults to PROVIDER_FAILURE", () => {
    const error = new EmailPortError("provider unreachable");

    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe("EmailPortError");
    expect(error.code).toBe(EmailErrorCode.PROVIDER_FAILURE);
  });

  it("carries details and cause", () => {
    const cause = new Error("429");
    const error = new EmailPortError("rejected", { details: { retryable: true }, cause });

    expect(error.details).toEqual({ retryable: true });
    expect(error.cause).toBe(cause);
  });
});

describe("package exports", () => {
  it("exposes exactly the runtime exports of the port", () => {
    expect(Object.keys(emailPackage).sort()).toEqual(["EmailErrorCode", "EmailPortError"]);
  });

  it("exposes provider-neutral error codes", () => {
    expect(EmailErrorCode).toEqual({
      SEND_FAILED: "EMAIL_SEND_FAILED",
      PROVIDER_FAILURE: "EMAIL_PROVIDER_FAILURE",
    });
  });
});
