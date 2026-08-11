# @forge/ui

UI infrastructure for the Forge Master SaaS Framework (V3 Day 8, §3.2, §10, P13).

React structural components + the ThemeTokens / CSS custom property theme
system. Depends only on `react` + `react-dom` (`.ai/boundaries.md`:
`packages/ui` imports react/react-dom only; no `@forge/domain`, no `@forge/db`,
no ports, no adapters).

## Principle

**Theme tokens, not visual templates (P13).** Components never hard-code a
product's colors/fonts/spacing — they reference `var(--forge-...)` custom
properties. `ThemeTokens` is the contract; `defaultTheme`/`contrastingTheme`
are shipped token sets; `themeToCssVariables(tokens)` maps tokens → CSS custom
properties, which `ThemeScope` applies inline (or products embed in their
`globals.css` via `themeToCss`).

```
ThemeTokens  →  CSS custom properties  →  UI rendering
```

Two token sets applied to the same UI structure render genuinely different
output — proven by the `contrast` test suite.

## Provided (V3 §10.3)

| Layer | Components |
|-------|-----------|
| Primitives | Button, Input, Card, Dialog, Select, Tabs, Table, Badge, Checkbox, Toggle + landing primitives (Hero, FeatureList, PricingTable, CTA, Testimonials) |
| Composites | DataTable, FormField, StatusBadge, SeverityBadge, EmptyState, LoadingState, Pagination |
| Layout shells | Shell, Sidebar, TopNav (structural, token-styled) |
| Chart containers | ChartContainer (wraps any chart library) |
| Theme | `ThemeTokens` interface, `defaultTheme`, `contrastingTheme`, `themeToCssVariables`/`themeToCss`/`flattenThemeTokens`, `ThemeScope` |

## Not provided

Color/typography choices, token values (products override), landing page
layouts, severity category definitions, chart libraries, navigation item
content, wordmarks/logos.

## Notes

- Choice tokens (radius/width/style/shadow/scale/density/sidebar width) are
  resolved to concrete CSS values by `themeToCssVariables`; components consume
  the resolved variables only.
- `SeverityBadge` accepts severity key strings (e.g. `"critical"`) and uses
  `colors.severity.*` tokens when defined, falling back to semantic tones —
  severity category definitions stay product-owned.
