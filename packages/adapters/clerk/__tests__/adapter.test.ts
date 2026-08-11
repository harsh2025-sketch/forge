import { describe, expect, it } from "vitest";
import { AuthErrorCode, AuthPortError, type AuthOrganization, type AuthUser } from "@forge/auth";
import { isAppError } from "@forge/shared";
import { clerkAuthAdapter, type ClerkSessionResolver, type ClerkUserLike } from "../src/adapter.js";
import { FakeClerkApiError, createFakeClerkClient } from "./helpers.js";

const user: AuthUser = { id: "user_1", email: "ada@example.test", name: "Ada Lovelace" };
const orgA: AuthOrganization = { id: "org_a", name: "Org A", slug: "org-a" };
const orgB: AuthOrganization = { id: "org_b", name: "Org B" };

const clerkUser: ClerkUserLike = {
  id: user.id,
  firstName: "Ada",
  lastName: "Lovelace",
  primaryEmailAddressId: "email_primary",
  emailAddresses: [
    { id: "email_other", emailAddress: "secondary@example.test" },
    { id: "email_primary", emailAddress: user.email },
  ],
};

function sessionResolver(userId: string | null): ClerkSessionResolver {
  return { getCurrentUserId: () => userId };
}

describe("clerkAuthAdapter — normal behavior", () => {
  it("resolves the current user mapped to the port shape", async () => {
    const client = createFakeClerkClient({ users: new Map([[user.id, clerkUser]]) });
    const adapter = clerkAuthAdapter({ client, session: sessionResolver(user.id) });

    await expect(adapter.getCurrentUser()).resolves.toEqual(user);
    await expect(adapter.requireUser()).resolves.toEqual(user);
  });

  it("prefers the primary email address over other addresses", async () => {
    const client = createFakeClerkClient({ users: new Map([[user.id, clerkUser]]) });
    const adapter = clerkAuthAdapter({ client, session: sessionResolver(user.id) });
    const resolved = await adapter.getCurrentUser();
    expect(resolved?.email).toBe("ada@example.test");
  });

  it("resolves organizations", async () => {
    const client = createFakeClerkClient({
      users: new Map([[user.id, clerkUser]]),
      organizations: new Map([
        [orgA.id, { id: orgA.id, name: orgA.name, slug: "org-a" }],
        [orgB.id, { id: orgB.id, name: orgB.name, slug: "" }],
      ]),
    });
    const adapter = clerkAuthAdapter({ client, session: sessionResolver(user.id) });

    await expect(adapter.getOrganization("org_a")).resolves.toEqual(orgA);
    // Empty Clerk slug maps to an absent slug.
    await expect(adapter.getOrganization("org_b")).resolves.toEqual(orgB);
    await expect(adapter.requireOrganization("org_a")).resolves.toEqual(orgA);
  });

  it("resolves the user's organization memberships", async () => {
    const client = createFakeClerkClient({
      memberships: new Map([[user.id, [{ id: orgA.id, name: orgA.name, slug: "org-a" }]]]),
    });
    const adapter = clerkAuthAdapter({ client, session: sessionResolver(user.id) });

    await expect(adapter.getUserOrganizations(user.id)).resolves.toEqual([orgA]);
  });
});

describe("clerkAuthAdapter — edge cases", () => {
  it("resolves null when the session has no principal", async () => {
    const client = createFakeClerkClient({});
    const adapter = clerkAuthAdapter({ client, session: sessionResolver(null) });
    await expect(adapter.getCurrentUser()).resolves.toBeNull();
  });

  it("resolves null when the session principal id is empty", async () => {
    const client = createFakeClerkClient({});
    const adapter = clerkAuthAdapter({ client, session: sessionResolver("") });
    await expect(adapter.getCurrentUser()).resolves.toBeNull();
  });

  it("resolves null when the session references a deleted user (Clerk 404)", async () => {
    const client = createFakeClerkClient({ users: new Map() });
    const adapter = clerkAuthAdapter({ client, session: sessionResolver("user_deleted") });
    await expect(adapter.getCurrentUser()).resolves.toBeNull();
  });

  it("resolves null for an unknown organization (Clerk 404)", async () => {
    const client = createFakeClerkClient({ organizations: new Map() });
    const adapter = clerkAuthAdapter({ client, session: sessionResolver(user.id) });
    await expect(adapter.getOrganization("org_missing")).resolves.toBeNull();
  });

  it("resolves null for an empty organization id without calling the provider", async () => {
    const client = createFakeClerkClient({ failWith: { status: 500 } });
    const adapter = clerkAuthAdapter({ client, session: sessionResolver(user.id) });
    await expect(adapter.getOrganization("")).resolves.toBeNull();
  });

  it("resolves empty memberships for an empty user id", async () => {
    const client = createFakeClerkClient({ failWith: { status: 500 } });
    const adapter = clerkAuthAdapter({ client, session: sessionResolver(user.id) });
    await expect(adapter.getUserOrganizations("")).resolves.toEqual([]);
  });

  it("maps a partial user response without a name", async () => {
    const partial: ClerkUserLike = {
      id: "user_partial",
      firstName: null,
      lastName: null,
      primaryEmailAddressId: null,
      emailAddresses: [{ id: "email_1", emailAddress: "partial@example.test" }],
    };
    const client = createFakeClerkClient({ users: new Map([["user_partial", partial]]) });
    const adapter = clerkAuthAdapter({ client, session: sessionResolver("user_partial") });

    await expect(adapter.getCurrentUser()).resolves.toEqual({
      id: "user_partial",
      email: "partial@example.test",
      name: undefined,
    });
  });

  it("resolves empty membership lists", async () => {
    const client = createFakeClerkClient({ memberships: new Map() });
    const adapter = clerkAuthAdapter({ client, session: sessionResolver(user.id) });
    await expect(adapter.getUserOrganizations(user.id)).resolves.toEqual([]);
  });
});

describe("clerkAuthAdapter — invalid provider responses", () => {
  it("fails with PROVIDER_FAILURE when the Clerk user has no email address", async () => {
    const noEmail: ClerkUserLike = { id: "user_noemail", emailAddresses: [] };
    const client = createFakeClerkClient({ users: new Map([["user_noemail", noEmail]]) });
    const adapter = clerkAuthAdapter({ client, session: sessionResolver("user_noemail") });

    const error = await adapter.getCurrentUser().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AuthPortError);
    expect((error as AuthPortError).code).toBe(AuthErrorCode.PROVIDER_FAILURE);
    expect((error as AuthPortError).details).toEqual({ userId: "user_noemail" });
  });
});

describe("clerkAuthAdapter — failure translation", () => {
  it("translates provider failures on user lookup to PROVIDER_FAILURE with cause", async () => {
    const client = createFakeClerkClient({ failWith: { status: 503, message: "upstream down" } });
    const adapter = clerkAuthAdapter({ client, session: sessionResolver(user.id) });

    const error = await adapter.getCurrentUser().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AuthPortError);
    expect(isAppError(error)).toBe(true);
    expect((error as AuthPortError).code).toBe(AuthErrorCode.PROVIDER_FAILURE);
    expect((error as AuthPortError).cause).toBeInstanceOf(FakeClerkApiError);
    expect((error as AuthPortError).details).toEqual({ userId: user.id });
  });

  it("rejects requireUser with AUTH_UNAUTHENTICATED when there is no principal", async () => {
    const client = createFakeClerkClient({});
    const adapter = clerkAuthAdapter({ client, session: sessionResolver(null) });

    const error = await adapter.requireUser().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AuthPortError);
    expect((error as AuthPortError).code).toBe(AuthErrorCode.UNAUTHENTICATED);
  });

  it("rejects requireOrganization with AUTH_ORGANIZATION_NOT_FOUND for unknown orgs", async () => {
    const client = createFakeClerkClient({ organizations: new Map() });
    const adapter = clerkAuthAdapter({ client, session: sessionResolver(user.id) });

    const error = await adapter.requireOrganization("org_missing").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AuthPortError);
    expect((error as AuthPortError).code).toBe(AuthErrorCode.ORGANIZATION_NOT_FOUND);
    expect((error as AuthPortError).details).toEqual({ orgId: "org_missing" });
  });

  it("translates organization lookup failures to PROVIDER_FAILURE", async () => {
    const client = createFakeClerkClient({ failWith: { status: 500 } });
    const adapter = clerkAuthAdapter({ client, session: sessionResolver(user.id) });

    const error = await adapter.getOrganization("org_a").catch((caught: unknown) => caught);
    expect((error as AuthPortError).code).toBe(AuthErrorCode.PROVIDER_FAILURE);
  });

  it("translates membership lookup failures to PROVIDER_FAILURE", async () => {
    const client = createFakeClerkClient({ failWith: { status: 500 } });
    const adapter = clerkAuthAdapter({ client, session: sessionResolver(user.id) });

    const error = await adapter.getUserOrganizations(user.id).catch((caught: unknown) => caught);
    expect((error as AuthPortError).code).toBe(AuthErrorCode.PROVIDER_FAILURE);
    expect((error as AuthPortError).details).toEqual({ userId: user.id });
  });
});
