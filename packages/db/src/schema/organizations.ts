/**
 * platform.organizations — Globally shared (classification A per V3 §6.3).
 *
 * Export rows for organizations using this product during extraction.
 */

import { timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { platform } from "./products.js";

export const organizations = platform.table("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type OrganizationRow = typeof organizations.$inferSelect;
export type NewOrganizationRow = typeof organizations.$inferInsert;
