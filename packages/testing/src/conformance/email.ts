/**
 * Email conformance suite — proves any EmailPort implementation satisfies the
 * @forge/email contract. V3 §12.4, §5.2, P12.
 */

import { describe, expect, it } from "vitest";
import { isAppError } from "@forge/shared";
import {
  EmailErrorCode,
  EmailPortError,
  type EmailMessage,
  type EmailPort,
} from "@forge/email";

/** Seeded inputs the email conformance run promises. */
export interface EmailConformanceFixtures {
  /** A valid message carrying at least one body and one recipient. */
  readonly validMessage: EmailMessage;
  /** A second valid message, distinguishable from the first. */
  readonly secondMessage: EmailMessage;
}

/** Produces an EmailPort implementation. */
export interface EmailConformanceHarness {
  readonly fixtures: EmailConformanceFixtures;
  createPort(): EmailPort;
}

/** Registers the Email conformance suite against the harness. */
export function runEmailConformance(harness: EmailConformanceHarness): void {
  const { fixtures } = harness;

  describe("EmailPort conformance", () => {
    it("send resolves a provider message id", async () => {
      const port = harness.createPort();
      const result = await port.send(fixtures.validMessage);
      expect(result.id).not.toBe("");
    });

    it("send resolves distinct ids for successive messages", async () => {
      const port = harness.createPort();
      const first = await port.send(fixtures.validMessage);
      const second = await port.send(fixtures.secondMessage);
      expect(first.id).not.toBe(second.id);
    });

    it("send rejects a message with neither html nor text body with EMAIL_SEND_FAILED", async () => {
      const port = harness.createPort();
      const invalid: EmailMessage = { ...fixtures.validMessage, html: undefined, text: undefined };
      const error = await port.send(invalid).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(EmailPortError);
      expect(isAppError(error)).toBe(true);
      expect((error as EmailPortError).code).toBe(EmailErrorCode.SEND_FAILED);
    });

    it("sendBatch resolves one id per message in input order", async () => {
      const port = harness.createPort();
      const result = await port.sendBatch([fixtures.validMessage, fixtures.secondMessage]);

      expect(result.ids).toHaveLength(2);
      expect(result.ids[0]).not.toBe("");
      expect(result.ids[1]).not.toBe("");
      expect(result.ids[0]).not.toBe(result.ids[1]);
    });

    it("sendBatch resolves an empty id list for an empty batch", async () => {
      const port = harness.createPort();
      await expect(port.sendBatch([])).resolves.toEqual({ ids: [] });
    });

    it("sendBatch rejects when any message is invalid", async () => {
      const port = harness.createPort();
      const invalid: EmailMessage = { ...fixtures.secondMessage, html: undefined, text: undefined };
      const error = await port
        .sendBatch([fixtures.validMessage, invalid])
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(EmailPortError);
      expect((error as EmailPortError).code).toBe(EmailErrorCode.SEND_FAILED);
    });
  });
}
