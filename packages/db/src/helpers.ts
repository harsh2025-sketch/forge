/**
 * @forge/db helpers — withOrg / withProduct (V3 §6.4, §11.2 P20).
 *
 * Typed, deterministic, no global state, no repository abstraction (per TASK 005 rules).
 * These helpers produce Drizzle `eq` predicates for tenant/product scoping.
 * Every query on a tenant-scoped or product-scoped table must use them.
 *
 * Only dependencies: @forge/shared (AppError), drizzle-orm, postgres driver types (via drizzle).
 */

import { eq, type AnyColumn, type SQL } from "drizzle-orm";
import { AppError } from "@forge/shared";

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class DbError extends AppError {
  constructor(message: string, options?: { cause?: unknown; details?: unknown }) {
    super(message, {
      code: "DB_ERROR",
      cause: options?.cause,
      details: options?.details,
    });
    this.name = "DbError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isDbError(error: unknown): error is DbError {
  return error instanceof DbError;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function assertNonEmptyId(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new DbError(`Invalid ${field}: expected a non-empty string`, {
      details: { field },
    });
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new DbError(`Invalid ${field}: expected a non-empty string`, {
      details: { field },
    });
  }
  return trimmed;
}

function assertColumn(value: unknown, label: string): AnyColumn {
  if (
    value === null ||
    value === undefined ||
    typeof value !== "object" ||
    !("name" in (value as Record<string, unknown>))
  ) {
    // drizzle columns are objects with .name; allow loose check but give deterministic error
    throw new DbError(`Invalid ${label}: expected a Drizzle column reference`, {
      details: { label },
    });
  }
  return value as AnyColumn;
}

// ---------------------------------------------------------------------------
// withOrg / withProduct
// ---------------------------------------------------------------------------

/**
 * Creates a Drizzle predicate `column = organizationId` for tenant isolation.
 *
 * Deterministic: same column + id → same SQL. No mutation, no global state.
 * Throws DbError on empty/invalid organizationId or invalid column.
 *
 * @example
 * db.select().from(organizationMembers).where(withOrg(organizationMembers.organizationId, orgId))
 * db.select().from(subscriptions).where(withOrg(subscriptions.organizationId, orgId))
 */
export function withOrg(column: AnyColumn, organizationId: string): SQL<unknown> {
  const col = assertColumn(column, "column");
  const id = assertNonEmptyId(organizationId, "organizationId");
  return eq(col, id);
}

/**
 * Creates a Drizzle predicate `column = productId` for product separability (P20).
 *
 * Deterministic: same column + id → same SQL. No mutation, no global state.
 * Throws DbError on empty/invalid productId or invalid column.
 *
 * @example
 * db.select().from(usageRecords).where(withProduct(usageRecords.productId, productId))
 * db.select().from(auditEvents).where(withProduct(auditEvents.productId, productId))
 */
export function withProduct(column: AnyColumn, productId: string): SQL<unknown> {
  const col = assertColumn(column, "column");
  const id = assertNonEmptyId(productId, "productId");
  return eq(col, id);
}

// ---------------------------------------------------------------------------
// Convenience object helpers (for callers that prefer plain filter objects)
// ---------------------------------------------------------------------------

/**
 * Returns a plain filter object `{ organization_id: id }` for non-Drizzle contexts
 * (e.g., in-memory tests, logging). Validates id. Does not mutate.
 */
export function toOrgFilter(organizationId: string): { organization_id: string } {
  const id = assertNonEmptyId(organizationId, "organizationId");
  return { organization_id: id };
}

/**
 * Returns a plain filter object `{ product_id: id }` for non-Drizzle contexts.
 */
export function toProductFilter(productId: string): { product_id: string } {
  const id = assertNonEmptyId(productId, "productId");
  return { product_id: id };
}
