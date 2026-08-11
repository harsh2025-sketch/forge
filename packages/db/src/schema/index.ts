/**
 * @forge/db — Platform schema barrel (V3 §6.3, §3.2).
 * Re-exports all platform tables and the shared `platform` pgSchema.
 */

export { platform, products } from "./products.js";
export type { ProductRow, NewProductRow } from "./products.js";

export { users } from "./users.js";
export type { UserRow, NewUserRow } from "./users.js";

export { organizations } from "./organizations.js";
export type { OrganizationRow, NewOrganizationRow } from "./organizations.js";

export { organizationMembers } from "./members.js";
export type {
  OrganizationMemberRow,
  NewOrganizationMemberRow,
} from "./members.js";

export { subscriptions } from "./subscriptions.js";
export type { SubscriptionRow, NewSubscriptionRow } from "./subscriptions.js";

export { usageRecords } from "./usage-records.js";
export type { UsageRecordRow, NewUsageRecordRow } from "./usage-records.js";

export { auditEvents } from "./audit-events.js";
export type { AuditEventRow, NewAuditEventRow } from "./audit-events.js";
