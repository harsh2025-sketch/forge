import { describe, expect, it } from "vitest";
import { AuthErrorCode, AuthPortError } from "@forge/auth";
import {
  createMockAuthMiddleware,
  createMockAuthPort,
  createMockAuthWebhookHandler,
  makeAuthOrganization,
  makeAuthUser,
} from "../index.js";
import { makeMiddlewareRequest, makeWebhookRequest } from "./helpers.js";

const user = makeAuthUser({ id: "user_mock", email: "mock@example.test" });
const otherUser = makeAuthUser({ id: "user_other" });
const orgA = makeAuthOrganization({ id: "org_a", name: "Org A" });
const orgB = makeAuthOrganization({ id: "org_b", name: "Org B" });

describe("createMockAuthPort", () => {
  it("resolves the configured principal and their organizations", async () => {
    const port = createMockAuthPort({
      currentUser: user,
      organizations: [orgA, orgB],
      memberships: { [user.id]: ["org_a"] },
    });

    await expect(port.getCurrentUser()).resolves.toEqual(user);
    await expect(port.requireUser()).resolves.toEqual(user);
    await expect(port.getOrganization("org_a")).resolves.toEqual(orgA);
    await expect(port.getOrganization("org_missing")).resolves.toBeNull();
    await expect(port.getUserOrganizations(user.id)).resolves.toEqual([orgA]);
    await expect(port.getUserOrganizations(otherUser.id)).resolves.toEqual([]);
  });

  it("rejects requireUser with AUTH_UNAUTHENTICATED when no principal is set", async () => {
    const port = createMockAuthPort();
    await expect(port.getCurrentUser()).resolves.toBeNull();
    const error = await port.requireUser().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AuthPortError);
    expect((error as AuthPortError).code).toBe(AuthErrorCode.UNAUTHENTICATED);
  });

  it("rejects requireOrganization with AUTH_ORGANIZATION_NOT_FOUND for unknown orgs", async () => {
    const port = createMockAuthPort({ organizations: [orgA] });
    await expect(port.requireOrganization("org_a")).resolves.toEqual(orgA);
    const error = await port.requireOrganization("org_missing").catch((caught: unknown) => caught);
    expect((error as AuthPortError).code).toBe(AuthErrorCode.ORGANIZATION_NOT_FOUND);
    expect((error as AuthPortError).details).toEqual({ orgId: "org_missing" });
  });
});

describe("createMockAuthMiddleware", () => {
  const middleware = createMockAuthMiddleware({
    currentUser: user,
    organizations: [orgA],
    memberships: { [user.id]: ["org_a"], [otherUser.id]: [] },
  });

  it("lets a known principal through and rejects strangers", () => {
    const handler = middleware.protect();
    expect(handler(makeMiddlewareRequest({ authorization: `Bearer ${user.id}` }))).toBeUndefined();
    expect(handler(makeMiddlewareRequest({ authorization: "Bearer stranger" }))).toEqual({
      status: 401,
      body: { error: "Unauthenticated" },
    });
    expect(handler(makeMiddlewareRequest({}))).toEqual({
      status: 401,
      body: { error: "Unauthenticated" },
    });
  });

  it("enforces organizationRequired against memberships", () => {
    const handler = middleware.protect({ organizationRequired: true });
    expect(handler(makeMiddlewareRequest({ authorization: `Bearer ${user.id}` }))).toBeUndefined();
    expect(handler(makeMiddlewareRequest({ authorization: `Bearer ${otherUser.id}` }))).toEqual({
      status: 401,
      body: { error: "Organization required" },
    });
  });
});

describe("createMockAuthWebhookHandler", () => {
  const secret = "whsec_mock";

  it("verifies the configured signature and returns the payload", async () => {
    const handler = createMockAuthWebhookHandler({ webhookSecret: secret });
    const payload = { type: "user.created", data: { id: "user_1", email: "u@example.test" } };
    const request = makeWebhookRequest({ "x-mock-signature": secret }, JSON.stringify(payload));
    await expect(handler.verifyWebhookSignature(request)).resolves.toEqual(payload);
  });

  it("rejects wrong or missing signatures with AUTH_INVALID_WEBHOOK_SIGNATURE", async () => {
    const handler = createMockAuthWebhookHandler({ webhookSecret: secret });
    const body = JSON.stringify({ type: "user.created", data: {} });

    const wrong = makeWebhookRequest({ "x-mock-signature": "wrong" }, body);
    const missing = makeWebhookRequest({}, body);

    for (const request of [wrong, missing]) {
      const error = await handler.verifyWebhookSignature(request).catch((caught: unknown) => caught);
      expect((error as AuthPortError).code).toBe(AuthErrorCode.INVALID_WEBHOOK_SIGNATURE);
    }
  });

  it("rejects a non-JSON body with AUTH_INVALID_WEBHOOK_SIGNATURE", async () => {
    const handler = createMockAuthWebhookHandler({ webhookSecret: secret });
    const request = makeWebhookRequest({ "x-mock-signature": secret }, "not json");
    const error = await handler.verifyWebhookSignature(request).catch((caught: unknown) => caught);
    expect((error as AuthPortError).code).toBe(AuthErrorCode.INVALID_WEBHOOK_SIGNATURE);
  });

  it("records normalized user and organization events", async () => {
    const handler = createMockAuthWebhookHandler({ webhookSecret: secret });

    await handler.handleUserCreated({
      type: "user.created",
      data: { id: "user_1", email: "u@example.test", name: "U One" },
    });
    await handler.handleUserUpdated({ type: "user.updated", data: { id: "user_1", email: "new@example.test" } });
    await handler.handleOrganizationCreated({
      type: "organization.created",
      data: { id: "org_1", name: "Org One", slug: "org-one" },
    });

    expect(handler.events).toEqual([
      { type: "user.created", user: { id: "user_1", email: "u@example.test", name: "U One" } },
      { type: "user.updated", user: { id: "user_1", email: "new@example.test", name: undefined } },
      {
        type: "organization.created",
        organization: { id: "org_1", name: "Org One", slug: "org-one" },
      },
    ]);
  });

  it("rejects malformed and wrong-type payloads with PROVIDER_FAILURE", async () => {
    const handler = createMockAuthWebhookHandler({ webhookSecret: secret });

    const cases: Array<[() => Promise<void>, string]> = [
      [() => handler.handleUserCreated(null), "null payload"],
      [() => handler.handleUserCreated({ type: "user.updated", data: {} }), "wrong type"],
      [() => handler.handleUserCreated({ type: "user.created", data: { id: "user_1" } }), "missing email"],
      [() => handler.handleOrganizationCreated({ type: "organization.created", data: { id: "org_1" } }), "missing name"],
    ];

    for (const [call, label] of cases) {
      const error = await call().catch((caught: unknown) => caught);
      expect(error, label).toBeInstanceOf(AuthPortError);
      expect((error as AuthPortError).code, label).toBe(AuthErrorCode.PROVIDER_FAILURE);
    }
  });
});
