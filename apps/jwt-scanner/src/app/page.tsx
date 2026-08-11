/**
 * Landing page (V3 §20.2 Day 13). Public marketing surface composed from
 * @forge/ui landing primitives; product identity and pricing come from the
 * theme tokens and the product's billing plans.
 */

import { LandingPage } from "@/components/landing/landing-page";
import { appConfig } from "@/providers";
import { JWT_SCANNER_PLANS } from "@/features/billing/plans";

const FEATURES = [
  {
    title: "Deterministic analysis",
    description: "Same token and policy always produce the same findings, with an explicit evaluation time.",
  },
  {
    title: "Provider-neutral reports",
    description: "One report document rendered as JSON, Markdown, or HTML through the shared reporting pipeline.",
  },
  {
    title: "Tenant-scoped by design",
    description: "Every scan and finding is scoped to your organization; nothing is shared across tenants.",
  },
];

function planPrice(priceId: string): string {
  if (priceId.includes("pro")) return "$19 / month";
  return "$0";
}

export default function LandingPageRoute() {
  const pricingTiers = JWT_SCANNER_PLANS.map((plan) => ({
    name: plan.name,
    price: planPrice(plan.priceId),
    description: plan.description,
    features: [...plan.features],
    ctaLabel: plan.id === "free" ? "Start free" : "Upgrade",
  }));

  const primaryCtaHref = appConfig.signInUrl ?? "/scanner";

  return (
    <LandingPage
      productName="JWT Scanner"
      tagline="Scan JWTs for security issues"
      primaryCtaHref={primaryCtaHref}
      primaryCtaLabel="Start scanning"
      secondaryCtaHref="/scanner"
      features={FEATURES}
      pricingTiers={pricingTiers}
    />
  );
}
