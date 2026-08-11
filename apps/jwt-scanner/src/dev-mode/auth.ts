/**
 * JWT Scanner deterministic test-mode seam — auth (AUTH_MODE=test).
 *
 * A product-local implementation of the existing AuthPort contract used ONLY
 * for deterministic local/test application runs (E2E, local preview). It is
 * the runtime counterpart of the @forge/testing mocks, which remain the
 * canonical implementations for the test suite — this seam exists because
 * @forge/testing is a dev-only package and cannot be bundled into the
 * application's runtime composition root.
 *
 * It is not a new authentication abstraction: it implements the frozen
 * AuthPort interface and is selected exclusively in src/providers.ts when
 * AUTH_MODE=test. Live mode always uses the Clerk adapter.
 */

import { AuthErrorCode, AuthPortError } from "@forge/auth";
import type { AuthOrganization, AuthPort, AuthUser, OrganizationId, UserId } from "@forge/auth";

export interface DevAuthState {
  readonly currentUser: AuthUser | null;
  readonly organizations: readonly AuthOrganization[];
  readonly memberships: Readonly<Record<UserId, readonly OrganizationId[]>>;
}

/** Default deterministic state: one signed-in user in one organization. */
export function defaultDevAuthState(): DevAuthState {
  return {
    currentUser: {
      id: "user_dev_0001",
      email: "scanner@example.test",
      name: "Test Scanner",
    },
    organizations: [{ id: "org_dev_0001", name: "Test Organization" }],
    memberships: { user_dev_0001: ["org_dev_0001"] },
  };
}

export function createDevAuthPort(state: DevAuthState = defaultDevAuthState()): AuthPort {
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
    if (orgId === "") return null;
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
    const ids = state.memberships[userId] ?? [];
    return state.organizations.filter((organization) => ids.includes(organization.id));
  }

  return { getCurrentUser, requireUser, getOrganization, requireOrganization, getUserOrganizations };
}
