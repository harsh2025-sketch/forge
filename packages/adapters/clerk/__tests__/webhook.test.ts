import { describe, expect, it } from "vitest";
import { AuthErrorCode, AuthPortError } from "@forge/auth";
import { isAppError } from "@forge/shared";
import { clerkAuthWebhookHandler, type ClerkOrganizationEvent, type ClerkUserEvent } from "../src/webhook.js";
import { makeWebhookRequest, signClerkWebhook } from "./helpers.js";

const secret = "whsec_" + Buffer.from("clerk-webhook-test-secret-00").toString("base64");

const userCreatedPayload = {
  type: "user.created",
  data: {
    id: "user_wh_1",
    email_addresses: [
      { id: "email_2", email_address: "secondary@example.test" },
      { id: "email_1", email_address: "created@example.test" },
    ],
    primary_email_address_id: "email_1",
    first_name: "Web",
    last_name: "Hook",
  },
};

function signedRequest(payload: unknown, options?: { secretOverride?: string; body?: string }) {
  const signed = signClerkWebhook(secret, payload, { secretOverride: options?.secretOverride });
  return makeWebhookRequest(signed.headers, options?.body ?? signed.body);
}

describe("clerkAuthWebhookHandler — signature verification", () => {
  it("resolves the verified payload for a valid Clerk signature", async () => {
    const handler = clerkAuthWebhookHandler({ webhookSecret: secret });
    await expect(handler.verifyWebhookSignature(signedRequest(userCreatedPayload))).resolves.toEqual(
      userCreatedPayload
    );
  });

  it("rejects a payload signed with a different secret with AUTH_INVALID_WEBHOOK_SIGNATURE", async () => {
    const handler = clerkAuthWebhookHandler({ webhookSecret: secret });
    const otherSecret = "whsec_" + Buffer.from("some-other-secret-0000000000").toString("base64");
    const request = signedRequest(userCreatedPayload, { secretOverride: otherSecret });

    const error = await handler.verifyWebhookSignature(request).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AuthPortError);
    expect(isAppError(error)).toBe(true);
    expect((error as AuthPortError).code).toBe(AuthErrorCode.INVALID_WEBHOOK_SIGNATURE);
  });

  it("rejects a tampered body with AUTH_INVALID_WEBHOOK_SIGNATURE", async () => {
    const handler = clerkAuthWebhookHandler({ webhookSecret: secret });
    const request = signedRequest(userCreatedPayload, { body: '{"type":"user.created","data":{"id":"forged"}}' });

    const error = await handler.verifyWebhookSignature(request).catch((caught: unknown) => caught);
    expect((error as AuthPortError).code).toBe(AuthErrorCode.INVALID_WEBHOOK_SIGNATURE);
  });

  it("rejects requests missing svix headers with AUTH_INVALID_WEBHOOK_SIGNATURE", async () => {
    const handler = clerkAuthWebhookHandler({ webhookSecret: secret });
    const request = makeWebhookRequest({ "content-type": "application/json" }, "{}");

    const error = await handler.verifyWebhookSignature(request).catch((caught: unknown) => caught);
    expect((error as AuthPortError).code).toBe(AuthErrorCode.INVALID_WEBHOOK_SIGNATURE);
  });

  it("rejects a validly signed non-JSON body with AUTH_INVALID_WEBHOOK_SIGNATURE", async () => {
    const handler = clerkAuthWebhookHandler({ webhookSecret: secret });
    const request = signedRequest(userCreatedPayload, { body: "not json at all" });

    const error = await handler.verifyWebhookSignature(request).catch((caught: unknown) => caught);
    expect((error as AuthPortError).code).toBe(AuthErrorCode.INVALID_WEBHOOK_SIGNATURE);
  });
});

describe("clerkAuthWebhookHandler — event handling", () => {
  it("normalizes user.created and invokes the injected callback", async () => {
    const received: ClerkUserEvent[] = [];
    const handler = clerkAuthWebhookHandler({
      webhookSecret: secret,
      onUserCreated: (event) => {
        received.push(event);
      },
    });

    await handler.handleUserCreated(userCreatedPayload);

    expect(received).toEqual([
      { user: { id: "user_wh_1", email: "created@example.test", name: "Web Hook" } },
    ]);
  });

  it("normalizes user.updated and invokes the injected callback", async () => {
    const received: ClerkUserEvent[] = [];
    const handler = clerkAuthWebhookHandler({
      webhookSecret: secret,
      onUserUpdated: (event) => {
        received.push(event);
      },
    });

    await handler.handleUserUpdated({
      type: "user.updated",
      data: { id: "user_wh_1", email_address: "updated@example.test" },
    });

    expect(received).toEqual([
      { user: { id: "user_wh_1", email: "updated@example.test", name: undefined } },
    ]);
  });

  it("normalizes organization.created and invokes the injected callback", async () => {
    const received: ClerkOrganizationEvent[] = [];
    const handler = clerkAuthWebhookHandler({
      webhookSecret: secret,
      onOrganizationCreated: (event) => {
        received.push(event);
      },
    });

    await handler.handleOrganizationCreated({
      type: "organization.created",
      data: { id: "org_wh_1", name: "Webhook Org", slug: "webhook-org" },
    });

    expect(received).toEqual([
      { organization: { id: "org_wh_1", name: "Webhook Org", slug: "webhook-org" } },
    ]);
  });

  it("resolves without callbacks configured", async () => {
    const handler = clerkAuthWebhookHandler({ webhookSecret: secret });
    await expect(handler.handleUserCreated(userCreatedPayload)).resolves.toBeUndefined();
  });
});

describe("clerkAuthWebhookHandler — malformed payloads", () => {
  const handler = clerkAuthWebhookHandler({ webhookSecret: secret });

  it("rejects payloads with the wrong event type", async () => {
    const error = await handler
      .handleUserCreated({ type: "user.deleted", data: { id: "user_1" } })
      .catch((caught: unknown) => caught);
    expect((error as AuthPortError).code).toBe(AuthErrorCode.PROVIDER_FAILURE);
  });

  it("rejects non-object payloads", async () => {
    for (const payload of [null, "user.created", 42]) {
      const error = await handler.handleUserCreated(payload).catch((caught: unknown) => caught);
      expect(error, String(payload)).toBeInstanceOf(AuthPortError);
      expect((error as AuthPortError).code, String(payload)).toBe(AuthErrorCode.PROVIDER_FAILURE);
    }
  });

  it("rejects user events missing an id or an email address", async () => {
    const missingId = { type: "user.created", data: { email_address: "x@example.test" } };
    const missingEmail = { type: "user.created", data: { id: "user_1" } };

    for (const payload of [missingId, missingEmail]) {
      const error = await handler.handleUserCreated(payload).catch((caught: unknown) => caught);
      expect((error as AuthPortError).code).toBe(AuthErrorCode.PROVIDER_FAILURE);
    }
  });

  it("rejects organization events missing an id or a name", async () => {
    const missingId = { type: "organization.created", data: { name: "Org" } };
    const missingName = { type: "organization.created", data: { id: "org_1" } };

    for (const payload of [missingId, missingName]) {
      const error = await handler
        .handleOrganizationCreated(payload)
        .catch((caught: unknown) => caught);
      expect((error as AuthPortError).code).toBe(AuthErrorCode.PROVIDER_FAILURE);
    }
  });

  it("rejects events whose data is not an object", async () => {
    const error = await handler
      .handleUserCreated({ type: "user.created", data: "not-an-object" })
      .catch((caught: unknown) => caught);
    expect((error as AuthPortError).code).toBe(AuthErrorCode.PROVIDER_FAILURE);
  });
});
