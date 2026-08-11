/**
 * Platform identity sync for JWT Scanner (V3 §6.3, §6.4, P20).
 *
 * The auth port returns provider-neutral identifiers (Clerk-style ids such as
 * `org_2abc...` / `user_2abc...`), while the shared platform tables
 * (platform.organizations, platform.users) are keyed by UUID. This module
 * bridges the two with a deterministic, idempotent mapping so that
 * tenant-scoped product tables can hold valid foreign keys to
 * platform.organizations.id without a schema change and without an external
 * identity registry:
 *
 *   platform id = UUIDv5(namespace, auth id)
 *
 * The same auth id always maps to the same platform id, in every environment.
 * Rows are upserted on first use (on-demand sync); production deployments may
 * additionally sync identities through the Clerk webhook (docs/PROVIDERS.md).
 *
 * This is feature-layer code (not domain): it touches the database and the
 * auth port and must never be imported by src/domain.
 */

import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { organizations, users, organizationMembers } from "@forge/db";
import type { AuthOrganization, AuthUser } from "@forge/auth";
import { getDb } from "@/db/client";

/** Product namespace (fixed constant) used for deterministic id derivation. */
const IDENTITY_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"; // DNS namespace UUIDv4-style (fixed)

/**
 * Derives a platform UUID from an auth-provider identifier. Deterministic:
 * identical input always yields the same UUID (RFC 4122 version 5, SHA-1).
 */
export function platformIdForAuthId(kind: "user" | "organization", authId: string): string {
  const name = `${kind}:${authId}`;
  const hash = createHash("sha1")
    .update(IDENTITY_NAMESPACE)
    .update(name)
    .digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8]! & 0x3f) | 0x80; // variant 10xx
  const hex = hash.subarray(0, 16).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/**
 * The platform UUID used as the tenant key in every tenant-scoped product
 * table (projects.organization_id, analysis_jobs.organization_id, ...).
 * Derived deterministically from the auth-provider organization id, so the
 * same organization always maps to the same platform id in every environment.
 */
export function platformOrganizationId(authOrgId: string): string {
  return platformIdForAuthId("organization", authOrgId);
}

/** The platform UUID used for platform.users rows (deterministic mapping). */
export function platformUserId(authUserId: string): string {
  return platformIdForAuthId("user", authUserId);
}

/** Upserts the platform.organizations row for an auth organization (idempotent). */
export async function ensurePlatformOrganization(org: AuthOrganization): Promise<void> {
  const db = getDb();
  await db
    .insert(organizations)
    .values({
      id: platformIdForAuthId("organization", org.id),
      name: org.name,
      slug: org.slug ?? `org-${org.id}`,
    })
    .onConflictDoUpdate({
      target: organizations.id,
      set: { name: org.name, updatedAt: new Date() },
    });
}

/** Upserts the platform.users row for an auth user (idempotent). */
export async function ensurePlatformUser(user: AuthUser): Promise<void> {
  const db = getDb();
  await db
    .insert(users)
    .values({
      id: platformIdForAuthId("user", user.id),
      email: user.email,
      displayName: user.name,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { displayName: user.name, updatedAt: new Date() },
    });
}

/** Records an organization membership (idempotent, no-op when it already exists). */
export async function ensurePlatformMembership(
  user: AuthUser,
  org: AuthOrganization,
): Promise<void> {
  const db = getDb();
  const userId = platformIdForAuthId("user", user.id);
  const organizationId = platformIdForAuthId("organization", org.id);
  const existing = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId),
      ),
    )
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(organizationMembers).values({
    organizationId,
    userId,
    role: "member",
  });
}
