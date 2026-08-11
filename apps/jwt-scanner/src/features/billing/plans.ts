/**
 * JWT Scanner billing plans (V3 §8.1, @forge/billing Plan contract, P21).
 *
 * The product's plans are provider-neutral: ids, names and `priceId` — a
 * neutral price identifier consumed by the BillingPort. The billing provider
 * adapter (src/providers.ts) is what maps these identifiers to the current
 * provider's actual price objects; nothing in the feature layer or domain
 * ever mentions a provider (no "stripePriceId" — the manifest's `priceId`
 * semantics are the contract, Task 013).
 *
 * The machine-readable plan subset lives in product.manifest.ts; this module
 * carries the runtime shape (entitlements) required by the @forge/billing
 * Plan type. The two must stay in sync (enforced by tests).
 */

import type { Entitlement, Plan } from "@forge/billing";

/** Entitlement keys for JWT Scanner plans. */
export const ENTITLEMENT_KEYS = {
  SCANS_PER_MONTH: "scans_per_month",
} as const;

export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[keyof typeof ENTITLEMENT_KEYS];

export const FREE_PLAN_ID = "free";
export const PRO_PLAN_ID = "pro";

export interface JwtScannerPlan extends Plan {
  readonly id: "free" | "pro";
  readonly description: string;
  readonly features: readonly string[];
}

function entitlements(scansPerMonth: number): readonly Entitlement[] {
  return [{ key: ENTITLEMENT_KEYS.SCANS_PER_MONTH, limit: scansPerMonth }];
}

/** The product's plans, frozen for this milestone (V3 §22.2 — pricing is a human decision). */
export const JWT_SCANNER_PLANS: readonly JwtScannerPlan[] = [
  {
    id: "free",
    name: "Free",
    description: "For evaluating the scanner",
    priceId: "price_jwt_scanner_free",
    entitlements: entitlements(25),
    features: ["25 scans per month", "Full finding report (JSON)"],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For teams that scan regularly",
    priceId: "price_jwt_scanner_pro_monthly",
    entitlements: entitlements(1000),
    features: [
      "1,000 scans per month",
      "All report formats (JSON, Markdown, HTML)",
      "Priority support",
    ],
  },
];

/** Finds a plan by its neutral plan id, or undefined. */
export function findPlan(planId: string): JwtScannerPlan | undefined {
  return JWT_SCANNER_PLANS.find((plan) => plan.id === planId);
}

/** The price identifier for a plan — the neutral BillingPort identifier. */
export function priceIdForPlan(planId: string): string | undefined {
  return findPlan(planId)?.priceId;
}
