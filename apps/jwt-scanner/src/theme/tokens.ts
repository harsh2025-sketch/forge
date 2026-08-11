/**
 * JWT Scanner design tokens — V3 §10 (P13: theme tokens, not templates).
 *
 * Security-tool identity per V3 §10.4:
 *   - dark navy surface with red/crimson alerts
 *   - compact typography and density (data-dense findings views)
 *   - narrow sidebar navigation
 *   - bordered cards, sharp buttons, striped tables, pill badges
 *   - no shadows (flat, terminal-like)
 *   - prominent severity palette (Analyzer products)
 *
 * Products own their token values; @forge/ui ships the structural contract
 * and the overridable baseline (defaultTheme). Same tokens → same CSS:
 * the application layer is produced deterministically by
 * `themeToCss(jwtScannerTheme)` (see globals.css).
 */

import type { ThemeTokens } from "@forge/ui";

export const jwtScannerTheme: ThemeTokens = {
  colors: {
    brand: {
      primary: "hsl(350 84% 60%)",
      primaryForeground: "hsl(0 0% 100%)",
      secondary: "hsl(222 30% 18%)",
      secondaryForeground: "hsl(210 40% 96%)",
      accent: "hsl(350 84% 60%)",
      accentForeground: "hsl(0 0% 100%)",
    },
    surface: {
      background: "hsl(222 47% 6%)",
      foreground: "hsl(210 40% 96%)",
      muted: "hsl(217 33% 12%)",
      mutedForeground: "hsl(215 20% 62%)",
      border: "hsl(217 33% 18%)",
      input: "hsl(217 33% 24%)",
      ring: "hsl(350 84% 60%)",
    },
    semantic: {
      success: "hsl(142 71% 45%)",
      warning: "hsl(38 92% 50%)",
      error: "hsl(0 84% 60%)",
      info: "hsl(217 91% 60%)",
    },
    severity: {
      critical: "hsl(0 84% 60%)",
      high: "hsl(25 95% 55%)",
      medium: "hsl(45 93% 52%)",
      low: "hsl(200 90% 48%)",
      info: "hsl(215 20% 60%)",
    },
  },
  typography: {
    fontFamily: {
      sans: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    },
    scale: "compact",
    headingWeight: "700",
    monoProminence: "normal",
  },
  spacing: { base: 4, scale: "tight" },
  density: "compact",
  borders: { radius: "sm", width: "default", style: "solid" },
  shadows: "none",
  navigation: { style: "sidebar", sidebarWidth: "narrow", sidebarVariant: "default" },
  components: {
    card: "bordered",
    button: "sharp",
    input: "default",
    table: "striped",
    badge: "pill",
  },
  charts: {
    style: "minimal",
    colorPalette: [
      "hsl(0 84% 60%)",
      "hsl(25 95% 55%)",
      "hsl(45 93% 52%)",
      "hsl(200 90% 48%)",
      "hsl(215 20% 60%)",
    ],
    gridLines: false,
    animations: false,
  },
  icons: { set: "lucide" },
  product: {
    name: "JWT Scanner",
    tagline: "Scan JWTs for security issues",
  },
};
