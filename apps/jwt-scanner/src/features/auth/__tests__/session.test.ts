/**
 * Auth session tests (V3 §5.2, §11.2, Day 13).
 *
 * Verifies the org-scoped session resolution: unauthenticated access is
 * denied, authenticated access succeeds, and organization context is
 * respected (a principal without an organization cannot use the product).
 */

import { describe, expect, it } from "vitest";
import { getOrgUserContext } from "../session.js";
import {
  anonymousAuthPort,
  foreignAuthPort,
  testAuthPort,
  TEST_ORG,
} from "@/__tests__/test-utils.js";

describe("getOrgUserContext", () => {
  it("denies unauthenticated access", async () => {
    const result = await getOrgUserContext(anonymousAuthPort());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Authentication required");
    }
  });

  it("grants authenticated access with the resolved organization", async () => {
    const result = await getOrgUserContext(testAuthPort());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.user.email).toBe("scanner@example.test");
      expect(result.value.org.id).toBe(TEST_ORG.id);
    }
  });

  it("respects organization context (first membership wins)", async () => {
    const result = await getOrgUserContext(foreignAuthPort());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.org.id).not.toBe(TEST_ORG.id);
    }
  });

  it("denies principals without an organization", async () => {
    // A user with no memberships has no organization context.
    const { createMockAuthPort, makeAuthUser } = await import("@forge/testing");
    const user = makeAuthUser({ id: "user_orgless" });
    const auth = createMockAuthPort({
      currentUser: user,
      organizations: [],
      memberships: {},
    });
    const result = await getOrgUserContext(auth);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("No organization available for this account");
    }
  });

  it("invokes the organization sync hook with the resolved org", async () => {
    const synced: string[] = [];
    const result = await getOrgUserContext(testAuthPort(), async (org) => {
      synced.push(org.id);
    });
    expect(result.ok).toBe(true);
    expect(synced).toEqual([TEST_ORG.id]);
  });

  it("still succeeds when the organization sync hook fails", async () => {
    const result = await getOrgUserContext(testAuthPort(), async () => {
      throw new Error("db down");
    });
    expect(result.ok).toBe(true);
  });
});
