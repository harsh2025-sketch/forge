/**
 * platform.audit_events — Product-scoped (classification B per V3 §6.3, P20 invariant).
 *
 * CRITICAL: Must carry product_id UUID NOT NULL FK → platform.products.id.
 * Audit events also carry organization_id for tenant isolation (withOrg).
 */

import { jsonb, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { platform, products } from "./products.js";
import { organizations } from "./organizations.js";
import { users } from "./users.js";

export const auditEvents = platform.table("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 100 }).notNull(),
  targetType: varchar("target_type", { length: 100 }),
  targetId: varchar("target_id", { length: 200 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AuditEventRow = typeof auditEvents.$inferSelect;
export type NewAuditEventRow = typeof auditEvents.$inferInsert;
