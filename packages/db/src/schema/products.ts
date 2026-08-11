/**
 * platform.products — Product registry (V3 §6.3, P20 anchor).
 *
 * Small, shared table that makes usage_records and audit_events extractable
 * per product. Every row in those tables carries product_id FK → products.id.
 *
 * Classification: globally shared (A) but the anchor for separability.
 * Exported platform schema instance is shared by all other schema files.
 */

import { pgSchema, uuid, varchar, timestamp } from "drizzle-orm/pg-core";

/**
 * Named PostgreSQL schema 'platform' per V3 §6.2, §6.3, P8.
 * Every platform table lives here. Products own their own named schema elsewhere
 * (not in this package — see §6.4).
 */
export const platform = pgSchema("platform");

export const products = platform.table("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  displayName: varchar("display_name", { length: 200 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ProductRow = typeof products.$inferSelect;
export type NewProductRow = typeof products.$inferInsert;
