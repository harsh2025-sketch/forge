/**
 * Clerk → AuthPort adapter.
 * V3 §3.2 (packages/adapters/clerk), §5.2 (AuthPort contract), Day 5.
 * P5 — the Clerk SDK appears only in this package.
 * P12 — this adapter must pass the AuthPort conformance suite.
 *
 * The Clerk client and the session resolver are injected so the adapter is
 * testable without a Clerk account or credentials, and so `providers.ts`
 * remains the only place an adapter is instantiated (Rule Set 2.4).
 */

import { AuthErrorCode, AuthPortError } from "@forge/auth";
import type { AuthOrganization, AuthPort, AuthUser, OrganizationId, UserId } from "@forge/auth";
import { createClerkClient } from "@clerk/backend";

/** Structural view of a Clerk user — only the fields this adapter reads. */
export interface ClerkUserLike {
  readonly id: string;
  readonly firstName?: string | null;
  readonly lastName?: string | null;
  readonly primaryEmailAddressId?: string | null;
  readonly emailAddresses?: ReadonlyArray<{ readonly id: string; readonly emailAddress: string }>;
}

/** Structural view of a Clerk organization — only the fields this adapter reads. */
export interface ClerkOrganizationLike {
  readonly id: string;
  readonly name: string;
  readonly slug?: string | null;
}

/** Structural view of a Clerk organization membership. */
export interface ClerkOrganizationMembershipLike {
  readonly organization: ClerkOrganizationLike;
}

/**
 * The slice of the Clerk backend SDK this adapter uses, expressed
 * structurally so unit tests can inject a fake client. The real
 * `createClerkClient()` result satisfies this interface.
 */
export interface ClerkBackendClient {
  readonly users: {
    getUser(userId: string): Promise<ClerkUserLike>;
    getOrganizationMembershipList(params: {
      userId: string;
      limit?: number;
    }): Promise<{ data: readonly ClerkOrganizationMembershipLike[] }>;
  };
  readonly organizations: {
    getOrganization(params: { organizationId: string }): Promise<ClerkOrganizationLike>;
  };
}

/**
 * Resolves the authenticated principal for the current request context.
 * Product wiring binds this to the framework's auth state (for example the
 * Clerk session resolved by the host application); the adapter itself never
 * reads request state or environment variables.
 */
export interface ClerkSessionResolver {
  getCurrentUserId(): UserId | null | Promise<UserId | null>;
}

/** Options for `clerkAuthAdapter`. */
export interface CreateClerkAuthAdapterOptions {
  readonly client: ClerkBackendClient;
  readonly session: ClerkSessionResolver;
}

/**
 * Creates the real Clerk backend client. Exported here (not from the vendor
 * package directly) so application wiring never imports the vendor SDK
 * itself (P5, Rule Set 3.2).
 */
export function createClerkBackendClient(options: { secretKey: string }): ClerkBackendClient {
  return createClerkClient({ secretKey: options.secretKey });
}

/** Extracts the HTTP status from a vendor error, when it carries one. */
function clerkErrorStatus(error: unknown): number | null {
  if (typeof error === "object" && error !== null) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") {
      return status;
    }
  }
  return null;
}

function toAuthUser(clerkUser: ClerkUserLike): AuthUser {
  const emailAddresses = clerkUser.emailAddresses ?? [];
  const primary =
    emailAddresses.find((entry) => entry.id === clerkUser.primaryEmailAddressId) ??
    emailAddresses[0];
  if (primary === undefined || primary.emailAddress === "") {
    throw new AuthPortError(`Clerk user has no email address: ${clerkUser.id}`, {
      code: AuthErrorCode.PROVIDER_FAILURE,
      details: { userId: clerkUser.id },
    });
  }
  const nameParts = [clerkUser.firstName, clerkUser.lastName].filter(
    (part): part is string => typeof part === "string" && part !== ""
  );
  return {
    id: clerkUser.id,
    email: primary.emailAddress,
    name: nameParts.length > 0 ? nameParts.join(" ") : undefined,
  };
}

function toAuthOrganization(organization: ClerkOrganizationLike): AuthOrganization {
  return {
    id: organization.id,
    name: organization.name,
    slug:
      typeof organization.slug === "string" && organization.slug !== ""
        ? organization.slug
        : undefined,
  };
}

/**
 * Builds the AuthPort implementation backed by Clerk.
 *
 * Error translation: provider failures surface exclusively as
 * `AuthPortError` with `AuthErrorCode` values — Clerk error shapes never
 * leak through the port.
 */
export function clerkAuthAdapter(options: CreateClerkAuthAdapterOptions): AuthPort {
  async function getCurrentUser(): Promise<AuthUser | null> {
    const userId = await options.session.getCurrentUserId();
    if (userId === null || userId === "") {
      return null;
    }
    let clerkUser: ClerkUserLike;
    try {
      clerkUser = await options.client.users.getUser(userId);
    } catch (error) {
      if (clerkErrorStatus(error) === 404) {
        // The session references a user that no longer exists.
        return null;
      }
      throw new AuthPortError(`Clerk user lookup failed: ${userId}`, {
        code: AuthErrorCode.PROVIDER_FAILURE,
        cause: error,
        details: { userId },
      });
    }
    return toAuthUser(clerkUser);
  }

  async function requireUser(): Promise<AuthUser> {
    const user = await getCurrentUser();
    if (user === null) {
      throw new AuthPortError("Unauthorized", { code: AuthErrorCode.UNAUTHENTICATED });
    }
    return user;
  }

  async function getOrganization(orgId: OrganizationId): Promise<AuthOrganization | null> {
    if (orgId === "") {
      return null;
    }
    try {
      const organization = await options.client.organizations.getOrganization({
        organizationId: orgId,
      });
      return toAuthOrganization(organization);
    } catch (error) {
      if (clerkErrorStatus(error) === 404) {
        return null;
      }
      throw new AuthPortError(`Clerk organization lookup failed: ${orgId}`, {
        code: AuthErrorCode.PROVIDER_FAILURE,
        cause: error,
        details: { orgId },
      });
    }
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
    if (userId === "") {
      return [];
    }
    try {
      const response = await options.client.users.getOrganizationMembershipList({
        userId,
        limit: 100,
      });
      return response.data.map((membership) => toAuthOrganization(membership.organization));
    } catch (error) {
      throw new AuthPortError(`Clerk organization membership lookup failed: ${userId}`, {
        code: AuthErrorCode.PROVIDER_FAILURE,
        cause: error,
        details: { userId },
      });
    }
  }

  return { getCurrentUser, requireUser, getOrganization, requireOrganization, getUserOrganizations };
}
