/**
 * Deterministic in-memory implementation of SubscriptionPersistence
 * (tests / DATA_MODE=memory). Mirrors the platform.subscriptions contract
 * with the same tenant isolation as the Drizzle implementation.
 */

import type { SubscriptionRow } from "@forge/db";
import {
  SubscriptionStatusValue,
  type SubscriptionPersistence,
  type SubscriptionUpdate,
} from "./subscription-persistence.js";

export function createMemorySubscriptionPersistence(): SubscriptionPersistence {
  const rows = new Map<string, SubscriptionRow>();
  let sequence = 0;

  return {
    async getByOrg(orgId) {
      for (const row of rows.values()) {
        if (row.organizationId === orgId) return row;
      }
      return null;
    },

    async upsert(orgId, update: SubscriptionUpdate) {
      for (const [id, row] of rows) {
        if (row.organizationId === orgId) {
          const updated: SubscriptionRow = {
            ...row,
            planId: update.planId ?? row.planId,
            externalCustomerId: update.externalCustomerId ?? row.externalCustomerId,
            externalSubscriptionId:
              update.externalSubscriptionId ?? row.externalSubscriptionId,
            status: update.status ?? row.status,
            currentPeriodEnd: update.currentPeriodEnd ?? row.currentPeriodEnd,
            updatedAt: new Date(),
          };
          rows.set(id, updated);
          return updated;
        }
      }
      sequence += 1;
      const now = new Date();
      const row: SubscriptionRow = {
        id: `memory_subscription_${String(sequence).padStart(4, "0")}`,
        organizationId: orgId,
        status: update.status ?? SubscriptionStatusValue.CHECKOUT,
        planId: update.planId ?? null,
        externalCustomerId: update.externalCustomerId ?? null,
        externalSubscriptionId: update.externalSubscriptionId ?? null,
        currentPeriodEnd: update.currentPeriodEnd ?? null,
        createdAt: now,
        updatedAt: now,
      };
      rows.set(row.id, row);
      return row;
    },

    async rowsByCustomer(externalCustomerId) {
      return [...rows.values()].filter(
        (row) => row.externalCustomerId === externalCustomerId,
      );
    },
  };
}
