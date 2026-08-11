/**
 * platform.subscriptions — Product-scoped by organization (classification B per V3 §6.3).
 *
 * Export subscriptions for product's organizations during extraction.
 * Tenant-scoped via organization_id (withOrg required). No product_id needed per V3
 * — scoped by organization membership. Each subscription belongs to one organization.
 */

import { timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { platform } from "./products.js";
import { organizations } from "./organizations.js";

export const subscriptions = platform.table("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).notNull(),
  planId: varchar("plan_id", { length: 100 }),
  externalCustomerId: varchar("external_customer_id", { length: 200 }),
  externalSubscriptionId: varchar("external_subscription_id", { length: 200 }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type NewSubscriptionRow = typeof subscriptions.$inferInsert;
