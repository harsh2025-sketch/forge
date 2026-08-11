/**
 * JWT Scanner — Zod schema tests (V3 rule 8.3, §20.2 Day 11).
 * Covers happy paths, invalid inputs, and boundary conditions of the frozen
 * scan input/config contracts.
 */

import { describe, expect, it } from "vitest";
import {
  COMPACT_JWT_PARTS,
  MAX_JWT_LENGTH,
  findingCategorySchema,
  jwtHeaderSchema,
  jwtInputSchema,
  jwtPayloadSchema,
  jwtScanConfigSchema,
  jwtTokenSchema,
} from "../schemas.js";
import { JWT_FINDING_CATEGORIES } from "../types.js";

// eyJhbGciOiJIUzI1NiJ9 . eyJzdWIiOiIxMjMifQ . s0m3-s1gn4tur3
const VALID_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.s0m3-s1gn4tur3";

describe("jwtTokenSchema", () => {
  it("accepts a valid compact JWT", () => {
    expect(jwtTokenSchema.safeParse(VALID_TOKEN).success).toBe(true);
  });

  it("accepts a token with empty-ish boundary: minimal segments of length 1", () => {
    expect(jwtTokenSchema.safeParse("a.b.c").success).toBe(true);
  });

  it("rejects non-JWT strings", () => {
    for (const value of ["", "   ", "not-a-jwt", "a.b", "a.b.c.d", "plaintext"]) {
      expect(jwtTokenSchema.safeParse(value).success, JSON.stringify(value)).toBe(false);
    }
  });

  it("rejects empty segments (header.payload.signature each non-empty)", () => {
    for (const value of [".b.c", "a..c", "a.b.", ".."]) {
      expect(jwtTokenSchema.safeParse(value).success, JSON.stringify(value)).toBe(false);
    }
  });

  it("rejects segments outside the base64url alphabet", () => {
    for (const value of [
      "a+b.c.d", // '+' is not base64url
      "a/b.c.d", // '/' is not base64url
      "a=.b.c", // padding '=' is not base64url
      "a.b.c d",
    ]) {
      expect(jwtTokenSchema.safeParse(value).success, JSON.stringify(value)).toBe(false);
    }
  });

  it("trims surrounding whitespace before validation", () => {
    expect(jwtTokenSchema.safeParse(`  ${VALID_TOKEN}  `).success).toBe(true);
  });

  it("rejects tokens longer than the frozen cap", () => {
    const oversized = `${"a".repeat(MAX_JWT_LENGTH - 3)}.b.c`;
    expect(oversized.length).toBe(MAX_JWT_LENGTH + 1);
    expect(jwtTokenSchema.safeParse(oversized).success).toBe(false);
  });

  it("accepts a token exactly at the cap", () => {
    const atCap = `${"a".repeat(MAX_JWT_LENGTH - 4)}.b.c`;
    // length = (MAX-4) + 1 + 1 + 1 + 1 = MAX
    expect(atCap.length).toBe(MAX_JWT_LENGTH);
    expect(jwtTokenSchema.safeParse(atCap).success).toBe(true);
  });

  it("reports a deterministic error message naming the compact format", () => {
    const result = jwtTokenSchema.safeParse("not-a-jwt");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        `exactly ${COMPACT_JWT_PARTS} dot-separated base64url segments`,
      );
    }
  });
});

describe("jwtInputSchema", () => {
  it("accepts a valid scan input", () => {
    const result = jwtInputSchema.safeParse({ token: VALID_TOKEN });
    expect(result.success).toBe(true);
  });

  it("rejects missing, empty, and malformed tokens", () => {
    for (const token of [undefined, "", "abc", "a.b"]) {
      expect(jwtInputSchema.safeParse({ token }).success).toBe(false);
    }
  });

  it("rejects unknown extra keys", () => {
    expect(jwtInputSchema.safeParse({ token: VALID_TOKEN, extra: 1 }).success).toBe(false);
  });
});

describe("jwtScanConfigSchema", () => {
  it("applies the default maxFindings when omitted", () => {
    const result = jwtScanConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.maxFindings).toBe(100);
  });

  it("accepts a positive integer maxFindings", () => {
    expect(jwtScanConfigSchema.safeParse({ maxFindings: 1 }).success).toBe(true);
    expect(jwtScanConfigSchema.safeParse({ maxFindings: 5000 }).success).toBe(true);
  });

  it("rejects invalid maxFindings values", () => {
    for (const maxFindings of [0, -1, 1.5, Number.NaN, "100"]) {
      expect(jwtScanConfigSchema.safeParse({ maxFindings }).success).toBe(false);
    }
  });
});

describe("findingCategorySchema", () => {
  it("accepts exactly the frozen Day-11 categories", () => {
    for (const category of JWT_FINDING_CATEGORIES) {
      expect(findingCategorySchema.safeParse(category).success, category).toBe(true);
    }
    expect(findingCategorySchema.options).toEqual([
      "none_alg",
      "weak_hmac",
      "alg_confusion",
      "expired_claim",
    ]);
  });

  it("rejects unknown categories", () => {
    for (const category of ["", "NONE_ALG", "alg-none", "unknown"]) {
      expect(findingCategorySchema.safeParse(category).success, category).toBe(false);
    }
  });
});

describe("jwtHeaderSchema / jwtPayloadSchema", () => {
  it("requires the alg claim and allows extra header claims", () => {
    expect(jwtHeaderSchema.safeParse({ alg: "none" }).success).toBe(true);
    expect(jwtHeaderSchema.safeParse({ alg: "RS256", kid: "key-1", x5c: ["cert"] }).success).toBe(true);
    expect(jwtHeaderSchema.safeParse({}).success).toBe(false);
    expect(jwtHeaderSchema.safeParse({ alg: "" }).success).toBe(false);
  });

  it("accepts any record payload", () => {
    expect(jwtPayloadSchema.safeParse({}).success).toBe(true);
    expect(jwtPayloadSchema.safeParse({ sub: "user-1", exp: 1700000000, roles: ["admin"] }).success).toBe(true);
    expect(jwtPayloadSchema.safeParse("not-an-object").success).toBe(false);
  });
});
