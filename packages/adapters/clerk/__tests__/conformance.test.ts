/**
 * Day 5 validation gate: the Clerk adapter, middleware and webhook handler
 * must pass the reusable @forge/auth conformance suites (V3 §20.2, P12).
 * Runs entirely against an injected fake Clerk client — no live account.
 */

import { describe } from "vitest";
import type { AuthMiddlewareRequest, AuthWebhookRequest } from "@forge/auth";
import {
  runAuthMiddlewareConformance,
  runAuthPortConformance,
  runAuthWebhookConformance,
} from "@forge/testing";
import { clerkAuthAdapter, type ClerkSessionClaims } from "../src/adapter.js";
import { clerkAuthMiddleware } from "../src/middleware.js";
import { clerkAuthWebhookHandler } from "../src/webhook.js";
import { createFakeClerkClient, makeMiddlewareRequest, makeWebhookRequest, signClerkWebhook } from "./helpers.js";

const confUser = { id: "user_clerk_conf", email: "clerk-conf@example.test", name: "Clerk Conf" };
const confOrgA = { id: "org_clerk_a", name: "Clerk Org A", slug: "clerk-org-a" };
const confOrgB = { id: "org_clerk_b", name: "Clerk Org B", slug: "clerk-org-b" };

const seededClient = () =>
  createFakeClerkClient({
    users: new Map([
      [
        confUser.id,
        {
          id: confUser.id,
          firstName: "Clerk",
          lastName: "Conf",
          primaryEmailAddressId: "email_conf",
          emailAddresses: [{ id: "email_conf", emailAddress: confUser.email }],
        },
      ],
    ]),
    organizations: new Map([
      [confOrgA.id, { id: confOrgA.id, name: confOrgA.name, slug: confOrgA.slug }],
      [confOrgB.id, { id: confOrgB.id, name: confOrgB.name, slug: confOrgB.slug }],
    ]),
    memberships: new Map([
      [confUser.id, [{ id: confOrgA.id, name: confOrgA.name, slug: confOrgA.slug }]],
    ]),
  });

describe("Clerk adapter conformance", () => {
  runAuthPortConformance({
    fixtures: {
      user: confUser,
      organizations: [confOrgA, confOrgB],
      userOrganizationIds: [confOrgA.id],
      absentOrganizationId: "org_clerk_missing",
      absentUserId: "user_clerk_missing",
    },
    createAuthenticatedPort: () =>
      clerkAuthAdapter({ client: seededClient(), session: { getCurrentUserId: () => confUser.id } }),
    createUnauthenticatedPort: () =>
      clerkAuthAdapter({ client: seededClient(), session: { getCurrentUserId: () => null } }),
  });

  const claimsTable: Record<string, ClerkSessionClaims> = {
    "valid-with-org": { sub: "user_clerk_conf", org_id: confOrgA.id },
    "valid-no-org": { sub: "user_clerk_conf" },
  };

  runAuthMiddlewareConformance({
    createMiddleware: () =>
      clerkAuthMiddleware({
        verifySessionToken: async (token) => {
          const claims = claimsTable[token];
          if (claims === undefined) {
            throw new Error(`rejected token: ${token}`);
          }
          return claims;
        },
      }),
    createUnauthenticatedRequest: (): AuthMiddlewareRequest => makeMiddlewareRequest({}),
    createAuthenticatedRequest: (): AuthMiddlewareRequest =>
      makeMiddlewareRequest({ authorization: "Bearer valid-with-org" }),
    createAuthenticatedRequestWithoutOrganization: (): AuthMiddlewareRequest =>
      makeMiddlewareRequest({ authorization: "Bearer valid-no-org" }),
  });

  const webhookSecret = "whsec_" + Buffer.from("clerk-conformance-secret-000").toString("base64");

  const userCreatedPayload = {
    type: "user.created",
    data: {
      id: "user_wh_conf",
      email_addresses: [{ id: "email_1", email_address: "wh-conf@example.test" }],
      primary_email_address_id: "email_1",
      first_name: "Conformance",
      last_name: "Webhook",
    },
  };
  const userUpdatedPayload = {
    type: "user.updated",
    data: { id: "user_wh_conf", email_address: "wh-conf-updated@example.test" },
  };
  const organizationCreatedPayload = {
    type: "organization.created",
    data: { id: "org_wh_conf", name: "Conformance Org", slug: "conformance-org" },
  };

  function validRequest(payload: unknown): AuthWebhookRequest {
    const signed = signClerkWebhook(webhookSecret, payload);
    return makeWebhookRequest(signed.headers, signed.body);
  }

  runAuthWebhookConformance({
    fixtures: {
      userCreatedPayload,
      userUpdatedPayload,
      organizationCreatedPayload,
      malformedUserPayload: { type: "user.created", data: { id: "user_wh_conf" } },
      malformedOrganizationPayload: { type: "organization.created", data: { id: "org_wh_conf" } },
    },
    createHandler: () => clerkAuthWebhookHandler({ webhookSecret }),
    createValidRequest: validRequest,
    createInvalidSignatureRequest: (payload): AuthWebhookRequest => {
      const otherSecret = "whsec_" + Buffer.from("wrong-clerk-secret-000000000").toString("base64");
      const signed = signClerkWebhook(webhookSecret, payload, { secretOverride: otherSecret });
      return makeWebhookRequest(signed.headers, signed.body);
    },
    createMissingSignatureRequest: (payload): AuthWebhookRequest =>
      makeWebhookRequest({ "content-type": "application/json" }, JSON.stringify(payload)),
  });
});
