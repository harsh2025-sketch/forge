import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { uuid, varchar, pgSchema } from "drizzle-orm/pg-core";
import {
  withOrg,
  withProduct,
  toOrgFilter,
  toProductFilter,
  DbError,
  isDbError,
} from "../helpers.js";

// Minimal test schema for helper validation — uses same pgSchema pattern as platform
const testSchema = pgSchema("platform");
const testTable = testSchema.table("test_table", {
  id: uuid("id").primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  productId: uuid("product_id").notNull(),
  name: varchar("name", { length: 100 }),
});

describe("withOrg", () => {
  it("returns a Drizzle SQL predicate for valid organizationId", () => {
    const predicate = withOrg(testTable.organizationId, "org-123");
    expect(predicate).toBeDefined();
    // predicate should be an SQL object produced by eq()
    expect(typeof predicate).toBe("object");
  });

  it("is deterministic — same inputs produce equivalent SQL", () => {
    const a = withOrg(testTable.organizationId, "org-abc");
    const b = withOrg(testTable.organizationId, "org-abc");
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    const ref = eq(testTable.organizationId, "org-abc");
    // Drizzle SQL objects are structurally equal for same inputs
    expect(a).toEqual(ref);
    expect(b).toEqual(ref);
    expect(a).toEqual(b);
  });

  it("produces different predicates for different organizationIds", () => {
    const a = withOrg(testTable.organizationId, "org-1");
    const b = withOrg(testTable.organizationId, "org-2");
    expect(a).not.toEqual(b);
  });

  it("throws DbError for empty organizationId", () => {
    expect(() => withOrg(testTable.organizationId, "")).toThrow(DbError);
    expect(() => withOrg(testTable.organizationId, "   ")).toThrow(DbError);
  });

  it("throws DbError for non-string organizationId", () => {
    // @ts-expect-error -- testing runtime validation
    expect(() => withOrg(testTable.organizationId, null)).toThrow(DbError);
    // @ts-expect-error -- expected error
    expect(() => withOrg(testTable.organizationId, 123)).toThrow(DbError);
    // @ts-expect-error -- expected error
    expect(() => withOrg(testTable.organizationId, undefined)).toThrow(DbError);
  });

  it("throws DbError for invalid column", () => {
    // @ts-expect-error -- expected error
    expect(() => withOrg(null as unknown as never, "org-123")).toThrow(DbError);
    // @ts-expect-error -- expected error
    expect(() => withOrg(undefined as unknown as never, "org-123")).toThrow(DbError);
    // @ts-expect-error -- expected error
    expect(() => withOrg("not-a-column" as unknown as never, "org-123")).toThrow(DbError);
  });

  it("trims whitespace but preserves id value in predicate", () => {
    const withTrim = withOrg(testTable.organizationId, "  org-trim  ");
    const withoutTrim = withOrg(testTable.organizationId, "org-trim");
    expect(withTrim).toEqual(withoutTrim);
  });

  it("is typed — throws DbError with field details for debugging (no secret leakage)", () => {
    try {
      withOrg(testTable.organizationId, "");
    } catch (e) {
      expect(isDbError(e)).toBe(true);
      expect((e as DbError).code).toBe("DB_ERROR");
      expect((e as DbError).message).not.toContain("secret");
    }
  });
});

describe("withProduct", () => {
  it("returns a Drizzle SQL predicate for valid productId", () => {
    const predicate = withProduct(testTable.productId, "prod-123");
    expect(predicate).toBeDefined();
    expect(typeof predicate).toBe("object");
  });

  it("is deterministic — same inputs produce equivalent SQL", () => {
    const a = withProduct(testTable.productId, "prod-abc");
    const b = withProduct(testTable.productId, "prod-abc");
    const ref = eq(testTable.productId, "prod-abc");
    expect(a).toEqual(ref);
    expect(b).toEqual(ref);
    expect(a).toEqual(b);
  });

  it("produces different predicates for different productIds", () => {
    const a = withProduct(testTable.productId, "prod-1");
    const b = withProduct(testTable.productId, "prod-2");
    expect(a).not.toEqual(b);
  });

  it("throws DbError for empty productId", () => {
    expect(() => withProduct(testTable.productId, "")).toThrow(DbError);
    expect(() => withProduct(testTable.productId, "  ")).toThrow(DbError);
  });

  it("throws DbError for non-string productId", () => {
    // @ts-expect-error -- expected error
    expect(() => withProduct(testTable.productId, null)).toThrow(DbError);
    // @ts-expect-error -- expected error
    expect(() => withProduct(testTable.productId, 123)).toThrow(DbError);
  });

  it("throws DbError for invalid column", () => {
    // @ts-expect-error -- expected error
    expect(() => withProduct(null as unknown as never, "prod-123")).toThrow(DbError);
  });

  it("trims whitespace", () => {
    const a = withProduct(testTable.productId, "  prod-trim ");
    const b = withProduct(testTable.productId, "prod-trim");
    expect(a).toEqual(b);
  });

  it("does not mutate global state", () => {
    const before = withProduct(testTable.productId, "p1");
    withProduct(testTable.productId, "p2");
    const after = withProduct(testTable.productId, "p1");
    expect(before).toEqual(after);
  });
});

describe("toOrgFilter / toProductFilter (plain object helpers)", () => {
  it("toOrgFilter returns correct filter object", () => {
    expect(toOrgFilter("org-xyz")).toEqual({ organization_id: "org-xyz" });
  });

  it("toProductFilter returns correct filter object", () => {
    expect(toProductFilter("prod-xyz")).toEqual({ product_id: "prod-xyz" });
  });

  it("toOrgFilter trims and validates", () => {
    expect(toOrgFilter("  org-1  ")).toEqual({ organization_id: "org-1" });
    expect(() => toOrgFilter("")).toThrow(DbError);
    expect(() => toOrgFilter("  ")).toThrow(DbError);
  });

  it("toProductFilter validates", () => {
    expect(() => toProductFilter("")).toThrow(DbError);
    // @ts-expect-error -- expected error
    expect(() => toProductFilter(null)).toThrow(DbError);
  });

  it("helpers do not share mutable state", () => {
    const a = toOrgFilter("org-a");
    const b = toOrgFilter("org-b");
    expect(a.organization_id).toBe("org-a");
    expect(b.organization_id).toBe("org-b");
    // Mutating a should not affect b (shallow copy)
    (a as unknown as Record<string, string>).organization_id = "mutated";
    expect(toOrgFilter("org-a").organization_id).toBe("org-a");
  });
});

describe("DbError", () => {
  it("is instance of AppError and Error", () => {
    const err = new DbError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("DbError");
    expect(err.code).toBe("DB_ERROR");
  });

  it("isDbError type guard works", () => {
    expect(isDbError(new DbError("x"))).toBe(true);
    expect(isDbError(new Error("x"))).toBe(false);
    expect(isDbError(null)).toBe(false);
  });
});
