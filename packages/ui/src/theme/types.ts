/**
 * @forge/ui — ThemeTokens contract (V3 §10.2, FROZEN verbatim).
 *
 * P13 — "Theme tokens, not visual templates": products define their visual
 * identity entirely through these tokens. UI components depend on ThemeTokens
 * (via CSS custom properties), never on hard-coded product branding. Two
 * products on the same framework must be able to look substantially different
 * by changing token values only (§10.4).
 *
 * All color values are HSL strings (e.g. "hsl(243 75% 59%)").
 */

export interface ThemeTokens {
  readonly colors: {
    readonly brand: {
      readonly primary: string; // HSL string
      readonly primaryForeground: string;
      readonly secondary: string;
      readonly secondaryForeground: string;
      readonly accent: string;
      readonly accentForeground: string;
    };
    readonly surface: {
      readonly background: string;
      readonly foreground: string;
      readonly muted: string;
      readonly mutedForeground: string;
      readonly border: string;
      readonly input: string;
      readonly ring: string;
    };
    readonly semantic: {
      readonly success: string;
      readonly warning: string;
      readonly error: string;
      readonly info: string;
    };
    readonly severity?: {
      // Optional — Analyzer/Optimizer products
      readonly critical: string;
      readonly high: string;
      readonly medium: string;
      readonly low: string;
      readonly info: string;
    };
  };

  readonly typography: {
    readonly fontFamily: {
      readonly sans: string; // CSS font-family string
      readonly mono: string;
    };
    readonly scale: "compact" | "default" | "relaxed";
    readonly headingWeight: "400" | "500" | "600" | "700";
    readonly monoProminence: "low" | "normal" | "high"; // How prominent monospace is in UI
  };

  readonly spacing: {
    readonly base: number; // Base unit in px (typically 4)
    readonly scale: "tight" | "default" | "loose";
  };

  readonly density: "compact" | "default" | "comfortable";

  readonly borders: {
    readonly radius: "none" | "sm" | "md" | "lg" | "full";
    readonly width: "thin" | "default" | "thick";
    readonly style: "solid" | "dashed" | "none";
  };

  readonly shadows: "none" | "subtle" | "default" | "prominent";

  readonly navigation: {
    readonly style: "sidebar" | "topnav" | "minimal" | "hybrid";
    readonly sidebarWidth?: "narrow" | "default" | "wide";
    readonly sidebarVariant?: "floating" | "inset" | "default";
  };

  readonly components: {
    readonly card: "flat" | "bordered" | "elevated" | "glass";
    readonly button: "default" | "sharp" | "rounded";
    readonly input: "default" | "underline" | "filled";
    readonly table: "default" | "striped" | "minimal" | "bordered";
    readonly badge: "default" | "pill" | "square";
  };

  readonly charts?: {
    // Optional — products using charts
    readonly style: "minimal" | "detailed" | "filled";
    readonly colorPalette: readonly string[];
    readonly gridLines: boolean;
    readonly animations: boolean;
  };

  readonly icons: {
    readonly set: "lucide" | "heroicons" | "radix" | "custom";
  };

  readonly product: {
    readonly name: string;
    readonly tagline?: string;
    readonly logoMark?: string; // SVG string or URL
    readonly wordmark?: string; // SVG string or URL
  };
}
