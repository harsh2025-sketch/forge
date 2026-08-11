/**
 * Token → CSS variable application tests (V3 §10.3, §15): deterministic
 * mapping, resolved choice tokens, sorted output.
 */

import { describe, it, expect } from "vitest";
import {
  cssVariableName,
  flattenThemeTokens,
  resolveBorderRadius,
  resolveComponentRadius,
  resolveFontSize,
  resolveShadow,
  resolveSidebarWidth,
  resolveSpacingUnit,
  themeToCss,
  themeToCssVariables,
  tokenVar,
} from "../theme/apply.js";
import { defaultTheme, contrastingTheme } from "../theme/defaults.js";
import type { ThemeTokens } from "../theme/types.js";

const NO_SEVERITY_THEME: ThemeTokens = {
  ...defaultTheme,
  colors: {
    ...defaultTheme.colors,
    severity: undefined,
  },
};

const NO_CHARTS_THEME: ThemeTokens = {
  ...defaultTheme,
  charts: undefined,
};

describe("cssVariableName / tokenVar", () => {
  it("builds --forge-prefixed names from token paths", () => {
    expect(cssVariableName("colors", "brand", "primary")).toBe("--forge-colors-brand-primary");
    expect(cssVariableName("spacing", "unit")).toBe("--forge-spacing-unit");
  });

  it("tokenVar returns a var() reference with optional fallback", () => {
    expect(tokenVar(["colors", "brand", "primary"])).toBe("var(--forge-colors-brand-primary)");
    expect(tokenVar(["overlay"], "rgb(0 0 0 / 0.5)")).toBe("var(--forge-overlay, rgb(0 0 0 / 0.5))");
  });
});

describe("flattenThemeTokens", () => {
  it("maps every token leaf to a --forge custom property (raw values)", () => {
    const flat = flattenThemeTokens(defaultTheme);

    expect(flat["--forge-colors-brand-primary"]).toBe(defaultTheme.colors.brand.primary);
    expect(flat["--forge-typography-font-family-sans"]).toBe(defaultTheme.typography.fontFamily.sans);
    expect(flat["--forge-spacing-base"]).toBe(defaultTheme.spacing.base);
    expect(flat["--forge-density"]).toBe(defaultTheme.density);
    expect(flat["--forge-borders-radius"]).toBe(defaultTheme.borders.radius);
    expect(flat["--forge-navigation-style"]).toBe(defaultTheme.navigation.style);
    expect(flat["--forge-components-card"]).toBe(defaultTheme.components.card);
    expect(flat["--forge-icons-set"]).toBe(defaultTheme.icons.set);
    expect(flat["--forge-product-name"]).toBe(defaultTheme.product.name);
  });

  it("flattens arrays deterministically (charts.colorPalette)", () => {
    const flat = flattenThemeTokens(defaultTheme);
    expect(flat["--forge-charts-color-palette-0"]).toBe(defaultTheme.charts?.colorPalette[0]);
    expect(flat["--forge-charts-color-palette-4"]).toBe(defaultTheme.charts?.colorPalette[4]);
  });

  it("omits optional tokens that are not defined", () => {
    const withoutSeverity = flattenThemeTokens(NO_SEVERITY_THEME);
    expect(Object.keys(withoutSeverity).some((key) => key.startsWith("--forge-colors-severity-"))).toBe(false);

    const withoutCharts = flattenThemeTokens(NO_CHARTS_THEME);
    expect(Object.keys(withoutCharts).some((key) => key.startsWith("--forge-charts-"))).toBe(false);
  });

  it("is key-sorted and deterministic", () => {
    const flat = flattenThemeTokens(defaultTheme);
    const keys = Object.keys(flat);
    expect([...keys].sort()).toEqual(keys);
    expect(flattenThemeTokens(defaultTheme)).toEqual(flat);
  });
});

describe("themeToCssVariables (resolved)", () => {
  it("resolves choice tokens to concrete CSS values", () => {
    const vars = themeToCssVariables(defaultTheme);

    expect(vars["--forge-borders-radius"]).toBe("8px"); // md
    expect(vars["--forge-borders-width"]).toBe("1px"); // default
    expect(vars["--forge-borders-style"]).toBe("solid");
    expect(vars["--forge-typography-font-size"]).toBe("14px"); // default scale
    expect(vars["--forge-spacing-unit"]).toBe("4px"); // 4 * 1
    expect(vars["--forge-shadows"]).toContain("rgb(0 0 0 / 0.1)");
    expect(vars["--forge-density-row-x"]).toBe("12px");
    expect(vars["--forge-density-row-y"]).toBe("8px");
    expect(vars["--forge-navigation-sidebar-width"]).toBe("18rem");
    expect(vars["--forge-components-button-radius"]).toBe("8px");
    expect(vars["--forge-components-badge-radius"]).toBe("8px");
    expect(vars["--forge-components-card-shadow"]).toBe("none"); // bordered card
    expect(vars["--forge-overlay"]).toBe("rgb(0 0 0 / 0.55)");
  });

  it("keeps raw value tokens intact (colors, fonts)", () => {
    const vars = themeToCssVariables(defaultTheme);
    expect(vars["--forge-colors-brand-primary"]).toBe(defaultTheme.colors.brand.primary);
    expect(vars["--forge-colors-severity-critical"]).toBe(defaultTheme.colors.severity?.critical);
    expect(vars["--forge-typography-font-family-mono"]).toBe(defaultTheme.typography.fontFamily.mono);
  });

  it("resolves the contrasting theme differently", () => {
    const vars = themeToCssVariables(contrastingTheme);

    expect(vars["--forge-borders-radius"]).toBe("4px"); // sm
    expect(vars["--forge-borders-width"]).toBe("1px"); // thin
    expect(vars["--forge-typography-font-size"]).toBe("13px"); // compact
    expect(vars["--forge-spacing-unit"]).toBe("3px"); // tight: 4 * 0.75
    expect(vars["--forge-shadows"]).toBe("none");
    expect(vars["--forge-density-row-x"]).toBe("8px");
    expect(vars["--forge-density-row-y"]).toBe("6px");
    expect(vars["--forge-navigation-sidebar-width"]).toBe("16rem");
    expect(vars["--forge-components-button-radius"]).toBe("0px"); // sharp
    expect(vars["--forge-components-badge-radius"]).toBe("9999px"); // pill

    // Materially different from default, in actual CSS values.
    expect(vars["--forge-colors-surface-background"]).toBe(contrastingTheme.colors.surface.background);
    expect(vars["--forge-colors-surface-background"]).not.toBe(
      themeToCssVariables(defaultTheme)["--forge-colors-surface-background"]
    );
  });

  it("is deterministic and key-sorted", () => {
    const first = themeToCssVariables(defaultTheme);
    const second = themeToCssVariables(defaultTheme);
    expect(first).toEqual(second);
    const keys = Object.keys(first);
    expect([...keys].sort()).toEqual(keys);
  });
});

describe("themeToCss", () => {
  it("emits a deterministic :root stylesheet from the resolved variables", () => {
    const css = themeToCss(defaultTheme);

    expect(css.startsWith(":root {\n")).toBe(true);
    expect(css.endsWith("}")).toBe(true);
    expect(css).toContain("  --forge-colors-brand-primary: hsl(243 75% 59%);");
    expect(css).toContain("  --forge-borders-radius: 8px;");
    expect(themeToCss(defaultTheme)).toBe(css);
  });

  it("supports a custom selector", () => {
    const css = themeToCss(defaultTheme, "[data-theme='dark']");
    expect(css.startsWith("[data-theme='dark'] {")).toBe(true);
  });

  it("produces different stylesheets for the two themes", () => {
    expect(themeToCss(defaultTheme)).not.toBe(themeToCss(contrastingTheme));
  });
});

describe("choice resolvers", () => {
  it("resolve border radius, font size, spacing unit and shadow deterministically", () => {
    expect(resolveBorderRadius(defaultTheme)).toBe("8px");
    expect(resolveFontSize(defaultTheme)).toBe("14px");
    expect(resolveSpacingUnit(defaultTheme)).toBe("4px");
    expect(resolveShadow(defaultTheme)).toBe("0 1px 3px rgb(0 0 0 / 0.1), 0 1px 2px rgb(0 0 0 / 0.06)");
    expect(resolveShadow(contrastingTheme)).toBe("none");
  });

  it("resolve component radii per the components.* choices", () => {
    expect(resolveComponentRadius(defaultTheme, "button")).toBe("8px");
    expect(resolveComponentRadius(contrastingTheme, "button")).toBe("0px");
    expect(resolveComponentRadius(contrastingTheme, "badge")).toBe("9999px");

    const rounded = { ...defaultTheme, components: { ...defaultTheme.components, button: "rounded" } };
    expect(resolveComponentRadius(rounded, "button")).toBe("9999px");
  });

  it("resolve sidebar width only when declared", () => {
    expect(resolveSidebarWidth(defaultTheme)).toBe("18rem");
    const withoutWidth: ThemeTokens = { ...defaultTheme, navigation: { ...defaultTheme.navigation, sidebarWidth: undefined } };
    expect(resolveSidebarWidth(withoutWidth)).toBeUndefined();
  });
});
