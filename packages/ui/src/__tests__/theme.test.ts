/**
 * ThemeTokens contract tests: default + contrasting token sets must satisfy the
 * frozen V3 §10.2 schema and be materially different (P13, §20.2 Day 8 gate).
 */

import { describe, it, expect } from "vitest";
import { defaultTheme, contrastingTheme } from "../theme/defaults.js";
import type { ThemeTokens } from "../theme/types.js";

const REQUIRED_TOP_LEVEL = [
  "colors",
  "typography",
  "spacing",
  "density",
  "borders",
  "shadows",
  "navigation",
  "components",
  "icons",
  "product",
] as const;

const REQUIRED_BRAND = ["primary", "primaryForeground", "secondary", "secondaryForeground", "accent", "accentForeground"] as const;
const REQUIRED_SURFACE = ["background", "foreground", "muted", "mutedForeground", "border", "input", "ring"] as const;
const REQUIRED_SEMANTIC = ["success", "warning", "error", "info"] as const;
const REQUIRED_SEVERITY = ["critical", "high", "medium", "low", "info"] as const;

function expectValidTheme(theme: ThemeTokens): void {
  for (const key of REQUIRED_TOP_LEVEL) {
    expect(theme, `missing top-level key ${key}`).toHaveProperty(key);
  }

  for (const key of REQUIRED_BRAND) {
    expect(theme.colors.brand[key], `missing brand.${key}`).toBeTypeOf("string");
    expect(theme.colors.brand[key].length).toBeGreaterThan(0);
  }
  for (const key of REQUIRED_SURFACE) {
    expect(theme.colors.surface[key], `missing surface.${key}`).toBeTypeOf("string");
  }
  for (const key of REQUIRED_SEMANTIC) {
    expect(theme.colors.semantic[key], `missing semantic.${key}`).toBeTypeOf("string");
  }
  if (theme.colors.severity !== undefined) {
    for (const key of REQUIRED_SEVERITY) {
      expect(theme.colors.severity[key]).toBeTypeOf("string");
    }
  }

  expect(["compact", "default", "relaxed"]).toContain(theme.typography.scale);
  expect(["400", "500", "600", "700"]).toContain(theme.typography.headingWeight);
  expect(["low", "normal", "high"]).toContain(theme.typography.monoProminence);
  expect(theme.typography.fontFamily.sans).toBeTypeOf("string");
  expect(theme.typography.fontFamily.mono).toBeTypeOf("string");

  expect(theme.spacing.base).toBeTypeOf("number");
  expect(["tight", "default", "loose"]).toContain(theme.spacing.scale);

  expect(["compact", "default", "comfortable"]).toContain(theme.density);

  expect(["none", "sm", "md", "lg", "full"]).toContain(theme.borders.radius);
  expect(["thin", "default", "thick"]).toContain(theme.borders.width);
  expect(["solid", "dashed", "none"]).toContain(theme.borders.style);

  expect(["none", "subtle", "default", "prominent"]).toContain(theme.shadows);

  expect(["sidebar", "topnav", "minimal", "hybrid"]).toContain(theme.navigation.style);
  if (theme.navigation.sidebarWidth !== undefined) {
    expect(["narrow", "default", "wide"]).toContain(theme.navigation.sidebarWidth);
  }
  if (theme.navigation.sidebarVariant !== undefined) {
    expect(["floating", "inset", "default"]).toContain(theme.navigation.sidebarVariant);
  }

  for (const choice of Object.values(theme.components)) {
    expect(choice).toBeTypeOf("string");
  }

  expect(["lucide", "heroicons", "radix", "custom"]).toContain(theme.icons.set);

  expect(theme.product.name).toBeTypeOf("string");
}

describe("ThemeTokens contract", () => {
  it("defaultTheme satisfies the frozen schema", () => {
    expectValidTheme(defaultTheme);
  });

  it("contrastingTheme satisfies the frozen schema", () => {
    expectValidTheme(contrastingTheme);
  });

  it("both shipped themes define severity tokens (Analyzer/Optimizer ready)", () => {
    expect(defaultTheme.colors.severity).toBeDefined();
    expect(contrastingTheme.colors.severity).toBeDefined();
    for (const key of REQUIRED_SEVERITY) {
      expect(defaultTheme.colors.severity?.[key]).toBeTypeOf("string");
      expect(contrastingTheme.colors.severity?.[key]).toBeTypeOf("string");
    }
  });

  it("defaultTheme and contrastingTheme are materially different in value, not just identity", () => {
    // Color identity differs.
    expect(contrastingTheme.colors.brand.primary).not.toBe(defaultTheme.colors.brand.primary);
    expect(contrastingTheme.colors.surface.background).not.toBe(defaultTheme.colors.surface.background);
    expect(contrastingTheme.colors.surface.foreground).not.toBe(defaultTheme.colors.surface.foreground);

    // Visual choices differ across every category of the schema.
    expect(contrastingTheme.typography.scale).not.toBe(defaultTheme.typography.scale);
    expect(contrastingTheme.typography.headingWeight).not.toBe(defaultTheme.typography.headingWeight);
    expect(contrastingTheme.typography.monoProminence).not.toBe(defaultTheme.typography.monoProminence);
    expect(contrastingTheme.spacing.scale).not.toBe(defaultTheme.spacing.scale);
    expect(contrastingTheme.density).not.toBe(defaultTheme.density);
    expect(contrastingTheme.borders.radius).not.toBe(defaultTheme.borders.radius);
    expect(contrastingTheme.borders.width).not.toBe(defaultTheme.borders.width);
    expect(contrastingTheme.shadows).not.toBe(defaultTheme.shadows);
    expect(contrastingTheme.navigation.sidebarWidth).not.toBe(defaultTheme.navigation.sidebarWidth);
    expect(contrastingTheme.components.card).not.toBe(defaultTheme.components.card);
    expect(contrastingTheme.components.button).not.toBe(defaultTheme.components.button);
    expect(contrastingTheme.components.table).not.toBe(defaultTheme.components.table);
    expect(contrastingTheme.components.badge).not.toBe(defaultTheme.components.badge);
    expect(contrastingTheme.icons.set).not.toBe(defaultTheme.icons.set);
    expect(contrastingTheme.product.name).not.toBe(defaultTheme.product.name);
  });
});
