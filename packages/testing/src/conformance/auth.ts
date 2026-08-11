/**
 * Auth conformance suite — proves any AuthPort, AuthMiddleware and
 * AuthWebhookHandler implementation satisfies the @forge/auth contract.
 * V3 §12.4 (adapter conformance lives here), §5.2 (contracts), P12
 * (conformance tests prove adapter replaceability).
 *
 * Suites are vitest registration functions: call them at the top level of a
 * test file with a harness that can produce the adapter under test in known
 * states. Any adapter passing these suites is a valid replacement (Rule
 * Set 13, .ai/rules.md).
 */

import { describe, expect, it } from "vitest";
import { isAppError } from "@forge/shared";
import {
  AuthErrorCode,
  AuthPortError,
  type AuthMiddleware,
  type AuthMiddlewareRequest,
  type AuthOrganization,
  type AuthPort,
  type AuthUser,
  type AuthWebhookHandler,
  type AuthWebhookRequest,
  type OrganizationId,
  type UserId,
} from "@forge/auth";

/** The seeded state a conforming AuthPort test run promises. */
export interface AuthPortConformanceFixtures {
  /** The principal `getCurrentUser()` resolves on the authenticated port. */
  readonly user: AuthUser;
  /** Organizations that exist and are addressable by id. */
  readonly organizations: readonly AuthOrganization[];
  /**
   * Organizations the fixture user belongs to. Defaults to every fixture
   * organization.
   */
  readonly userOrganizationIds?: readonly OrganizationId[];
  /** An organization id guaranteed not to exist. */
  readonly absentOrganizationId: OrganizationId;
  /** A principal guaranteed to belong to no organizations. */
  readonly absentUserId: UserId;
}

/** Produces an AuthPort implementation in known states. */
export interface AuthPortConformanceHarness {
  readonly fixtures: AuthPortConformanceFixtures;
  /** Adapter whose `getCurrentUser()` resolves the fixture user. */
  createAuthenticatedPort(): AuthPort;
  /** Adapter with no authenticated principal. */
  createUnauthenticatedPort(): AuthPort;
}

function expectedUserOrganizations(
  fixtures: AuthPortConformanceFixtures
): readonly AuthOrganization[] {
  const ids = fixtures.userOrganizationIds ?? fixtures.organizations.map((org) => org.id);
  return fixtures.organizations.filter((organization) => ids.includes(organization.id));
}

/** Registers the AuthPort conformance suite against the harness. */
export function runAuthPortConformance(harness: AuthPortConformanceHarness): void {
  const { fixtures } = harness;

  describe("AuthPort conformance", () => {
    it("getCurrentUser resolves the authenticated principal", async () => {
      const port = harness.createAuthenticatedPort();
      await expect(port.getCurrentUser()).resolves.toEqual(fixtures.user);
    });

    it("requireUser resolves the authenticated principal", async () => {
      const port = harness.createAuthenticatedPort();
      await expect(port.requireUser()).resolves.toEqual(fixtures.user);
    });

    it("getOrganization resolves each known organization", async () => {
      const port = harness.createAuthenticatedPort();
      for (const organization of fixtures.organizations) {
        await expect(port.getOrganization(organization.id)).resolves.toEqual(organization);
      }
    });

    it("getOrganization resolves null for an unknown organization", async () => {
      const port = harness.createAuthenticatedPort();
      await expect(port.getOrganization(fixtures.absentOrganizationId)).resolves.toBeNull();
    });

    it("requireOrganization resolves a known organization", async () => {
      const port = harness.createAuthenticatedPort();
      for (const organization of fixtures.organizations) {
        await expect(port.requireOrganization(organization.id)).resolves.toEqual(organization);
      }
    });

    it("requireOrganization rejects an unknown organization with AUTH_ORGANIZATION_NOT_FOUND", async () => {
      const port = harness.createAuthenticatedPort();
      const error = await port
        .requireOrganization(fixtures.absentOrganizationId)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(AuthPortError);
      expect(isAppError(error)).toBe(true);
      expect((error as AuthPortError).code).toBe(AuthErrorCode.ORGANIZATION_NOT_FOUND);
    });

    it("getUserOrganizations resolves the principal's organizations", async () => {
      const port = harness.createAuthenticatedPort();
      const expected = expectedUserOrganizations(fixtures);
      const resolved = await port.getUserOrganizations(fixtures.user.id);

      expect(resolved.map((organization) => organization.id).sort()).toEqual(
        expected.map((organization) => organization.id).sort()
      );
      for (const organization of expected) {
        expect(resolved).toContainEqual(organization);
      }
    });

    it("getUserOrganizations resolves empty for a principal with no organizations", async () => {
      const port = harness.createAuthenticatedPort();
      await expect(port.getUserOrganizations(fixtures.absentUserId)).resolves.toEqual([]);
    });

    it("getCurrentUser resolves null when unauthenticated", async () => {
      const port = harness.createUnauthenticatedPort();
      await expect(port.getCurrentUser()).resolves.toBeNull();
    });

    it("requireUser rejects unauthenticated calls with AUTH_UNAUTHENTICATED", async () => {
      const port = harness.createUnauthenticatedPort();
      const error = await port.requireUser().catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(AuthPortError);
      expect(isAppError(error)).toBe(true);
      expect((error as AuthPortError).code).toBe(AuthErrorCode.UNAUTHENTICATED);
    });
  });
}

/** Produces an AuthMiddleware plus requests in known auth states. */
export interface AuthMiddlewareConformanceHarness<TResponse = unknown> {
  createMiddleware(): AuthMiddleware<AuthMiddlewareRequest, TResponse>;
  /** A request carrying no valid authentication. */
  createUnauthenticatedRequest(): AuthMiddlewareRequest;
  /** A request authenticated as a principal with organization context. */
  createAuthenticatedRequest(): AuthMiddlewareRequest;
  /** A request authenticated as a principal without organization context. */
  createAuthenticatedRequestWithoutOrganization(): AuthMiddlewareRequest;
}

/**
 * Registers the AuthMiddleware conformance suite. Contract: returning a
 * response short-circuits the request; returning nothing lets it continue
 * (@forge/auth middleware-port).
 */
export function runAuthMiddlewareConformance<TResponse = unknown>(
  harness: AuthMiddlewareConformanceHarness<TResponse>
): void {
  describe("AuthMiddleware conformance", () => {
    it("short-circuits an unauthenticated request", async () => {
      const handler = harness.createMiddleware().protect();
      const result = await handler(harness.createUnauthenticatedRequest());
      expect(result).not.toBeUndefined();
    });

    it("lets an authenticated request continue", async () => {
      const handler = harness.createMiddleware().protect();
      const result = await handler(harness.createAuthenticatedRequest());
      expect(result).toBeUndefined();
    });

    it("lets an organization-scoped request continue when an organization is required", async () => {
      const handler = harness.createMiddleware().protect({ organizationRequired: true });
      const result = await handler(harness.createAuthenticatedRequest());
      expect(result).toBeUndefined();
    });

    it("short-circuits an organization-less request when an organization is required", async () => {
      const handler = harness.createMiddleware().protect({ organizationRequired: true });
      const result = await handler(harness.createAuthenticatedRequestWithoutOrganization());
      expect(result).not.toBeUndefined();
    });
  });
}

/** Seeded payloads for the webhook conformance suite. */
export interface AuthWebhookConformanceFixtures {
  /** A verified `user.created` event payload. */
  readonly userCreatedPayload: unknown;
  /** A verified `user.updated` event payload. */
  readonly userUpdatedPayload: unknown;
  /** A verified `organization.created` event payload. */
  readonly organizationCreatedPayload: unknown;
  /** A payload with the right event type but broken user data. */
  readonly malformedUserPayload: unknown;
  /** A payload with the right event type but broken organization data. */
  readonly malformedOrganizationPayload: unknown;
}

/** Produces an AuthWebhookHandler plus requests in known signature states. */
export interface AuthWebhookConformanceHarness {
  readonly fixtures: AuthWebhookConformanceFixtures;
  createHandler(): AuthWebhookHandler;
  /** A request whose signature verifies and whose body is `payload`. */
  createValidRequest(payload: unknown): AuthWebhookRequest;
  /** A request whose body is `payload` but whose signature is wrong. */
  createInvalidSignatureRequest(payload: unknown): AuthWebhookRequest;
  /** A request missing the signature headers entirely. */
  createMissingSignatureRequest(payload: unknown): AuthWebhookRequest;
}

/** Registers the AuthWebhookHandler conformance suite against the harness. */
export function runAuthWebhookConformance(harness: AuthWebhookConformanceHarness): void {
  const { fixtures } = harness;

  describe("AuthWebhookHandler conformance", () => {
    it("verifyWebhookSignature resolves the verified payload", async () => {
      const handler = harness.createHandler();
      const request = harness.createValidRequest(fixtures.userCreatedPayload);
      await expect(handler.verifyWebhookSignature(request)).resolves.toEqual(
        fixtures.userCreatedPayload
      );
    });

    it("verifyWebhookSignature rejects an invalid signature with AUTH_INVALID_WEBHOOK_SIGNATURE", async () => {
      const handler = harness.createHandler();
      const request = harness.createInvalidSignatureRequest(fixtures.userCreatedPayload);
      const error = await handler.verifyWebhookSignature(request).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(AuthPortError);
      expect(isAppError(error)).toBe(true);
      expect((error as AuthPortError).code).toBe(AuthErrorCode.INVALID_WEBHOOK_SIGNATURE);
    });

    it("verifyWebhookSignature rejects missing signature headers with AUTH_INVALID_WEBHOOK_SIGNATURE", async () => {
      const handler = harness.createHandler();
      const request = harness.createMissingSignatureRequest(fixtures.userCreatedPayload);
      const error = await handler.verifyWebhookSignature(request).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(AuthPortError);
      expect((error as AuthPortError).code).toBe(AuthErrorCode.INVALID_WEBHOOK_SIGNATURE);
    });

    it("handleUserCreated accepts a valid user.created payload", async () => {
      const handler = harness.createHandler();
      await expect(handler.handleUserCreated(fixtures.userCreatedPayload)).resolves.toBeUndefined();
    });

    it("handleUserCreated rejects a malformed payload with AuthPortError", async () => {
      const handler = harness.createHandler();
      const error = await handler
        .handleUserCreated(fixtures.malformedUserPayload)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(AuthPortError);
      expect((error as AuthPortError).code).toBe(AuthErrorCode.PROVIDER_FAILURE);
    });

    it("handleUserUpdated accepts a valid user.updated payload", async () => {
      const handler = harness.createHandler();
      await expect(handler.handleUserUpdated(fixtures.userUpdatedPayload)).resolves.toBeUndefined();
    });

    it("handleOrganizationCreated accepts a valid organization.created payload", async () => {
      const handler = harness.createHandler();
      await expect(
        handler.handleOrganizationCreated(fixtures.organizationCreatedPayload)
      ).resolves.toBeUndefined();
    });

    it("handleOrganizationCreated rejects a malformed payload with AuthPortError", async () => {
      const handler = harness.createHandler();
      const error = await handler
        .handleOrganizationCreated(fixtures.malformedOrganizationPayload)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(AuthPortError);
      expect((error as AuthPortError).code).toBe(AuthErrorCode.PROVIDER_FAILURE);
    });
  });
}
