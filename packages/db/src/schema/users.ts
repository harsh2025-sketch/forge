/**
 * platform.users — Globally shared (classification A per V3 §6.3).
 *
 * Export rows for users who belong to product's organizations during extraction.
 * No organization_id — users are platform-level principals.
 */

import { timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { platform } from "./products.js";

export const users = platform.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  displayName: varchar("display_name", { length: 200 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
