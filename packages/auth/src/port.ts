/**
 * AuthPort — authentication capability contract.
 * V3 §5.2. Implemented by adapters only; never by this package.
 */

import type { AuthOrganization, AuthUser, OrganizationId, UserId } from "./types.js";

export interface AuthPort {
  /** Returns the authenticated principal, or `null` when there is none. */
  getCurrentUser(): Promise<AuthUser | null>;

  /**
   * Returns the authenticated principal.
   * Throws `AuthPortError` with code `AUTH_UNAUTHENTICATED` when there is none.
   */
  requireUser(): Promise<AuthUser>;

  /** Returns the organization, or `null` when it does not exist. */
  getOrganization(orgId: OrganizationId): Promise<AuthOrganization | null>;

  /**
   * Returns the organization.
   * Throws `AuthPortError` with code `AUTH_ORGANIZATION_NOT_FOUND` when it does not exist.
   */
  requireOrganization(orgId: OrganizationId): Promise<AuthOrganization>;

  /** Returns every organization the given principal belongs to. */
  getUserOrganizations(userId: UserId): Promise<readonly AuthOrganization[]>;
}
