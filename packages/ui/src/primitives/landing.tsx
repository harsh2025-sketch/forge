/**
 * @forge/ui — Landing page structural primitives (V3 §10.5): Hero,
 * FeatureList, PricingTable, CTA, Testimonials — unstyled structure that
 * consumes theme tokens. Landing page LAYOUTS remain product-owned (§10.3).
 */

import type { ReactNode } from "react";
import { tokenVar } from "../theme/apply.js";
import { cn } from "../classnames.js";

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

export interface HeroProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly children?: ReactNode;
  readonly className?: string;
}

export function Hero({ title, subtitle, children, className }: HeroProps) {
  return (
    <section
      className={cn("forge-hero", className)}
      style={{
        textAlign: "center",
        padding: "calc(var(--forge-spacing-unit) * 12) calc(var(--forge-spacing-unit) * 4)",
        color: tokenVar(["colors", "surface", "foreground"]),
        backgroundColor: tokenVar(["colors", "surface", "background"]),
      }}
    >
      <h1
        style={{
          margin: 0,
          fontFamily: "var(--forge-typography-font-family-sans)",
          fontSize: "calc(var(--forge-typography-font-size) * 2.25)",
          fontWeight: "var(--forge-typography-heading-weight)",
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h1>
      {subtitle !== undefined && (
        <p style={{ color: tokenVar(["colors", "surface", "mutedForeground"]), marginTop: "calc(var(--forge-spacing-unit) * 3)" }}>
          {subtitle}
        </p>
      )}
      {children !== undefined && (
        <div style={{ marginTop: "calc(var(--forge-spacing-unit) * 6)" }}>{children}</div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// FeatureList
// ---------------------------------------------------------------------------

export interface Feature {
  readonly title: string;
  readonly description: string;
}

export interface FeatureListProps {
  readonly features: readonly Feature[];
  readonly title?: string;
  readonly className?: string;
}

export function FeatureList({ features, title, className }: FeatureListProps) {
  return (
    <section className={cn("forge-features", className)}>
      {title !== undefined && (
        <h2 style={{ fontFamily: "var(--forge-typography-font-family-sans)", fontWeight: "var(--forge-typography-heading-weight)" }}>
          {title}
        </h2>
      )}
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
          gap: "calc(var(--forge-spacing-unit) * 4)",
        }}
      >
        {features.map((feature) => (
          <li
            key={feature.title}
            className="forge-feature"
            style={{
              border: "var(--forge-borders-width) var(--forge-borders-style) var(--forge-colors-surface-border)",
              borderRadius: "var(--forge-borders-radius)",
              padding: "calc(var(--forge-spacing-unit) * 3)",
              backgroundColor: tokenVar(["colors", "surface", "background"]),
            }}
          >
            <h3 style={{ marginTop: 0, fontWeight: "var(--forge-typography-heading-weight)" }}>{feature.title}</h3>
            <p style={{ margin: 0, color: tokenVar(["colors", "surface", "mutedForeground"]) }}>{feature.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// PricingTable
// ---------------------------------------------------------------------------

export interface PricingTier {
  readonly name: string;
  readonly price: string;
  readonly description?: string;
  readonly features: readonly string[];
  readonly ctaLabel?: string;
}

export interface PricingTableProps {
  readonly tiers: readonly PricingTier[];
  readonly className?: string;
}

export function PricingTable({ tiers, className }: PricingTableProps) {
  return (
    <section className={cn("forge-pricing", className)}>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(14rem, 1fr))`,
          gap: "calc(var(--forge-spacing-unit) * 4)",
        }}
      >
        {tiers.map((tier) => (
          <li
            key={tier.name}
            className="forge-pricing-tier"
            style={{
              border: "var(--forge-borders-width) var(--forge-borders-style) var(--forge-colors-surface-border)",
              borderRadius: "var(--forge-borders-radius)",
              padding: "calc(var(--forge-spacing-unit) * 4)",
              backgroundColor: tokenVar(["colors", "surface", "background"]),
            }}
          >
            <h3 style={{ marginTop: 0, fontWeight: "var(--forge-typography-heading-weight)" }}>{tier.name}</h3>
            <p style={{ fontSize: "calc(var(--forge-typography-font-size) * 1.5)", fontWeight: "var(--forge-typography-heading-weight)" }}>
              {tier.price}
            </p>
            {tier.description !== undefined && (
              <p style={{ color: tokenVar(["colors", "surface", "mutedForeground"]) }}>{tier.description}</p>
            )}
            <ul style={{ paddingLeft: "calc(var(--forge-spacing-unit) * 4)" }}>
              {tier.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            {tier.ctaLabel !== undefined && (
              <p>
                <strong style={{ color: tokenVar(["colors", "brand", "primary"]) }}>{tier.ctaLabel}</strong>
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// CTA
// ---------------------------------------------------------------------------

export interface CTAProps {
  readonly title: string;
  readonly description?: string;
  readonly children?: ReactNode;
  readonly className?: string;
}

export function CTA({ title, description, children, className }: CTAProps) {
  return (
    <section
      className={cn("forge-cta", className)}
      style={{
        textAlign: "center",
        padding: "calc(var(--forge-spacing-unit) * 8) calc(var(--forge-spacing-unit) * 4)",
        borderRadius: "var(--forge-borders-radius)",
        backgroundColor: tokenVar(["colors", "brand", "primary"]),
        color: tokenVar(["colors", "brand", "primaryForeground"]),
      }}
    >
      <h2 style={{ margin: 0, fontWeight: "var(--forge-typography-heading-weight)" }}>{title}</h2>
      {description !== undefined && (
        <p style={{ opacity: 0.9, marginTop: "calc(var(--forge-spacing-unit) * 2)" }}>{description}</p>
      )}
      {children !== undefined && (
        <div style={{ marginTop: "calc(var(--forge-spacing-unit) * 4)" }}>{children}</div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Testimonials
// ---------------------------------------------------------------------------

export interface Testimonial {
  readonly quote: string;
  readonly author: string;
  readonly role?: string;
}

export interface TestimonialsProps {
  readonly items: readonly Testimonial[];
  readonly className?: string;
}

export function Testimonials({ items, className }: TestimonialsProps) {
  return (
    <section className={cn("forge-testimonials", className)}>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))",
          gap: "calc(var(--forge-spacing-unit) * 4)",
        }}
      >
        {items.map((item) => (
          <li
            key={item.author}
            className="forge-testimonial"
            style={{
              borderLeft: "var(--forge-borders-width) var(--forge-borders-style) var(--forge-colors-brand-primary)",
              paddingLeft: "calc(var(--forge-spacing-unit) * 3)",
            }}
          >
            <blockquote style={{ margin: 0 }}>{item.quote}</blockquote>
            <footer style={{ marginTop: "calc(var(--forge-spacing-unit) * 2)", color: tokenVar(["colors", "surface", "mutedForeground"]) }}>
              <strong style={{ color: tokenVar(["colors", "surface", "foreground"]) }}>{item.author}</strong>
              {item.role !== undefined && ` — ${item.role}`}
            </footer>
          </li>
        ))}
      </ul>
    </section>
  );
}
