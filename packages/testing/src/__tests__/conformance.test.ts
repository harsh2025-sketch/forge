/**
 * Conformance self-validation: every suite must pass against the
 * corresponding mock adapters. This proves the suites are executable and the
 * mocks genuinely satisfy the port contracts (P12).
 */

import { describe } from "vitest";
import type { AuthMiddlewareRequest, AuthWebhookRequest } from "@forge/auth";
import type { BillingWebhookRequest } from "@forge/billing";
import {
  createMockAIModelPort,
  createMockAuthMiddleware,
  createMockAuthPort,
  createMockAuthWebhookHandler,
  createMockBillingPort,
  createMockBillingStore,
  createMockBillingWebhookHandler,
  createMockEmailPort,
  createMockJobQueue,
  createMockStoragePort,
  makeAuthOrganization,
  makeAuthUser,
  makeEmailMessage,
  mockBillingPayloads,
  runAIProviderConformance,
  runAuthMiddlewareConformance,
  runAuthPortConformance,
  runAuthWebhookConformance,
  runBillingConformance,
  runEmailConformance,
  runJobsConformance,
  runStorageConformance,
} from "../index.js";
import { makeMiddlewareRequest, makeWebhookRequest } from "./helpers.js";

describe("conformance suites against mock adapters", () => {
  const user = makeAuthUser({ id: "user_conf", email: "conf@example.test", name: "Conf User" });
  const orgA = makeAuthOrganization({ id: "org_conf_a", name: "Conf Org A", slug: "conf-org-a" });
  const orgB = makeAuthOrganization({ id: "org_conf_b", name: "Conf Org B", slug: "conf-org-b" });

  runAuthPortConformance({
    fixtures: {
      user,
      organizations: [orgA, orgB],
      userOrganizationIds: [orgA.id],
      absentOrganizationId: "org_conf_missing",
      absentUserId: "user_conf_missing",
    },
    createAuthenticatedPort: () =>
      createMockAuthPort({
        currentUser: user,
        organizations: [orgA, orgB],
        memberships: { [user.id]: [orgA.id] },
      }),
    createUnauthenticatedPort: () =>
      createMockAuthPort({
        currentUser: null,
        organizations: [orgA, orgB],
        memberships: { [user.id]: [orgA.id] },
      }),
  });

  const middleware = createMockAuthMiddleware({
    currentUser: user,
    organizations: [orgA],
    memberships: { [user.id]: [orgA.id], user_no_org: [] },
  });

  runAuthMiddlewareConformance({
    createMiddleware: () => middleware,
    createUnauthenticatedRequest: (): AuthMiddlewareRequest => makeMiddlewareRequest({}),
    createAuthenticatedRequest: (): AuthMiddlewareRequest =>
      makeMiddlewareRequest({ authorization: `Bearer ${user.id}` }),
    createAuthenticatedRequestWithoutOrganization: (): AuthMiddlewareRequest =>
      makeMiddlewareRequest({ authorization: "Bearer user_no_org" }),
  });

  const webhookSecret = "whsec_conformance";
  const userCreatedPayload = {
    type: "user.created",
    data: { id: "user_wh_1", email: "wh@example.test", name: "Webhook User" },
  };
  const userUpdatedPayload = {
    type: "user.updated",
    data: { id: "user_wh_1", email: "wh-updated@example.test" },
  };
  const organizationCreatedPayload = {
    type: "organization.created",
    data: { id: "org_wh_1", name: "Webhook Org", slug: "webhook-org" },
  };

  function signedRequest(payload: unknown, signature: string): AuthWebhookRequest {
    return makeWebhookRequest({ "x-mock-signature": signature }, JSON.stringify(payload));
  }

  runAuthWebhookConformance({
    fixtures: {
      userCreatedPayload,
      userUpdatedPayload,
      organizationCreatedPayload,
      malformedUserPayload: { type: "user.created", data: { id: "user_wh_1" } },
      malformedOrganizationPayload: { type: "organization.created", data: { name: "no id" } },
    },
    createHandler: () => createMockAuthWebhookHandler({ webhookSecret }),
    createValidRequest: (payload): AuthWebhookRequest => signedRequest(payload, webhookSecret),
    createInvalidSignatureRequest: (payload): AuthWebhookRequest => signedRequest(payload, "wrong"),
    createMissingSignatureRequest: (payload): AuthWebhookRequest =>
      makeWebhookRequest({}, JSON.stringify(payload)),
  });

  const billingSecret = "whsec_billing_conformance";

  runBillingConformance({
    fixtures: {
      customer: { email: "billing-conf@example.test", name: "Billing Conf" },
      priceId: "price_conf",
      absentCustomerId: "customer_conf_missing",
      absentSubscriptionId: "sub_conf_missing",
    },
    createConnectedPair: () => {
      const store = createMockBillingStore();
      return {
        port: createMockBillingPort(store),
        webhookHandler: createMockBillingWebhookHandler(store, { secret: billingSecret }),
      };
    },
    createValidWebhookRequest: (payload): BillingWebhookRequest =>
      makeWebhookRequest({ "x-mock-signature": billingSecret }, JSON.stringify(payload)),
    createInvalidWebhookRequest: (payload): BillingWebhookRequest =>
      makeWebhookRequest({ "x-mock-signature": "wrong" }, JSON.stringify(payload)),
    payloads: mockBillingPayloads,
  });

  runEmailConformance({
    fixtures: {
      validMessage: makeEmailMessage(),
      secondMessage: makeEmailMessage({ subject: "Second conformance message" }),
    },
    createPort: () => createMockEmailPort(),
  });

  runJobsConformance({ createQueue: () => createMockJobQueue() });

  runStorageConformance({ createStorage: () => createMockStoragePort() });

  runAIProviderConformance({
    fixtures: { defaultModel: "mock-model", structuredValue: { answer: 42 } },
    createPort: () => createMockAIModelPort({ structuredValue: { answer: 42 } }),
  });
});
