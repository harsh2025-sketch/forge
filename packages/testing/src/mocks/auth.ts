/**
 * Mock auth adapters — real behavioral in-memory implementations of AuthPort,
 * AuthMiddleware and AuthWebhookHandler. V3 §3.2 (packages/testing/src/mocks/),
 * Day 5. No vendor code: these mocks exist to exercise conformance suites and
 * product tests without any auth provider.
 */

import {
  AuthErrorCode,
  AuthPortError,
  type AuthMiddleware,
  type AuthMiddlewareHandler,
  type AuthMiddlewareRequest,
  type AuthOrganization,
  type AuthPort,
  type AuthProtectOptions,
  type AuthUser,
  type AuthWebhookHandler,
  type OrganizationId,
  type UserId,
} from "@forge/auth";

/** Configuration shared by the mock auth adapters. */
export interface MockAuthOptions {
  /** The principal `getCurrentUser()` resolves. `null` means unauthenticated. */
  readonly currentUser?: AuthUser | null;
  /** Known organizations, addressable by id. */
  readonly organizations?: readonly AuthOrganization[];
  /** Organization ids per principal. Principals not listed belong to none. */
  readonly memberships?: Readonly<Record<UserId, readonly OrganizationId[]>>;
  /** Secret the mock webhook handler expects in `x-mock-signature`. */
  readonly webhookSecret?: string;
}

/** An event recorded by the mock webhook handler. */
export interface MockAuthEvent {
  readonly type: "user.created" | "user.updated" | "organization.created";
  readonly user?: AuthUser;
  readonly organization?: AuthOrganization;
}

/** Response a protected mock middleware returns when it short-circuits. */
export interface MockAuthMiddlewareResponse {
  readonly status: 401;
  readonly body: { readonly error: string };
}

interface MockAuthState {
  readonly currentUser: AuthUser | null;
  readonly organizations: readonly AuthOrganization[];
  readonly memberships: Readonly<Record<UserId, readonly OrganizationId[]>>;
  readonly webhookSecret: string;
}

function resolveState(options?: MockAuthOptions): MockAuthState {
  return {
    currentUser: options?.currentUser ?? null,
    organizations: options?.organizations ?? [],
    memberships: options?.memberships ?? {},
    webhookSecret: options?.webhookSecret ?? "mock_auth_secret",
  };
}

function organizationsOf(
  state: MockAuthState,
  userId: UserId
): readonly AuthOrganization[] {
  const ids = state.memberships[userId] ?? [];
  return state.organizations.filter((organization) => ids.includes(organization.id));
}

/** Creates an in-memory AuthPort over the given state. */
export function createMockAuthPort(options?: MockAuthOptions): AuthPort {
  const state = resolveState(options);

  async function getCurrentUser(): Promise<AuthUser | null> {
    return state.currentUser;
  }

  async function requireUser(): Promise<AuthUser> {
    const user = await getCurrentUser();
    if (user === null) {
      throw new AuthPortError("Unauthorized", { code: AuthErrorCode.UNAUTHENTICATED });
    }
    return user;
  }

  async function getOrganization(orgId: OrganizationId): Promise<AuthOrganization | null> {
    return state.organizations.find((organization) => organization.id === orgId) ?? null;
  }

  async function requireOrganization(orgId: OrganizationId): Promise<AuthOrganization> {
    const organization = await getOrganization(orgId);
    if (organization === null) {
      throw new AuthPortError(`Organization not found: ${orgId}`, {
        code: AuthErrorCode.ORGANIZATION_NOT_FOUND,
        details: { orgId },
      });
    }
    return organization;
  }

  async function getUserOrganizations(userId: UserId): Promise<readonly AuthOrganization[]> {
    return organizationsOf(state, userId);
  }

  return { getCurrentUser, requireUser, getOrganization, requireOrganization, getUserOrganizations };
}

/**
 * Creates an in-memory AuthMiddleware. Requests authenticate by presenting
 * `authorization: Bearer <userId>` for a known principal; organization
 * protection checks the principal's memberships.
 */
export function createMockAuthMiddleware(
  options?: MockAuthOptions
): AuthMiddleware<AuthMiddlewareRequest, MockAuthMiddlewareResponse> {
  const state = resolveState(options);
  const knownUserIds = new Set<UserId>([
    ...(state.currentUser !== null ? [state.currentUser.id] : []),
    ...Object.keys(state.memberships),
  ]);

  function unauthorized(error: string): MockAuthMiddlewareResponse {
    return { status: 401, body: { error } };
  }

  const protect = (
    protectOptions?: AuthProtectOptions
  ): AuthMiddlewareHandler<AuthMiddlewareRequest, MockAuthMiddlewareResponse> => {
    return (request) => {
      const header = request.headers.get("authorization");
      const userId =
        header !== null && header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
      if (userId === null || userId === "" || !knownUserIds.has(userId)) {
        return unauthorized("Unauthenticated");
      }
      if (protectOptions?.organizationRequired === true && organizationsOf(state, userId).length === 0) {
        return unauthorized("Organization required");
      }
      return undefined;
    };
  };

  return { protect };
}

/**
 * Creates an in-memory AuthWebhookHandler. Signature verification expects the
 * configured secret in the `x-mock-signature` header; verified payloads are
 * validated, normalized and recorded in `events`.
 */
export function createMockAuthWebhookHandler(
  options?: MockAuthOptions
): AuthWebhookHandler & { readonly events: readonly MockAuthEvent[] } {
  const state = resolveState(options);
  const events: MockAuthEvent[] = [];

  function toUser(data: Record<string, unknown>, eventType: string): AuthUser {
    const id = data.id;
    const email = data.email;
    if (typeof id !== "string" || id === "" || typeof email !== "string" || email === "") {
      throw new AuthPortError(`Invalid ${eventType} payload: missing user id or email`, {
        code: AuthErrorCode.PROVIDER_FAILURE,
      });
    }
    return { id, email, name: typeof data.name === "string" && data.name !== "" ? data.name : undefined };
  }

  function toOrganization(data: Record<string, unknown>, eventType: string): AuthOrganization {
    const id = data.id;
    const name = data.name;
    if (typeof id !== "string" || id === "" || typeof name !== "string" || name === "") {
      throw new AuthPortError(`Invalid ${eventType} payload: missing organization id or name`, {
        code: AuthErrorCode.PROVIDER_FAILURE,
      });
    }
    return { id, name, slug: typeof data.slug === "string" && data.slug !== "" ? data.slug : undefined };
  }

  function parseEvent(payload: unknown, expectedType: string): Record<string, unknown> {
    if (typeof payload !== "object" || payload === null) {
      throw new AuthPortError(`Expected a ${expectedType} event payload`, {
        code: AuthErrorCode.PROVIDER_FAILURE,
      });
    }
    const event = payload as Record<string, unknown>;
    if (event.type !== expectedType) {
      throw new AuthPortError(`Unexpected event type: expected ${expectedType}`, {
        code: AuthErrorCode.PROVIDER_FAILURE,
      });
    }
    if (typeof event.data !== "object" || event.data === null) {
      throw new AuthPortError(`Malformed ${expectedType} event data`, {
        code: AuthErrorCode.PROVIDER_FAILURE,
      });
    }
    return event.data as Record<string, unknown>;
  }

  const handler: AuthWebhookHandler = {
    async verifyWebhookSignature(request) {
      const signature = request.headers.get("x-mock-signature");
      if (signature === null || signature !== state.webhookSecret) {
        throw new AuthPortError("Invalid webhook signature", {
          code: AuthErrorCode.INVALID_WEBHOOK_SIGNATURE,
        });
      }
      const body = await request.text();
      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch (error) {
        throw new AuthPortError("Webhook body is not valid JSON", {
          code: AuthErrorCode.INVALID_WEBHOOK_SIGNATURE,
          cause: error,
        });
      }
      if (typeof payload !== "object" || payload === null) {
        throw new AuthPortError("Webhook payload must be an object", {
          code: AuthErrorCode.INVALID_WEBHOOK_SIGNATURE,
        });
      }
      return payload;
    },

    async handleUserCreated(payload) {
      const data = parseEvent(payload, "user.created");
      events.push({ type: "user.created", user: toUser(data, "user.created") });
    },

    async handleUserUpdated(payload) {
      const data = parseEvent(payload, "user.updated");
      events.push({ type: "user.updated", user: toUser(data, "user.updated") });
    },

    async handleOrganizationCreated(payload) {
      const data = parseEvent(payload, "organization.created");
      events.push({ type: "organization.created", organization: toOrganization(data, "organization.created") });
    },
  };

  return Object.assign(handler, { events });
}
