import { describe, it, expect } from "vitest";
import { AppError, isAppError } from "@forge/shared";
import * as authPackage from "../index.js";
import { AuthErrorCode, AuthPortError, type AuthOrganization, type AuthUser } from "../index.js";
import type { AuthPort } from "../index.js";
import type { AuthMiddleware, AuthMiddlewareRequest } from "../index.js";
import type { AuthWebhookHandler, AuthWebhookRequest } from "../index.js";

/** A dummy in-memory provider proving the port is implementable without a vendor. */
function createDummyAuthProvider(options: {
  readonly currentUser: AuthUser | null;
  readonly organizations: readonly AuthOrganization[];
}): AuthPort {
  return {
    async getCurrentUser() {
      return options.currentUser;
    },
    async requireUser() {
      if (options.currentUser === null) {
        throw new AuthPortError("Unauthorized", { code: AuthErrorCode.UNAUTHENTICATED });
      }
      return options.currentUser;
    },
    async getOrganization(orgId) {
      return options.organizations.find((org) => org.id === orgId) ?? null;
    },
    async requireOrganization(orgId) {
      const organization = options.organizations.find((org) => org.id === orgId);
      if (organization === undefined) {
        throw new AuthPortError(`Organization not found: ${orgId}`, {
          code: AuthErrorCode.ORGANIZATION_NOT_FOUND,
          details: { orgId },
        });
      }
      return organization;
    },
    async getUserOrganizations(userId) {
      return options.currentUser?.id === userId ? options.organizations : [];
    },
  };
}

const user: AuthUser = { id: "user_1", email: "user@example.com", name: "Test User" };
const organization: AuthOrganization = { id: "org_1", name: "Test Org", slug: "test-org" };

describe("AuthPort contract", () => {
  it("is implementable by a dummy provider", async () => {
    const provider = createDummyAuthProvider({ currentUser: user, organizations: [organization] });

    await expect(provider.getCurrentUser()).resolves.toEqual(user);
    await expect(provider.requireUser()).resolves.toEqual(user);
    await expect(provider.getOrganization("org_1")).resolves.toEqual(organization);
    await expect(provider.requireOrganization("org_1")).resolves.toEqual(organization);
    await expect(provider.getUserOrganizations("user_1")).resolves.toEqual([organization]);
  });

  it("getCurrentUser resolves null when unauthenticated", async () => {
    const provider = createDummyAuthProvider({ currentUser: null, organizations: [] });
    await expect(provider.getCurrentUser()).resolves.toBeNull();
  });

  it("getOrganization resolves null for an unknown organization", async () => {
    const provider = createDummyAuthProvider({ currentUser: user, organizations: [] });
    await expect(provider.getOrganization("missing")).resolves.toBeNull();
  });

  it("requireUser throws AuthPortError with UNAUTHENTICATED when unauthenticated", async () => {
    const provider = createDummyAuthProvider({ currentUser: null, organizations: [] });

    await expect(provider.requireUser()).rejects.toBeInstanceOf(AuthPortError);
    const error = await provider.requireUser().catch((caught: unknown) => caught);
    expect(isAppError(error)).toBe(true);
    expect((error as AuthPortError).code).toBe(AuthErrorCode.UNAUTHENTICATED);
  });

  it("requireOrganization throws AuthPortError with ORGANIZATION_NOT_FOUND", async () => {
    const provider = createDummyAuthProvider({ currentUser: user, organizations: [] });
    const error = await provider
      .requireOrganization("org_missing")
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AuthPortError);
    expect((error as AuthPortError).code).toBe(AuthErrorCode.ORGANIZATION_NOT_FOUND);
    expect((error as AuthPortError).details).toEqual({ orgId: "org_missing" });
  });
});

describe("AuthMiddleware contract", () => {
  it("is implementable with a framework-neutral request", async () => {
    const middleware: AuthMiddleware = {
      protect(protectOptions) {
        return (request: AuthMiddlewareRequest) => {
          const hasSession = request.headers.get("authorization") !== null;
          if (!hasSession) {
            return { status: 401, url: request.url };
          }
          if (protectOptions?.organizationRequired === true) {
            const orgId = request.headers.get("x-organization-id");
            if (orgId === null) {
              return { status: 403, url: request.url };
            }
          }
          return undefined;
        };
      },
    };

    const headers = new Map<string, string>([["authorization", "token"]]);
    const request: AuthMiddlewareRequest = {
      url: "https://example.test/dashboard",
      headers: { get: (name) => headers.get(name) ?? null },
    };

    await expect(Promise.resolve(middleware.protect()(request))).resolves.toBeUndefined();
    await expect(
      Promise.resolve(middleware.protect({ organizationRequired: true })(request))
    ).resolves.toEqual({
      status: 403,
      url: "https://example.test/dashboard",
    });

    const anonymous: AuthMiddlewareRequest = {
      url: "https://example.test/dashboard",
      headers: { get: () => null },
    };
    await expect(Promise.resolve(middleware.protect()(anonymous))).resolves.toEqual({
      status: 401,
      url: "https://example.test/dashboard",
    });
  });
});

describe("AuthWebhookHandler contract", () => {
  it("is implementable and keeps payloads opaque", async () => {
    const handled: string[] = [];
    const handler: AuthWebhookHandler = {
      async verifyWebhookSignature(request) {
        if (request.headers.get("x-signature") !== "valid") {
          throw new AuthPortError("Invalid webhook signature", {
            code: AuthErrorCode.INVALID_WEBHOOK_SIGNATURE,
          });
        }
        return JSON.parse(await request.text()) as unknown;
      },
      async handleUserCreated() {
        handled.push("user.created");
      },
      async handleUserUpdated() {
        handled.push("user.updated");
      },
      async handleOrganizationCreated() {
        handled.push("organization.created");
      },
    };

    const request: AuthWebhookRequest = {
      headers: { get: (name) => (name === "x-signature" ? "valid" : null) },
      text: async () => JSON.stringify({ type: "user.created" }),
    };

    await expect(handler.verifyWebhookSignature(request)).resolves.toEqual({
      type: "user.created",
    });
    await handler.handleUserCreated({});
    await handler.handleUserUpdated({});
    await handler.handleOrganizationCreated({});
    expect(handled).toEqual(["user.created", "user.updated", "organization.created"]);

    const invalid: AuthWebhookRequest = {
      headers: { get: () => null },
      text: async () => "{}",
    };
    const error = await handler.verifyWebhookSignature(invalid).catch((caught: unknown) => caught);
    expect((error as AuthPortError).code).toBe(AuthErrorCode.INVALID_WEBHOOK_SIGNATURE);
  });
});

describe("AuthPortError", () => {
  it("extends AppError and defaults to PROVIDER_FAILURE", () => {
    const error = new AuthPortError("provider exploded");

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AuthPortError");
    expect(error.code).toBe(AuthErrorCode.PROVIDER_FAILURE);
    expect(error.message).toBe("provider exploded");
  });

  it("preserves cause and details", () => {
    const cause = new Error("socket closed");
    const error = new AuthPortError("provider failed", { cause, details: { attempt: 2 } });

    expect(error.cause).toBe(cause);
    expect(error.details).toEqual({ attempt: 2 });
  });
});

describe("package exports", () => {
  it("exposes exactly the runtime exports of the port", () => {
    expect(Object.keys(authPackage).sort()).toEqual(["AuthErrorCode", "AuthPortError"]);
  });

  it("exposes provider-neutral error codes", () => {
    expect(AuthErrorCode).toEqual({
      UNAUTHENTICATED: "AUTH_UNAUTHENTICATED",
      ORGANIZATION_NOT_FOUND: "AUTH_ORGANIZATION_NOT_FOUND",
      INVALID_WEBHOOK_SIGNATURE: "AUTH_INVALID_WEBHOOK_SIGNATURE",
      PROVIDER_FAILURE: "AUTH_PROVIDER_FAILURE",
    });
  });
});
