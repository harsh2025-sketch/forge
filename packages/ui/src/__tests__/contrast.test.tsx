/**
 * DAY-8 VALIDATION GATE — "Two contrasting token sets render differently"
 * (V3 §20.2 Day 8, P13).
 *
 * The same UI structure is rendered under `defaultTheme` and `contrastingTheme`.
 * The test proves the rendered representation genuinely differs and that the
 * difference is driven by the ThemeTokens layer (CSS custom properties), not by
 * component code: components only reference `var(--forge-...)` and never
 * hard-code brand colors.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { ThemeScope } from "../theme/scope.js";
import { defaultTheme, contrastingTheme } from "../theme/defaults.js";
import { themeToCss, themeToCssVariables } from "../theme/apply.js";
import { Shell } from "../layouts/shell.js";
import { Sidebar } from "../layouts/sidebar.js";
import { TopNav } from "../layouts/top-nav.js";
import { Card } from "../primitives/card.js";
import { Button } from "../primitives/button.js";
import { Badge } from "../primitives/badge.js";
import { SeverityBadge } from "../composites/severity-badge.js";
import { Table } from "../primitives/table.js";

const SHARED_STRUCTURE = (
  <Shell
    sidebar={
      <Sidebar
        header={<strong>Product</strong>}
        items={[
          { label: "Overview", href: "#overview", active: true },
          { label: "Scans", href: "#scans" },
        ]}
      />
    }
    topNav={<TopNav brand={<span>Brand</span>} actions={<Button>Run scan</Button>} />}
  >
    <Card>
      <SeverityBadge severity="critical" />
      <Badge tone="warning">Warning</Badge>
      <Table
        columns={[
          { key: "id", header: "ID" },
          { key: "severity", header: "Severity" },
        ]}
        rows={[
          { id: "F-1", severity: "critical" },
          { id: "F-2", severity: "low" },
        ]}
      />
    </Card>
  </Shell>
);

function renderWithTheme(theme: typeof defaultTheme): string {
  return renderToString(<ThemeScope tokens={theme}>{SHARED_STRUCTURE}</ThemeScope>);
}

const COMPONENT_DIRS = ["primitives", "composites", "layouts", "charts"] as const;
const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = dirname(TESTS_DIR);
const PACKAGE_DIR = dirname(SRC_DIR);

/** Color literals (hex, rgb/a, hsl/a, named colors) are forbidden in components. */
const COLOR_LITERAL_PATTERNS: readonly RegExp[] = [
  /#[0-9a-fA-F]{3,8}\b/,
  /\b(?:rgb|rgba|hsl|hsla)\(/,
  /\b(?:white|black|red|blue|green|yellow|orange|purple|gray|grey|navy|teal|pink|brown)\b/i,
];

function listComponentSources(): readonly string[] {
  const files: string[] = [];
  for (const directory of COMPONENT_DIRS) {
    const root = join(SRC_DIR, directory);
    const walk = (current: string): void => {
      for (const entry of readdirSync(current)) {
        const fullPath = join(current, entry);
        if (statSync(fullPath).isDirectory()) {
          walk(fullPath);
        } else if (entry.endsWith(".tsx")) {
          files.push(fullPath);
        }
      }
    };
    walk(root);
  }
  return files;
}

describe("contrasting theme validation gate", () => {
  it("the same UI structure renders differently under the two themes", () => {
    const htmlDefault = renderWithTheme(defaultTheme);
    const htmlContrasting = renderWithTheme(contrastingTheme);

    expect(htmlDefault).not.toBe(htmlContrasting);
  });

  it("the difference is driven by actual token/CSS-variable values, not component code", () => {
    const htmlDefault = renderWithTheme(defaultTheme);
    const htmlContrasting = renderWithTheme(contrastingTheme);

    // Both renderings carry the theme's resolved CSS variables inline.
    expect(htmlDefault).toContain("--forge-colors-brand-primary:hsl(243 75% 59%)");
    expect(htmlDefault).toContain("--forge-colors-surface-background:hsl(0 0% 100%)");
    expect(htmlContrasting).toContain("--forge-colors-brand-primary:hsl(220 98% 55%)");
    expect(htmlContrasting).toContain("--forge-colors-surface-background:hsl(222 47% 7%)");

    // Resolved choice values differ too (radius, font, density, shadows...).
    expect(htmlDefault).toContain("--forge-borders-radius:8px");
    expect(htmlDefault).toContain("--forge-typography-font-size:14px");
    expect(htmlContrasting).toContain("--forge-borders-radius:4px");
    expect(htmlContrasting).toContain("--forge-typography-font-size:13px");
  });

  it("component markup consumes the token layer (var(--forge-...) references)", () => {
    const html = renderWithTheme(defaultTheme);

    expect(html).toContain("background-color:var(--forge-colors-brand-primary)");
    expect(html).toContain("color:var(--forge-colors-brand-primary-foreground)");
    expect(html).toContain("border-radius:var(--forge-components-button-radius)");
    expect(html).toContain("background-color:var(--forge-colors-severity-critical");
    expect(html).toContain("box-shadow:var(--forge-components-card-shadow)");
  });

  it("the token maps and stylesheets differ in actual values", () => {
    const varsDefault = themeToCssVariables(defaultTheme);
    const varsContrasting = themeToCssVariables(contrastingTheme);

    expect(varsDefault["--forge-colors-brand-primary"]).not.toBe(
      varsContrasting["--forge-colors-brand-primary"]
    );
    expect(varsDefault["--forge-colors-surface-background"]).not.toBe(
      varsContrasting["--forge-colors-surface-background"]
    );
    expect(varsDefault["--forge-borders-radius"]).not.toBe(varsContrasting["--forge-borders-radius"]);
    expect(varsDefault["--forge-typography-font-size"]).not.toBe(varsContrasting["--forge-typography-font-size"]);
    expect(varsDefault["--forge-shadows"]).not.toBe(varsContrasting["--forge-shadows"]);
    expect(varsDefault["--forge-navigation-sidebar-width"]).not.toBe(
      varsContrasting["--forge-navigation-sidebar-width"]
    );

    // Material difference count: at least 10 resolved variables differ in value.
    const differing = Object.keys(varsDefault).filter(
      (key) => varsDefault[key] !== varsContrasting[key]
    );
    expect(differing.length).toBeGreaterThanOrEqual(10);

    expect(themeToCss(defaultTheme)).not.toBe(themeToCss(contrastingTheme));
  });

  it("components contain no hard-coded color literals (P13)", () => {
    const violations: string[] = [];
    for (const file of listComponentSources()) {
      const source = readFileSync(file, "utf8");
      for (const pattern of COLOR_LITERAL_PATTERNS) {
        if (pattern.test(source)) {
          violations.push(`${relative(PACKAGE_DIR, file)} matches ${String(pattern)}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
