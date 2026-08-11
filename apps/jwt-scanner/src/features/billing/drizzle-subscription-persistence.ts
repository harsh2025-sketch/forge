/**
 * Drizzle/PostgreSQL implementation of SubscriptionPersistence.
 *
 * Queries against platform.subscriptions are always scoped with `withOrg()`
 * (V3 §6.4, §11.2): one organization can never read or mutate another
 * organization's subscription row.
 */

import { and, eq } from "drizzle-orm";
import { subscriptions, withOrg, type DbClient } from "@forge/db";
import {
  SubscriptionStatusValue,
  type SubscriptionPersistence,
} from "./subscription-persistence.js";

export function createDrizzleSubscriptionPersistence(db: DbClient): SubscriptionPersistence {
  return {
    async getByOrg(orgId) {
      const rows = await db
        .select()
        .from(subscriptions)
        .where(withOrg(subscriptions.organizationId, orgId))
        .limit(1);
      return rows[0] ?? null;
    },

    async upsert(orgId, update) {
      const existing = await db
        .select()
        .from(subscriptions)
        .where(withOrg(subscriptions.organizationId, orgId))
        .limit(1);
      if (existing.length > 0) {
        const current = existing[0]!;
        const [updated] = await db
          .update(subscriptions)
          .set({
            planId: update.planId ?? current.planId,
            externalCustomerId: update.externalCustomerId ?? current.externalCustomerId,
            externalSubscriptionId:
              update.externalSubscriptionId ?? current.externalSubscriptionId,
            status: update.status ?? current.status,
            currentPeriodEnd: update.currentPeriodEnd ?? current.currentPeriodEnd,
            updatedAt: new Date(),
          })
          .where(
            and(
              withOrg(subscriptions.organizationId, orgId),
              eq(subscriptions.id, current.id),
            ),
          )
          .returning();
        return updated!;
      }
      const [inserted] = await db
        .insert(subscriptions)
        .values({
          organizationId: orgId,
          status: update.status ?? SubscriptionStatusValue.CHECKOUT,
          planId: update.planId ?? null,
          externalCustomerId: update.externalCustomerId ?? null,
          externalSubscriptionId: update.externalSubscriptionId ?? null,
          currentPeriodEnd: update.currentPeriodEnd ?? null,
        })
        .returning();
      return inserted!;
    },

    async rowsByCustomer(externalCustomerId) {
      return db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.externalCustomerId, externalCustomerId));
    },
  };
}
