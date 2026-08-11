/**
 * platform.organization_members — Globally shared (classification A per V3 §6.3).
 *
 * Membership links a user to an organization. Tenant-scoped via organization_id
 * (every query must use withOrg). Unique on (organization_id, user_id).
 */

import { timestamp, uuid, varchar, unique } from "drizzle-orm/pg-core";
import { platform } from "./products.js";
import { organizations } from "./organizations.js";
import { users } from "./users.js";

export const organizationMembers = platform.table(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 }).notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgUserUnique: unique("organization_members_org_user_unique").on(
      table.organizationId,
      table.userId,
    ),
  }),
);

export type OrganizationMemberRow = typeof organizationMembers.$inferSelect;
export type NewOrganizationMemberRow = typeof organizationMembers.$inferInsert;
