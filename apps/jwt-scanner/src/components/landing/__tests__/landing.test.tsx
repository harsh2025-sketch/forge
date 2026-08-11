/**
 * Landing page tests (V3 §10.5, P13, Day 13).
 *
 * The landing page must render, expose a primary CTA, communicate the
 * scanner's security value, and consume theme tokens (never hard-coded
 * product colors).
 */

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { LandingPage } from "../landing-page.js";

const PROPS = {
  productName: "JWT Scanner",
  tagline: "Scan JWTs for security issues",
  primaryCtaHref: "/scanner",
  primaryCtaLabel: "Start scanning",
  secondaryCtaHref: "/scanner",
  features: [
    { title: "Deterministic analysis", description: "Same input, same output." },
  ],
  pricingTiers: [
    {
      name: "Free",
      price: "$0",
      description: "For evaluating the scanner",
      features: ["25 scans per month"],
      ctaLabel: "Start free",
    },
    {
      name: "Pro",
      price: "$19 / month",
      description: "For teams",
      features: ["1,000 scans per month"],
      ctaLabel: "Upgrade",
    },
  ],
  signInHref: "/signin",
} as const;

describe("LandingPage", () => {
  it("renders the product identity and hero", () => {
    const html = renderToString(<LandingPage {...PROPS} />);
    expect(html).toContain("JWT Scanner");
    expect(html).toContain("Scan JWTs for security issues");
    expect(html).toContain("catch algorithm confusion and alg=none attacks");
  });

  it("exposes the primary CTA with the configured href", () => {
    const html = renderToString(<LandingPage {...PROPS} />);
    expect(html).toContain("Start scanning");
    expect(html).toContain('href="/scanner"');
  });

  it("communicates the security value and supported findings", () => {
    const html = renderToString(<LandingPage {...PROPS} />);
    expect(html).toContain("alg=none");
    expect(html).toContain("HMAC key-size policy");
    expect(html).toContain("verification policy");
    expect(html).toContain("How it works");
  });

  it("renders pricing plans with CTAs", () => {
    const html = renderToString(<LandingPage {...PROPS} />);
    expect(html).toContain("Free");
    expect(html).toContain("Pro");
    expect(html).toContain("Start free");
    expect(html).toContain("Upgrade");
    expect(html).toContain("forge-pricing-tier");
  });

  it("respects theme tokens (no hard-coded colors)", () => {
    const html = renderToString(<LandingPage {...PROPS} />);
    expect(html).toContain("forge-hero");
    expect(html).toContain("forge-cta");
    expect(html).toContain("var(--forge-colors-brand-primary)");
    expect(html).not.toContain("style=\"background-color:#");
  });

  it("renders the sign-in link when configured", () => {
    const html = renderToString(<LandingPage {...PROPS} />);
    expect(html).toContain("Sign in");
    expect(html).toContain('href="/signin"');
  });
});
