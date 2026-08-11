import { describe, expect, it } from "vitest";
import { EmailErrorCode, EmailPortError, type EmailMessage } from "@forge/email";
import { runEmailConformance } from "@forge/testing";
import { resendEmailAdapter, type ResendClient } from "../src/index.js";

const firstMessage: EmailMessage = {
  from: { email: "billing@forge.test", name: "Forge" },
  to: "one@example.test",
  subject: "First",
  html: "<p>Hello</p>",
};
const secondMessage: EmailMessage = {
  from: "billing@forge.test",
  to: { email: "two@example.test", name: "Two" },
  subject: "Second",
  text: "Hello",
};

function successfulClient() {
  let sequence = 0;
  const emailPayloads: unknown[] = [];
  const batchCalls: Array<{ payload: unknown; options: unknown }> = [];
  const client: ResendClient = {
    emails: {
      async send(payload) {
        emailPayloads.push(payload);
        sequence += 1;
        return { data: { id: `email_${sequence}` }, error: null };
      },
    },
    batch: {
      async send(payload, options) {
        batchCalls.push({ payload, options });
        const data = payload.map(() => {
          sequence += 1;
          return { id: `email_${sequence}` };
        });
        return { data: { data }, error: null };
      },
    },
  };
  return { client, emailPayloads, batchCalls };
}

runEmailConformance({
  fixtures: { validMessage: firstMessage, secondMessage },
  createPort() {
    return resendEmailAdapter({ client: successfulClient().client });
  },
});

describe("resendEmailAdapter", () => {
  it("maps neutral recipients and all optional fields to Resend", async () => {
    const fake = successfulClient();
    const port = resendEmailAdapter({ client: fake.client });
    await port.send({
      from: { name: "Forge Team", email: "team@forge.test" },
      to: ["a@example.test", { name: "Bee", email: "b@example.test" }],
      cc: [{ name: "See", email: "c@example.test" }],
      bcc: ["d@example.test"],
      replyTo: { name: "Help", email: "help@forge.test" },
      subject: "Mapped",
      html: "<p>mapped</p>",
      text: "mapped",
    });

    expect(fake.emailPayloads).toEqual([{
      from: "Forge Team <team@forge.test>",
      to: ["a@example.test", "Bee <b@example.test>"],
      cc: ["See <c@example.test>"],
      bcc: ["d@example.test"],
      replyTo: "Help <help@forge.test>",
      subject: "Mapped",
      html: "<p>mapped</p>",
      text: "mapped",
    }]);
  });

  it("uses Resend strict batch validation and preserves response order", async () => {
    const fake = successfulClient();
    const result = await resendEmailAdapter({ client: fake.client }).sendBatch([
      firstMessage,
      secondMessage,
    ]);

    expect(result).toEqual({ ids: ["email_1", "email_2"] });
    expect(fake.batchCalls[0]?.options).toEqual({ batchValidation: "strict" });
  });

  it("does not call Resend for an empty or locally invalid batch", async () => {
    const fake = successfulClient();
    const port = resendEmailAdapter({ client: fake.client });
    await expect(port.sendBatch([])).resolves.toEqual({ ids: [] });
    await expect(
      port.sendBatch([firstMessage, { ...secondMessage, text: undefined }])
    ).rejects.toMatchObject({ code: EmailErrorCode.SEND_FAILED });
    expect(fake.batchCalls).toHaveLength(0);
  });

  it("maps Resend rejection responses to EMAIL_SEND_FAILED", async () => {
    const client: ResendClient = {
      emails: {
        async send() {
          return { data: null, error: { message: "domain is not verified" } };
        },
      },
      batch: {
        async send() {
          return { data: null, error: { message: "one recipient is invalid" } };
        },
      },
    };
    const port = resendEmailAdapter({ client });

    for (const operation of [
      port.send(firstMessage),
      port.sendBatch([firstMessage, secondMessage]),
    ]) {
      const error = await operation.catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(EmailPortError);
      expect((error as EmailPortError).code).toBe(EmailErrorCode.SEND_FAILED);
    }
  });

  it("maps thrown provider failures to EMAIL_PROVIDER_FAILURE", async () => {
    const providerError = new Error("network unavailable");
    const client: ResendClient = {
      emails: { async send() { throw providerError; } },
      batch: { async send() { throw providerError; } },
    };
    const port = resendEmailAdapter({ client });

    await expect(port.send(firstMessage)).rejects.toMatchObject({
      code: EmailErrorCode.PROVIDER_FAILURE,
      cause: providerError,
    });
    await expect(port.sendBatch([firstMessage])).rejects.toMatchObject({
      code: EmailErrorCode.PROVIDER_FAILURE,
      cause: providerError,
    });
  });

  it("rejects malformed partial batch responses instead of exposing partial success", async () => {
    const client: ResendClient = {
      emails: { async send() { return { data: { id: "email_1" }, error: null }; } },
      batch: {
        async send() {
          return { data: { data: [{ id: "email_1" }] }, error: null };
        },
      },
    };
    await expect(
      resendEmailAdapter({ client }).sendBatch([firstMessage, secondMessage])
    ).rejects.toMatchObject({ code: EmailErrorCode.SEND_FAILED });
  });
});
