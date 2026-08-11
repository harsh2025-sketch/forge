/**
 * Layout shell tests (V3 §10.3): Shell/Sidebar/TopNav are structural, token
 * styled, and carry no product content assumptions.
 */

import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Shell } from "../layouts/shell.js";
import { Sidebar } from "../layouts/sidebar.js";
import { TopNav } from "../layouts/top-nav.js";

describe("Shell", () => {
  it("renders sidebar, topNav and main slots", () => {
    const html = renderToString(
      <Shell
        sidebar={<Sidebar items={[{ label: "Scans" }]} />}
        topNav={<TopNav brand={<span>Brand</span>} />}
      >
        <h1>Dashboard</h1>
      </Shell>
    );

    expect(html).toContain('class="forge-shell"');
    expect(html).toContain("forge-sidebar");
    expect(html).toContain("forge-topnav");
    expect(html).toContain('<main class="forge-shell-main"');
    expect(html).toContain("<h1>Dashboard</h1>");
    expect(html).toContain("background-color:var(--forge-colors-surface-background)");
    expect(html).toContain("font-family:var(--forge-typography-font-family-sans)");
  });

  it("works without optional slots", () => {
    const html = renderToString(<Shell>Content only</Shell>);
    expect(html).toContain("Content only");
    expect(html).not.toContain("forge-sidebar");
    expect(html).not.toContain("forge-topnav");
  });
});

describe("Sidebar", () => {
  it("renders nav items with token-driven width and active state", () => {
    const html = renderToString(
      <Sidebar
        header={<strong>Workspace</strong>}
        items={[
          { label: "Overview", href: "/overview", active: true },
          { label: "Scans", href: "/scans" },
          { label: "Settings" },
        ]}
        footer={<span>v1.0</span>}
      />
    );

    expect(html).toContain('<aside class="forge-sidebar"');
    expect(html).toContain("width:var(--forge-navigation-sidebar-width, 18rem)");
    expect(html).toContain("border-right:var(--forge-borders-width)");
    expect(html).toContain('<a href="/overview"');
    expect(html).toContain("forge-sidebar-item--active");
    expect(html).toContain("background-color:var(--forge-colors-brand-primary)");
    expect(html).toContain('<a href="/scans"');
    expect(html).toContain("Workspace");
    expect(html).toContain("v1.0");
  });

  it("renders items without href as non-link elements", () => {
    const html = renderToString(<Sidebar items={[{ label: "Settings" }]} />);
    expect(html).toContain("<li><span");
    expect(html).not.toContain("<a ");
  });
});

describe("TopNav", () => {
  it("renders brand, nav children and actions slots", () => {
    const html = renderToString(
      <TopNav
        brand={<span className="brand">Forge</span>}
        actions={<button type="button">Sign out</button>}
      >
        <a href="/docs">Docs</a>
      </TopNav>
    );

    expect(html).toContain('<header class="forge-topnav"');
    expect(html).toContain('class="brand">Forge</span>');
    expect(html).toContain('<nav class="forge-topnav-nav"');
    expect(html).toContain('class="forge-topnav-actions"');
    expect(html).toContain("Sign out");
    expect(html).toContain("border-bottom:var(--forge-borders-width)");
  });
});
