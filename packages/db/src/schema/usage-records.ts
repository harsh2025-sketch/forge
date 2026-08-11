/**
 * platform.usage_records — Product-scoped (classification B per V3 §6.3, P20 invariant).
 *
 * CRITICAL: Must carry product_id UUID NOT NULL FK → platform.products.id.
 * Without this column extraction is impossible (P20). Do not make nullable.
 */

import { integer, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { platform, products } from "./products.js";
import { organizations } from "./organizations.js";

export const usageRecords = platform.table("usage_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  metricKey: varchar("metric_key", { length: 100 }).notNull(),
  quantity: integer("quantity").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UsageRecordRow = typeof usageRecords.$inferSelect;
export type NewUsageRecordRow = typeof usageRecords.$inferInsert;
