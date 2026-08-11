/**
 * JWT Scanner — theme token tests (V3 §10, §20.2 Day 11).
 *
 * The Day-11 contract requires a security-tool identity: dark palette,
 * compact density, prominent severity colors. These tests pin that identity
 * and the determinism of the CSS application layer (globals.css is generated
 * from tokens.ts and must never drift from it).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { defaultTheme, themeToCss, themeToCssVariables } from "@forge/ui";
import { jwtScannerTheme } from "../tokens.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function hslLightness(hsl: string): number {
  const match = /hsl\(\s*(\d+)\s+(\d+)%\s+(\d+)%/.exec(hsl);
  if (match === null) throw new Error(`not an HSL color: ${hsl}`);
  return Number(match[3]);
}

describe("jwtScannerTheme — security-tool identity (V3 §10.4)", () => {
  it("uses a dark navy surface", () => {
    expect(hslLightness(jwtScannerTheme.colors.surface.background)).toBeLessThan(15);
    expect(hslLightness(jwtScannerTheme.colors.surface.muted)).toBeLessThan(25);
    expect(hslLightness(jwtScannerTheme.colors.surface.foreground)).toBeGreaterThan(90);
  });

  it("is compact and data-dense", () => {
    expect(jwtScannerTheme.typography.scale).toBe("compact");
    expect(jwtScannerTheme.density).toBe("compact");
    expect(jwtScannerTheme.spacing.scale).toBe("tight");
    expect(jwtScannerTheme.navigation.sidebarWidth).toBe("narrow");
  });

  it("declares the full severity palette with prominent alert colors", () => {
    const severity = jwtScannerTheme.colors.severity;
    expect(severity).toBeDefined();
    if (severity !== undefined) {
      expect(hslLightness(severity.critical)).toBeLessThan(70);
      expect(hslLightness(severity.high)).toBeLessThan(70);
      expect(hslLightness(severity.medium)).toBeLessThan(70);
      expect(new Set([severity.critical, severity.high, severity.medium, severity.low, severity.info]).size).toBe(5);
    }
  });

  it("uses flat, bordered, sharp-edged components (terminal-like)", () => {
    expect(jwtScannerTheme.shadows).toBe("none");
    expect(jwtScannerTheme.components.card).toBe("bordered");
    expect(jwtScannerTheme.components.button).toBe("sharp");
    expect(jwtScannerTheme.components.table).toBe("striped");
    expect(jwtScannerTheme.components.badge).toBe("pill");
  });

  it("carries the product identity", () => {
    expect(jwtScannerTheme.product.name).toBe("JWT Scanner");
    expect(jwtScannerTheme.product.tagline).toBe("Scan JWTs for security issues");
  });

  it("is materially different from the UI baseline (two products can look different)", () => {
    expect(jwtScannerTheme.colors.surface.background).not.toBe(defaultTheme.colors.surface.background);
    expect(jwtScannerTheme.density).not.toBe(defaultTheme.density);
    expect(jwtScannerTheme.typography.scale).not.toBe(defaultTheme.typography.scale);
    expect(jwtScannerTheme.shadows).not.toBe(defaultTheme.shadows);
  });
});

describe("theme application layer", () => {
  it("renders deterministic CSS (same tokens, same output)", () => {
    expect(themeToCss(jwtScannerTheme)).toBe(themeToCss(jwtScannerTheme));
  });

  it("globals.css is in sync with tokens.ts (generated, never hand-edited)", () => {
    const css = readFileSync(join(__dirname, "..", "..", "theme", "globals.css"), "utf8");
    expect(css).toContain(themeToCss(jwtScannerTheme));
  });

  it("resolved variables carry the security identity values", () => {
    const variables = themeToCssVariables(jwtScannerTheme);
    expect(variables["--forge-colors-surface-background"]).toBe(jwtScannerTheme.colors.surface.background);
    expect(variables["--forge-density"]).toBe("compact");
    expect(variables["--forge-typography-font-size"]).toBe("13px");
    expect(variables["--forge-navigation-sidebar-width"]).toBe("16rem");
    expect(variables["--forge-colors-severity-critical"]).toBe(jwtScannerTheme.colors.severity?.critical);
  });
});
