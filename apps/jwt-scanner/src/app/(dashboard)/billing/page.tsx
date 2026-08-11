/**
 * Billing page (V3 §20.2 Day 13 — billing wiring).
 *
 * Lists the product's provider-neutral plans with their entitlements and the
 * organization's current billing status. Checkout and the billing portal go
 * through the BillingPort wired in src/providers.ts — the page never touches
 * a provider SDK.
 */

import { redirect } from "next/navigation";
import { Card, StatusBadge } from "@forge/ui";
import { authPort, billingPort, getSubscriptionPersistence } from "@/providers";
import { getOrgUserContext } from "@/features/auth/session";
import { ensurePlatformOrganization } from "@/features/auth/identity";
import { getBillingStatus } from "@/features/billing/service";
import { JWT_SCANNER_PLANS } from "@/features/billing/plans";
import { startCheckoutAction } from "@/features/billing/actions";
import { BillingPlans } from "@/components/billing/billing-plans";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  readonly searchParams: { readonly checkout?: string };
}) {
  const context = await getOrgUserContext(authPort, ensurePlatformOrganization);
  if (!context.ok) {
    redirect("/?auth=required");
  }

  const status = await getBillingStatus({
    auth: authPort,
    billing: billingPort,
    subscriptions: getSubscriptionPersistence(),
  });

  const currentPlanId = status.ok ? status.value.planId : null;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Billing</h1>

      {searchParams.checkout !== undefined && (
        <Card>
          <StatusBadge
            status={searchParams.checkout === "success" ? "Checkout completed" : "Checkout cancelled"}
            tone={searchParams.checkout === "success" ? "success" : "warning"}
          />
        </Card>
      )}

      {status.ok && status.value.status !== "none" && (
        <Card>
          <h2 style={{ marginTop: 0 }}>Current plan</h2>
          <p>
            Plan: <strong>{status.value.planId ?? "—"}</strong> · Status:{" "}
            <StatusBadge status={status.value.status} tone={status.value.status === "active" ? "success" : "info"} />
          </p>
        </Card>
      )}

      <BillingPlans
        plans={JWT_SCANNER_PLANS}
        currentPlanId={currentPlanId}
        startCheckoutAction={startCheckoutAction}
      />
    </div>
  );
}
