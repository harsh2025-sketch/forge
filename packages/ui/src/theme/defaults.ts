/**
 * @forge/ui — theme token sets (V3 §10.2/§10.4, P13).
 *
 * - `defaultTheme`: neutral baseline token set.
 * - `contrastingTheme`: a materially different token set (dark security-tool
 *   identity) used by the Day-8 validation gate to prove that two contrasting
 *   token sets render genuinely different UI output (§20.2, §16: "Two
 *   contrasting token sets render differently").
 *
 * Products override these values in their own `src/theme/tokens.ts`; the UI
 * package only ships the overridable baseline.
 */

import type { ThemeTokens } from "./types.js";

export const defaultTheme: ThemeTokens = {
  colors: {
    brand: {
      primary: "hsl(243 75% 59%)",
      primaryForeground: "hsl(0 0% 100%)",
      secondary: "hsl(243 47% 94%)",
      secondaryForeground: "hsl(243 75% 30%)",
      accent: "hsl(243 47% 94%)",
      accentForeground: "hsl(243 75% 30%)",
    },
    surface: {
      background: "hsl(0 0% 100%)",
      foreground: "hsl(222 47% 11%)",
      muted: "hsl(210 40% 96%)",
      mutedForeground: "hsl(215 16% 47%)",
      border: "hsl(214 32% 91%)",
      input: "hsl(214 32% 85%)",
      ring: "hsl(243 75% 59%)",
    },
    semantic: {
      success: "hsl(142 71% 45%)",
      warning: "hsl(38 92% 50%)",
      error: "hsl(0 72% 51%)",
      info: "hsl(217 91% 60%)",
    },
    severity: {
      critical: "hsl(0 72% 51%)",
      high: "hsl(25 95% 53%)",
      medium: "hsl(48 96% 53%)",
      low: "hsl(200 98% 39%)",
      info: "hsl(220 14% 46%)",
    },
  },
  typography: {
    fontFamily: {
      sans: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    },
    scale: "default",
    headingWeight: "600",
    monoProminence: "normal",
  },
  spacing: { base: 4, scale: "default" },
  density: "default",
  borders: { radius: "md", width: "default", style: "solid" },
  shadows: "default",
  navigation: { style: "sidebar", sidebarWidth: "default", sidebarVariant: "default" },
  components: { card: "bordered", button: "default", input: "default", table: "default", badge: "default" },
  charts: {
    style: "minimal",
    colorPalette: [
      "hsl(243 75% 59%)",
      "hsl(142 71% 45%)",
      "hsl(38 92% 50%)",
      "hsl(0 72% 51%)",
      "hsl(217 91% 60%)",
    ],
    gridLines: true,
    animations: false,
  },
  icons: { set: "lucide" },
  product: { name: "Forge", tagline: "Master SaaS framework" },
};

/**
 * Materially different token set: dark navy surface, high-contrast alerts,
 * compact density/typography, narrow sidebar, flat cards, sharp buttons,
 * striped tables, pill badges, no shadows.
 */
export const contrastingTheme: ThemeTokens = {
  colors: {
    brand: {
      primary: "hsl(220 98% 55%)",
      primaryForeground: "hsl(0 0% 100%)",
      secondary: "hsl(222 30% 18%)",
      secondaryForeground: "hsl(210 40% 96%)",
      accent: "hsl(350 89% 60%)",
      accentForeground: "hsl(0 0% 100%)",
    },
    surface: {
      background: "hsl(222 47% 7%)",
      foreground: "hsl(210 40% 96%)",
      muted: "hsl(217 33% 12%)",
      mutedForeground: "hsl(215 20% 65%)",
      border: "hsl(217 33% 20%)",
      input: "hsl(217 33% 24%)",
      ring: "hsl(220 98% 55%)",
    },
    semantic: {
      success: "hsl(160 84% 39%)",
      warning: "hsl(32 95% 44%)",
      error: "hsl(0 84% 60%)",
      info: "hsl(199 89% 48%)",
    },
    severity: {
      critical: "hsl(0 84% 60%)",
      high: "hsl(25 95% 53%)",
      medium: "hsl(45 93% 47%)",
      low: "hsl(199 89% 48%)",
      info: "hsl(215 20% 65%)",
    },
  },
  typography: {
    fontFamily: {
      sans: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    },
    scale: "compact",
    headingWeight: "700",
    monoProminence: "high",
  },
  spacing: { base: 4, scale: "tight" },
  density: "compact",
  borders: { radius: "sm", width: "thin", style: "solid" },
  shadows: "none",
  navigation: { style: "sidebar", sidebarWidth: "narrow", sidebarVariant: "inset" },
  components: { card: "flat", button: "sharp", input: "filled", table: "striped", badge: "pill" },
  charts: {
    style: "detailed",
    colorPalette: [
      "hsl(220 98% 55%)",
      "hsl(0 84% 60%)",
      "hsl(160 84% 39%)",
      "hsl(32 95% 44%)",
      "hsl(199 89% 48%)",
    ],
    gridLines: false,
    animations: true,
  },
  icons: { set: "custom" },
  product: { name: "Sentinel", tagline: "Security scanning" },
};
