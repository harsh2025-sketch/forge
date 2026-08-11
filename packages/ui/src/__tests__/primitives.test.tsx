/**
 * Primitive component tests (V3 §10.3): structural markup, accessibility
 * attributes and token-layer consumption (var(--forge-...)) via SSR.
 * Components must never hard-code product colors — verified in contrast.test.tsx.
 */

import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Button } from "../primitives/button.js";
import { Input } from "../primitives/input.js";
import { Card } from "../primitives/card.js";
import { Dialog } from "../primitives/dialog.js";
import { Select } from "../primitives/select.js";
import { Tabs } from "../primitives/tabs.js";
import { Table } from "../primitives/table.js";
import { Badge } from "../primitives/badge.js";
import { Checkbox } from "../primitives/checkbox.js";
import { Toggle } from "../primitives/toggle.js";
import { Hero, FeatureList, PricingTable, CTA, Testimonials } from "../primitives/landing.js";

describe("Button", () => {
  it("renders a button consuming brand token variables", () => {
    const html = renderToString(<Button>Run scan</Button>);
    expect(html).toContain('<button type="button" class="forge-button forge-button--primary forge-button--md"');
    expect(html).toContain("background-color:var(--forge-colors-brand-primary)");
    expect(html).toContain("color:var(--forge-colors-brand-primary-foreground)");
    expect(html).toContain("border-radius:var(--forge-components-button-radius)");
    expect(html).toContain("Run scan");
  });

  it("supports variants, sizes, disabled and custom className", () => {
    const html = renderToString(
      <Button variant="danger" size="sm" disabled className="custom">
        Stop
      </Button>
    );
    expect(html).toContain("forge-button--danger");
    expect(html).toContain("forge-button--sm");
    expect(html).toContain("custom");
    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("background-color:var(--forge-colors-semantic-error)");
  });
});

describe("Input", () => {
  it("renders a token-driven text input with placeholder/aria-label", () => {
    const html = renderToString(<Input aria-label="Target URL" placeholder="https://" />);
    expect(html).toContain('<input class="forge-input"');
    expect(html).toContain("background-color:var(--forge-colors-surface-background)");
    expect(html).toContain("border-color:var(--forge-colors-surface-input)");
    expect(html).toContain('placeholder="https://"');
    expect(html).toContain('aria-label="Target URL"');
  });
});

describe("Card", () => {
  it("renders a bordered card by default with token border/radius", () => {
    const html = renderToString(<Card>Content</Card>);
    expect(html).toContain('class="forge-card forge-card--bordered"');
    expect(html).toContain("var(--forge-colors-surface-border)");
    expect(html).toContain("border-radius:var(--forge-borders-radius)");
    expect(html).toContain("Content");
  });

  it("elevated variant consumes the card shadow variable", () => {
    const html = renderToString(<Card variant="elevated">Content</Card>);
    expect(html).toContain("box-shadow:var(--forge-components-card-shadow)");
    expect(html).toContain("forge-card--elevated");
  });
});

describe("Dialog", () => {
  it("renders a modal dialog with title and close control", () => {
    const html = renderToString(
      <Dialog title="Delete scan" onClose={() => undefined}>
        Are you sure?
      </Dialog>
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="forge-dialog-title"');
    expect(html).toContain("Delete scan");
    expect(html).toContain('aria-label="Close dialog"');
    expect(html).toContain("background-color:var(--forge-overlay)");
  });

  it("omits the close button when no onClose handler is given", () => {
    const html = renderToString(<Dialog title="Info">Text</Dialog>);
    expect(html).not.toContain("Close dialog");
  });
});

describe("Select", () => {
  it("renders options plus optional placeholder", () => {
    const html = renderToString(
      <Select
        aria-label="Severity"
        placeholder="Any severity"
        options={[
          { value: "critical", label: "Critical" },
          { value: "high", label: "High" },
        ]}
      />
    );
    expect(html).toContain('<option value="" disabled="">Any severity</option>');
    expect(html).toContain('<option value="critical">Critical</option>');
    expect(html).toContain('<option value="high">High</option>');
  });
});

describe("Tabs", () => {
  it("renders a tablist with aria-selected and active styling", () => {
    const html = renderToString(
      <Tabs
        items={[
          { id: "overview", label: "Overview" },
          { id: "findings", label: "Findings" },
        ]}
        activeId="findings"
        panel={<p>panel content</p>}
      />
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-selected="false"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("forge-tab--active");
    expect(html).toContain("border-bottom:2px solid var(--forge-colors-brand-primary)");
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain("panel content");
  });
});

describe("Table", () => {
  interface Row extends Record<string, unknown> {
    id: string;
    score: number;
  }

  it("renders headers and cells with token-driven styling", () => {
    const html = renderToString(
      <Table<Row>
        columns={[
          { key: "id", header: "ID" },
          { key: "score", header: "Score", align: "right" },
        ]}
        rows={[
          { id: "a", score: 10 },
          { id: "b", score: 20 },
        ]}
      />
    );
    expect(html).toContain("<th scope=\"col\"");
    expect(html).toContain(">ID</th>");
    expect(html).toContain(">Score</th>");
    expect(html).toContain(">a</td>");
    expect(html).toContain(">20</td>");
    expect(html).toContain("background-color:var(--forge-colors-surface-muted)");
  });

  it("renders a striped style block only for the striped variant", () => {
    const striped = renderToString(
      <Table<Row> variant="striped" columns={[{ key: "id", header: "ID" }]} rows={[{ id: "x" }]} />
    );
    expect(striped).toContain(".forge-table--striped tbody tr:nth-child(even)");
    expect(striped).toContain("var(--forge-colors-surface-muted)");

    const plain = renderToString(
      <Table<Row> columns={[{ key: "id", header: "ID" }]} rows={[{ id: "x" }]} />
    );
    expect(plain).not.toContain("nth-child(even)");
  });

  it("renders caption and custom cell renderers", () => {
    const html = renderToString(
      <Table<Row>
        caption="Results"
        columns={[{ key: "id", header: "ID", render: (row) => <strong>{row.id}</strong> }]}
        rows={[{ id: "a", score: 1 }]}
      />
    );
    expect(html).toContain(">Results</caption>");
    expect(html).toContain("<strong>a</strong>");
  });
});

describe("Badge", () => {
  it("renders tone-driven badges via semantic tokens", () => {
    const html = renderToString(<Badge tone="error">Failed</Badge>);
    expect(html).toContain("forge-badge--error");
    expect(html).toContain("background-color:var(--forge-colors-semantic-error)");
    expect(html).toContain("border-radius:var(--forge-components-badge-radius)");
    expect(html).toContain("Failed");
  });
});

describe("Checkbox", () => {
  it("renders a labelled checkbox using brand accent-color", () => {
    const html = renderToString(<Checkbox label="Notify by email" defaultChecked />);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("accent-color:var(--forge-colors-brand-primary)");
    expect(html).toContain("Notify by email");
    expect(html).toContain("checked=\"\"");
  });
});

describe("Toggle", () => {
  it("renders role=switch with aria-checked and token colors", () => {
    const checked = renderToString(<Toggle checked label="Enable auto-scan" />);
    expect(checked).toContain('role="switch"');
    expect(checked).toContain('aria-checked="true"');
    expect(checked).toContain('aria-label="Enable auto-scan"');
    expect(checked).toContain("background-color:var(--forge-colors-brand-primary)");

    const unchecked = renderToString(<Toggle checked={false} label="Enable auto-scan" />);
    expect(unchecked).toContain('aria-checked="false"');
    expect(unchecked).toContain("background-color:var(--forge-colors-surface-muted)");
  });
});

describe("Landing primitives (V3 §10.5)", () => {
  it("renders Hero with title/subtitle/children", () => {
    const html = renderToString(
      <Hero title="Secure by default" subtitle="Scan your JWTs">
        <Button>Get started</Button>
      </Hero>
    );
    expect(html).toContain('class="forge-hero"');
    expect(html).toContain(">Secure by default</h1>");
    expect(html).toContain("Scan your JWTs");
    expect(html).toContain("Get started");
  });

  it("renders FeatureList items", () => {
    const html = renderToString(
      <FeatureList
        features={[
          { title: "Fast", description: "Runs in ms" },
          { title: "Safe", description: "No network calls" },
        ]}
      />
    );
    expect(html).toContain("forge-feature");
    expect(html).toContain(">Fast</h3>");
    expect(html).toContain(">Safe</h3>");
  });

  it("renders PricingTable tiers", () => {
    const html = renderToString(
      <PricingTable
        tiers={[
          { name: "Pro", price: "$29", features: ["Unlimited scans"], ctaLabel: "Start trial" },
        ]}
      />
    );
    expect(html).toContain("forge-pricing-tier");
    expect(html).toContain(">Pro</h3>");
    expect(html).toContain("$29");
    expect(html).toContain("Unlimited scans");
  });

  it("renders CTA with brand token background", () => {
    const html = renderToString(<CTA title="Get started" description="Free 14-day trial" />);
    expect(html).toContain("background-color:var(--forge-colors-brand-primary)");
    expect(html).toContain("color:var(--forge-colors-brand-primary-foreground)");
  });

  it("renders Testimonials quotes", () => {
    const html = renderToString(
      <Testimonials items={[{ quote: "Great tool", author: "Ada", role: "CTO" }]} />
    );
    expect(html).toContain(">Great tool</blockquote>");
    expect(html).toContain(">Ada</strong>");
    expect(html).toContain("CTO");
  });
});
