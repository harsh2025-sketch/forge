import { describe, expect, it } from "vitest";
import { clerkAuthMiddleware, type ClerkSessionClaims } from "../src/middleware.js";
import { makeMiddlewareRequest } from "./helpers.js";

function createVerifier(table: Record<string, ClerkSessionClaims>) {
  return async (token: string): Promise<ClerkSessionClaims> => {
    const claims = table[token];
    if (claims === undefined) {
      throw new Error(`token rejected: ${token}`);
    }
    return claims;
  };
}

const verifier = createVerifier({
  "valid-with-org": { sub: "user_1", org_id: "org_a" },
  "valid-no-org": { sub: "user_1" },
  "valid-versioned-org": { sub: "user_1", o: { id: "org_v2" } },
});

describe("clerkAuthMiddleware — normal behavior", () => {
  it("lets a valid bearer token through", async () => {
    const middleware = clerkAuthMiddleware({ verifySessionToken: verifier });
    const handler = middleware.protect();
    const result = await handler(makeMiddlewareRequest({ authorization: "Bearer valid-with-org" }));
    expect(result).toBeUndefined();
  });

  it("recognizes the versioned organization claim", async () => {
    const middleware = clerkAuthMiddleware({ verifySessionToken: verifier });
    const handler = middleware.protect({ organizationRequired: true });
    const result = await handler(
      makeMiddlewareRequest({ authorization: "Bearer valid-versioned-org" })
    );
    expect(result).toBeUndefined();
  });
});

describe("clerkAuthMiddleware — unauthenticated requests", () => {
  const middleware = clerkAuthMiddleware({ verifySessionToken: verifier });

  it("short-circuits when no authorization header is present", async () => {
    const handler = middleware.protect();
    const result = await handler(makeMiddlewareRequest({}));
    expect(result).toEqual({ status: 401, body: { error: "Unauthenticated" } });
  });

  it("short-circuits a malformed authorization header", async () => {
    const handler = middleware.protect();
    for (const authorization of ["Basic abc123", "Bearer", "Bearer ", ""]) {
      const result = await handler(makeMiddlewareRequest({ authorization }));
      expect(result, authorization).toEqual({ status: 401, body: { error: "Unauthenticated" } });
    }
  });

  it("short-circuits when token verification fails", async () => {
    const handler = middleware.protect();
    const result = await handler(makeMiddlewareRequest({ authorization: "Bearer expired-token" }));
    expect(result).toEqual({ status: 401, body: { error: "Unauthenticated" } });
  });
});

describe("clerkAuthMiddleware — organization requirement", () => {
  const middleware = clerkAuthMiddleware({ verifySessionToken: verifier });

  it("lets a token with an organization claim through", async () => {
    const handler = middleware.protect({ organizationRequired: true });
    const result = await handler(makeMiddlewareRequest({ authorization: "Bearer valid-with-org" }));
    expect(result).toBeUndefined();
  });

  it("short-circuits a token without an organization claim", async () => {
    const handler = middleware.protect({ organizationRequired: true });
    const result = await handler(makeMiddlewareRequest({ authorization: "Bearer valid-no-org" }));
    expect(result).toEqual({ status: 401, body: { error: "Organization required" } });
  });

  it("short-circuits an empty organization claim", async () => {
    const emptyOrgVerifier = createVerifier({ "empty-org": { sub: "user_1", org_id: "" } });
    const emptyOrgMiddleware = clerkAuthMiddleware({ verifySessionToken: emptyOrgVerifier });
    const handler = emptyOrgMiddleware.protect({ organizationRequired: true });
    const result = await handler(makeMiddlewareRequest({ authorization: "Bearer empty-org" }));
    expect(result).toEqual({ status: 401, body: { error: "Organization required" } });
  });
});
