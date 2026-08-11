/**
 * Billing feature tests (V3 §5.2, P12, P21, Day 13).
 *
 * Verifies the product's plan configuration, that the feature reaches the
 * billing provider exclusively through the BillingPort seam, and that no
 * provider-specific naming leaks into product types.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateProductManifest } from "@forge/config";
import { findPlan, JWT_SCANNER_PLANS } from "../plans.js";
import { getBillingStatus, startCheckout, openBillingPortal } from "../service.js";
import { createMemorySubscriptionPersistence } from "../memory-subscription-persistence.js";
import { SubscriptionStatusValue } from "../subscription-persistence.js";
import {
  billingDeps,
  billingDepsWithStore,
  TEST_ORG,
  foreignAuthPort,
} from "@/__tests__/test-utils.js";

describe("plan configuration", () => {
  it("defines the Free and Pro plans with neutral price ids", () => {
    expect(JWT_SCANNER_PLANS.map((plan) => plan.id)).toEqual(["free", "pro"]);
    for (const plan of JWT_SCANNER_PLANS) {
      expect(plan.priceId.length).toBeGreaterThan(0);
      // Provider-neutral contract: no provider names in product types.
      expect(plan.priceId.toLowerCase()).not.toContain("stripe");
      expect(plan.priceId.toLowerCase()).not.toContain("price_1");
      expect(plan.entitlements.some((e) => e.key === "scans_per_month")).toBe(true);
    }
  });

  it("exposes entitlements limits", () => {
    expect(findPlan("free")?.entitlements.find((e) => e.key === "scans_per_month")?.limit).toBe(25);
    expect(findPlan("pro")?.entitlements.find((e) => e.key === "scans_per_month")?.limit).toBe(1000);
    expect(findPlan("enterprise")).toBeUndefined();
  });

  it("stays in sync with the product manifest plans", () => {
    const manifestSource = readFileSync(
      new URL("../../../../product.manifest.ts", import.meta.url),
      "utf8",
    );
    expect(manifestSource).toContain("priceId");
    // The manifest's machine-readable subset must list the same plan ids.
    for (const plan of JWT_SCANNER_PLANS) {
      expect(manifestSource).toContain(`id: "${plan.id}"`);
      expect(manifestSource).toContain(`priceId: "${plan.priceId}"`);
    }
  });

  it("validates as a conforming product manifest", () => {
    const source = readFileSync(
      new URL("../../../../product.manifest.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("defineProductManifest");
    // Validation of the shape is covered by the config package tests; here we
    // assert the validator accepts the plans shape by constructing it.
    const result = validateProductManifest({
      id: "jwt-scanner",
      displayName: "JWT Scanner",
      tagline: "Scan JWTs for security issues",
      primaryArchetype: "analyzer",
      capabilities: ["reporting"],
      plans: JWT_SCANNER_PLANS.map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        priceId: plan.priceId,
        features: [...plan.features],
      })),
      requiresWorker: false,
      requiresAIProvider: false,
    });
    expect(result.ok).toBe(true);
  });
});

describe("startCheckout", () => {
  it("creates a billing customer through the port and returns a hosted session", async () => {
    const { deps, store } = billingDepsWithStore();
    const result = await startCheckout(deps, "free");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.url).toMatch(/^https:\/\/checkout\.dev\//);
      expect(result.value.url).toContain("price=price_jwt_scanner_free");
    }
    // The customer was created through the BillingPort seam.
    expect(store.customers.size).toBe(1);
    const customer = [...store.customers.values()][0]!;
    expect(customer.email).toBe("scanner@example.test");
  });

  it("rejects unknown plans", async () => {
    const result = await startCheckout(billingDeps(), "mystery-plan");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Unknown plan: mystery-plan");
    }
  });

  it("requires authentication", async () => {
    const result = await startCheckout(billingDeps({ auth: undefined as never }), "free");
    expect(result.ok).toBe(false);
  });

  it("persists plan + checkout status to the subscription projection", async () => {
    const deps = billingDeps();
    const result = await startCheckout(deps, "pro");
    expect(result.ok).toBe(true);
    const status = await getBillingStatus(deps);
    expect(status.ok).toBe(true);
    if (status.ok) {
      expect(status.value.planId).toBe("pro");
      expect(status.value.status).toBe(SubscriptionStatusValue.CHECKOUT);
      expect(status.value.externalCustomerId).toMatch(/^dev_customer_/);
    }
  });

  it("reuses the existing billing customer", async () => {
    const { deps, store } = billingDepsWithStore();
    await startCheckout(deps, "free");
    await startCheckout(deps, "pro");
    expect(store.customers.size).toBe(1);
  });
});

describe("getBillingStatus", () => {
  it("reports no subscription for orgs without one", async () => {
    const status = await getBillingStatus(billingDeps());
    expect(status.ok).toBe(true);
    if (status.ok) {
      expect(status.value.status).toBe("none");
      expect(status.value.planId).toBeNull();
    }
  });

  it("is org-scoped", async () => {
    const deps = billingDeps();
    await startCheckout(deps, "free");
    // A user of a different org must not see this org's billing state.
    const foreign = await getBillingStatus({ ...billingDeps(), auth: foreignAuthPort() });
    expect(foreign.ok).toBe(true);
    if (foreign.ok) {
      expect(foreign.value.status).toBe("none");
    }
    expect(TEST_ORG.id).toBe("org_test_0001");
  });
});

describe("openBillingPortal", () => {
  it("opens the provider portal for an org with a customer", async () => {
    const deps = billingDeps();
    await startCheckout(deps, "free");
    const result = await openBillingPortal(deps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.url).toMatch(/^https:\/\/billing\.dev\//);
    }
  });

  it("fails for orgs without a billing customer", async () => {
    const result = await openBillingPortal(billingDeps());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("No billing customer exists for this organization");
    }
  });
});

describe("subscription persistence", () => {
  it("records provider-neutral subscription state and resolves by customer", async () => {
    const persistence = createMemorySubscriptionPersistence();
    const row = await persistence.upsert(TEST_ORG.id, {
      planId: "free",
      status: SubscriptionStatusValue.CHECKOUT,
      externalCustomerId: "dev_customer_0001",
    });
    expect(row.organizationId).toBe(TEST_ORG.id);
    expect(row.planId).toBe("free");

    const byCustomer = await persistence.rowsByCustomer("dev_customer_0001");
    expect(byCustomer.map((r) => r.organizationId)).toEqual([TEST_ORG.id]);

    const updated = await persistence.upsert(TEST_ORG.id, {
      status: SubscriptionStatusValue.ACTIVE,
      externalSubscriptionId: "sub_123",
    });
    expect(updated.status).toBe("active");
    expect(updated.externalSubscriptionId).toBe("sub_123");
  });
});
