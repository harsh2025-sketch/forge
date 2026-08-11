/**
 * @forge/ui — Token → CSS custom property application (V3 §10.3, §20.2 Day 8).
 *
 *   ThemeTokens  →  CSS custom properties  →  UI rendering
 *
 * Two layers:
 *  - `flattenThemeTokens`: 1:1 semantic mapping (raw token values).
 *  - `themeToCssVariables`: RESOLVED mapping — value tokens pass through and
 *    choice tokens (radius/width/style/shadow/scale/density/sidebar width)
 *    resolve to concrete CSS values, plus derived helpers (`--forge-spacing-unit`,
 *    `--forge-typography-font-size`, density row padding, ...). This resolved
 *    map is what ThemeScope applies inline and what products embed in their
 *    globals.css; components only ever reference `var(--forge-...)`, so no
 *    component hard-codes a product's visual identity (P13).
 *
 * Determinism: both maps are key-sorted; same tokens → same output.
 */

import type { ThemeTokens } from "./types.js";

/**
 * Builds the deterministic custom-property name for a token path.
 * Schema keys are camelCase (e.g. `primaryForeground`, `sidebarWidth`); CSS
 * custom properties are kebab-case (`--forge-colors-brand-primary-foreground`).
 */
export function cssVariableName(...segments: readonly string[]): string {
  const kebab = segments
    .filter(Boolean)
    .map((segment) => segment.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase());
  return `--forge-${kebab.join("-")}`;
}

/** Returns a `var(--forge-...)` reference for components, with optional fallback. */
export function tokenVar(path: readonly string[], fallback?: string): string {
  const name = cssVariableName(...path);
  return fallback === undefined ? `var(${name})` : `var(${name}, ${fallback})`;
}

// ---- Choice-token resolvers (the structural, theme-agnostic layer) ----

const RADIUS_PX = { none: 0, sm: 4, md: 8, lg: 12, full: 9999 } as const;
const BORDER_WIDTH_PX = { thin: 1, default: 1, thick: 2 } as const;
const BORDER_STYLE_CSS = { solid: "solid", dashed: "dashed", none: "none" } as const;
const FONT_SCALE_PX = { compact: 13, default: 14, relaxed: 16 } as const;
const SPACING_SCALE_FACTOR = { tight: 0.75, default: 1, loose: 1.25 } as const;
const DENSITY_ROW_PX = {
  compact: { x: 8, y: 6 },
  default: { x: 12, y: 8 },
  comfortable: { x: 16, y: 12 },
} as const;
const SHADOW_CSS = {
  none: "none",
  subtle: "0 1px 2px rgb(0 0 0 / 0.05)",
  default: "0 1px 3px rgb(0 0 0 / 0.1), 0 1px 2px rgb(0 0 0 / 0.06)",
  prominent: "0 8px 24px rgb(0 0 0 / 0.12)",
} as const;
const SIDEBAR_WIDTH_REM = { narrow: "16rem", default: "18rem", wide: "20rem" } as const;

export function resolveBorderRadius(tokens: ThemeTokens): string {
  return `${RADIUS_PX[tokens.borders.radius]}px`;
}

export function resolveBorderWidth(tokens: ThemeTokens): string {
  return `${BORDER_WIDTH_PX[tokens.borders.width]}px`;
}

export function resolveBorderStyle(tokens: ThemeTokens): string {
  return BORDER_STYLE_CSS[tokens.borders.style];
}

export function resolveShadow(tokens: ThemeTokens): string {
  return SHADOW_CSS[tokens.shadows];
}

export function resolveFontSize(tokens: ThemeTokens): string {
  return `${FONT_SCALE_PX[tokens.typography.scale]}px`;
}

/** Base spacing unit (px) with the spacing scale applied, e.g. 4px × 1 = 4px. */
export function resolveSpacingUnit(tokens: ThemeTokens): string {
  return `${Math.round(tokens.spacing.base * SPACING_SCALE_FACTOR[tokens.spacing.scale])}px`;
}

export function resolveDensityRow(tokens: ThemeTokens): { x: string; y: string } {
  const row = DENSITY_ROW_PX[tokens.density];
  return { x: `${row.x}px`, y: `${row.y}px` };
}

export function resolveSidebarWidth(tokens: ThemeTokens): string | undefined {
  if (tokens.navigation.sidebarWidth === undefined) {
    return undefined;
  }
  return SIDEBAR_WIDTH_REM[tokens.navigation.sidebarWidth];
}

export function resolveComponentRadius(tokens: ThemeTokens, component: "button" | "badge"): string {
  const choice = tokens.components[component];
  if (component === "button") {
    if (choice === "sharp") {
      return "0px";
    }
    if (choice === "rounded") {
      return "9999px";
    }
    return resolveBorderRadius(tokens);
  }
  // badge
  if (choice === "pill") {
    return "9999px";
  }
  if (choice === "square") {
    return "0px";
  }
  return resolveBorderRadius(tokens);
}

export function resolveCardShadow(tokens: ThemeTokens): string {
  if (tokens.components.card === "elevated") {
    return resolveShadow(tokens);
  }
  if (tokens.components.card === "glass") {
    return SHADOW_CSS.subtle;
  }
  return "none";
}

/** Resolved overlay scrim used by overlay primitives (dialog). */
export function resolveOverlay(): string {
  return "rgb(0 0 0 / 0.55)";
}

// ---- Flattening ----

type Leaf = string | number | boolean;

function flattenValue(
  value: unknown,
  path: readonly string[],
  out: Record<string, Leaf>
): void {
  if (value === undefined || value === null) {
    return; // optional tokens are omitted
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    out[cssVariableName(...path)] = value;
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => flattenValue(entry, [...path, String(index)], out));
    return;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    for (const key of keys) {
      flattenValue((value as Record<string, unknown>)[key], [...path, key], out);
    }
  }
}

/**
 * Raw 1:1 semantic token mapping (key-sorted). Choice tokens keep their
 * semantic values here (e.g. `--forge-borders-radius: md`); use
 * `themeToCssVariables` for values ready to apply to CSS.
 */
export function flattenThemeTokens(tokens: ThemeTokens): Record<string, Leaf> {
  const out: Record<string, Leaf> = {};
  flattenValue(tokens, [], out);
  return out;
}

function sortRecord(record: Record<string, string>): Record<string, string> {
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(record).sort()) {
    sorted[key] = record[key];
  }
  return sorted;
}

/**
 * Resolved CSS custom properties for rendering: raw token values pass through,
 * choice tokens resolve to concrete CSS values, derived helpers are added.
 * Deterministic (key-sorted). This is the map ThemeScope applies inline and
 * products embed in their CSS application layer.
 */
export function themeToCssVariables(tokens: ThemeTokens): Record<string, string> {
  const flat = flattenThemeTokens(tokens);
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(flat)) {
    resolved[key] = String(value);
  }

  resolved[cssVariableName("typography", "font-size")] = resolveFontSize(tokens);
  resolved[cssVariableName("spacing", "unit")] = resolveSpacingUnit(tokens);
  resolved[cssVariableName("borders", "radius")] = resolveBorderRadius(tokens);
  resolved[cssVariableName("borders", "width")] = resolveBorderWidth(tokens);
  resolved[cssVariableName("borders", "style")] = resolveBorderStyle(tokens);
  resolved[cssVariableName("shadows")] = resolveShadow(tokens);

  const density = resolveDensityRow(tokens);
  resolved[cssVariableName("density", "row", "x")] = density.x;
  resolved[cssVariableName("density", "row", "y")] = density.y;

  const sidebarWidth = resolveSidebarWidth(tokens);
  if (sidebarWidth !== undefined) {
    resolved[cssVariableName("navigation", "sidebar", "width")] = sidebarWidth;
  }

  resolved[cssVariableName("components", "button", "radius")] = resolveComponentRadius(tokens, "button");
  resolved[cssVariableName("components", "badge", "radius")] = resolveComponentRadius(tokens, "badge");
  resolved[cssVariableName("components", "card", "shadow")] = resolveCardShadow(tokens);
  resolved[cssVariableName("overlay")] = resolveOverlay();

  return sortRecord(resolved);
}

/**
 * Deterministic CSS text applying the resolved variables under a selector
 * (default `:root`). Products embed this in their `globals.css` application.
 */
export function themeToCss(tokens: ThemeTokens, selector = ":root"): string {
  const variables = themeToCssVariables(tokens);
  const declarations = Object.entries(variables)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");
  return `${selector} {\n${declarations}\n}`;
}
