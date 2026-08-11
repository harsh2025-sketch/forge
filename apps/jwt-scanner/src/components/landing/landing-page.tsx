/**
 * JWT Scanner landing page (V3 §10.5, P13).
 *
 * Marketing surface composed exclusively from @forge/ui landing primitives
 * (Hero, FeatureList, PricingTable, CTA) plus product-owned layout. All
 * values come through props so the component stays free of providers/Next
 * imports; the page (src/app/page.tsx) supplies wiring.
 */

import type { ReactNode } from "react";
import {
  Button,
  CTA,
  FeatureList,
  Hero,
  PricingTable,
  type Feature,
  type PricingTier,
} from "@forge/ui";

export interface LandingPageProps {
  readonly productName: string;
  readonly tagline: string;
  /** Href of the primary "start scanning" CTA. */
  readonly primaryCtaHref: string;
  readonly primaryCtaLabel: string;
  /** Href of the secondary "view pricing" CTA (may equal primaryCtaHref). */
  readonly secondaryCtaHref: string;
  readonly features: readonly Feature[];
  readonly pricingTiers: readonly PricingTier[];
  /** Optional sign-in link shown in the header. */
  readonly signInHref?: string;
}

const WORKFLOW_STEPS = [
  { title: "Paste a JWT", description: "Drop a compact JWT (header.payload.signature) into the scanner." },
  { title: "Analyze", description: "The engine checks the declared algorithm, HMAC key policy, and claims." },
  { title: "Review findings", description: "Each finding shows severity, evidence, and remediation guidance." },
  { title: "Export a report", description: "Download the scan as JSON, Markdown, or HTML." },
] as const;

export function LandingPage({
  productName,
  tagline,
  primaryCtaHref,
  primaryCtaLabel,
  secondaryCtaHref,
  features,
  pricingTiers,
  signInHref,
}: LandingPageProps): ReactNode {
  return (
    <div className="jwt-landing">
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "calc(var(--forge-spacing-unit) * 3) calc(var(--forge-spacing-unit) * 6)",
          borderBottom: "var(--forge-borders-width) var(--forge-borders-style) var(--forge-colors-surface-border)",
        }}
      >
        <span style={{ fontWeight: "var(--forge-typography-heading-weight)" }}>{productName}</span>
        {signInHref !== undefined && (
          <a href={signInHref} style={{ color: "var(--forge-colors-surface-foreground)" }}>
            Sign in
          </a>
        )}
      </header>

      <Hero
        title={`${productName} — catch algorithm confusion and alg=none attacks`}
        subtitle={tagline}
      >
        <a href={primaryCtaHref}>
          <Button size="lg">{primaryCtaLabel}</Button>
        </a>
      </Hero>

      <FeatureList
        title="What the scanner checks"
        features={[
          ...features,
          {
            title: "JWT algorithm-confusion & none-alg detection",
            description:
              "Flags tokens that declare alg=none or that conflict with your verification policy — the classic JWT verification bypasses.",
          },
          {
            title: "HMAC key-size policy",
            description:
              "Compares caller-supplied HMAC key metadata against the RFC 7518 minimum key sizes for HS256/384/512.",
          },
          {
            title: "Claim analysis",
            description:
              "Reports expired tokens against an explicit evaluation time, with deterministic, repeatable output.",
          },
        ]}
      />

      <section
        className="jwt-workflow"
        style={{
          padding: "calc(var(--forge-spacing-unit) * 6) calc(var(--forge-spacing-unit) * 4)",
        }}
      >
        <h2 style={{ fontWeight: "var(--forge-typography-heading-weight)" }}>How it works</h2>
        <ol style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))", gap: "calc(var(--forge-spacing-unit) * 4)", listStyle: "none", padding: 0 }}>
          {WORKFLOW_STEPS.map((step, index) => (
            <li key={step.title} style={{ border: "var(--forge-borders-width) var(--forge-borders-style) var(--forge-colors-surface-border)", borderRadius: "var(--forge-borders-radius)", padding: "calc(var(--forge-spacing-unit) * 3)" }}>
              <span style={{ color: "var(--forge-colors-brand-primary)", fontWeight: "var(--forge-typography-heading-weight)" }}>
                {index + 1}.
              </span>{" "}
              <strong>{step.title}</strong>
              <p style={{ margin: "calc(var(--forge-spacing-unit) * 1) 0 0 0", color: "var(--forge-colors-surface-muted-foreground)" }}>
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <PricingTable tiers={pricingTiers} />

      <CTA title="Start scanning JWTs today" description="Free tier included. No credit card required to run your first scan.">
        <a href={secondaryCtaHref}>
          <Button variant="secondary" size="lg">
            {primaryCtaLabel}
          </Button>
        </a>
      </CTA>
    </div>
  );
}
