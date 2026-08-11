/**
 * JWT Scanner auth session helpers (V3 §5.2, §11.2).
 *
 * Feature code consumes authentication exclusively through the AuthPort wired
 * in src/providers.ts — never through a vendor SDK. This module provides the
 * product's org-scoped session resolution used by server actions, pages and
 * route handlers:
 *
 *   user  →  organizations (AuthPort)  →  first organization  →  OrgUserContext
 *
 * The organization id returned here is the auth-provider-neutral id that every
 * tenant-scoped database query scopes with `withOrg()`.
 *
 * The optional `onOrganization` hook lets application wiring sync the
 * platform.organizations row (see identity.ts) while keeping this module
 * free of database imports for testability.
 */

import type { AuthOrganization, AuthPort, AuthUser } from "@forge/auth";

/** The authenticated principal plus the organization context for this request. */
export interface OrgUserContext {
  readonly user: AuthUser;
  readonly org: AuthOrganization;
}

/** Resolves the authenticated user and their active organization. */
export async function getOrgUserContext(
  auth: AuthPort,
  onOrganization?: (org: AuthOrganization) => Promise<void>,
): Promise<{ ok: true; value: OrgUserContext } | { ok: false; error: string }> {
  let user: AuthUser;
  try {
    user = await auth.requireUser();
  } catch {
    return { ok: false, error: "Authentication required" };
  }

  let organizations: readonly AuthOrganization[];
  try {
    organizations = await auth.getUserOrganizations(user.id);
  } catch {
    return { ok: false, error: "Failed to resolve organization access" };
  }
  if (organizations.length === 0) {
    return { ok: false, error: "No organization available for this account" };
  }

  const org = organizations[0];
  if (onOrganization !== undefined) {
    try {
      await onOrganization(org);
    } catch {
      // Organization sync is best-effort: the session remains valid even if
      // the platform row could not be written (e.g. transient database
      // failure). Tenant scoping is still enforced per query.
    }
  }
  return { ok: true, value: { user, org } };
}
