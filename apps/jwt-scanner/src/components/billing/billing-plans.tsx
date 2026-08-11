/**
 * Billing plans list (client component): renders the product's provider-
 * neutral plans and starts checkout through the injected server action. The
 * action returns the hosted checkout URL and the component redirects there.
 */

"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Button, Card } from "@forge/ui";
import type { Result } from "@forge/shared";
import type { JwtScannerPlan } from "@/features/billing/plans";

export interface BillingPlansProps {
  readonly plans: readonly JwtScannerPlan[];
  readonly currentPlanId: string | null;
  /** Server action that starts checkout (injected for testability). */
  readonly startCheckoutAction: (planId: string) => Promise<Result<{ url: string }, string>>;
}

export function BillingPlans({
  plans,
  currentPlanId,
  startCheckoutAction,
}: BillingPlansProps): ReactNode {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(planId: string) {
    setPending(planId);
    setError(null);
    try {
      const result = await startCheckoutAction(planId);
      if (result.ok) {
        window.location.href = result.value.url;
        return;
      }
      setError(result.error);
    } catch {
      setError("Checkout could not be started. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <h2 style={{ fontWeight: "var(--forge-typography-heading-weight)" }}>Plans</h2>
      {error !== null && (
        <p role="alert" style={{ color: "var(--forge-colors-semantic-error)" }}>
          {error}
        </p>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
          gap: "calc(var(--forge-spacing-unit) * 4)",
        }}
      >
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const limit =
            plan.entitlements.find((entitlement) => entitlement.key === "scans_per_month")?.limit ?? null;
          return (
            <Card key={plan.id}>
              <h3 style={{ marginTop: 0 }}>{plan.name}</h3>
              <p style={{ color: "var(--forge-colors-surface-muted-foreground)" }}>{plan.description}</p>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
                <li>
                  {limit === null ? "Unlimited scans" : `${limit} scans per month`}
                </li>
              </ul>
              <Button
                variant="secondary"
                disabled={isCurrent || pending !== null}
                onClick={() => checkout(plan.id)}
              >
                {isCurrent ? "Current plan" : pending === plan.id ? "Starting…" : "Choose"}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
