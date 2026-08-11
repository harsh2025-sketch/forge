/**
 * Composite component tests (V3 §10.3): composites compose primitives without
 * duplicating primitive logic.
 */

import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { DataTable } from "../composites/data-table.js";
import { FormField } from "../composites/form-field.js";
import { StatusBadge } from "../composites/status-badge.js";
import { SeverityBadge } from "../composites/severity-badge.js";
import { EmptyState } from "../composites/empty-state.js";
import { LoadingState } from "../composites/loading-state.js";
import { Pagination } from "../composites/pagination.js";
import { Input } from "../primitives/input.js";

/** React SSR inserts zero-width comment markers between adjacent text nodes. */
function stripComments(html: string): string {
  return html.replace(/<!-- -->/g, "");
}

interface Row extends Record<string, unknown> {
  id: string;
  status: string;
}

describe("DataTable", () => {
  it("composes the Table primitive for non-empty rows", () => {
    const html = renderToString(
      <DataTable<Row>
        columns={[
          { key: "id", header: "ID" },
          { key: "status", header: "Status" },
        ]}
        rows={[
          { id: "r1", status: "ok" },
          { id: "r2", status: "warn" },
        ]}
      />
    );
    expect(html).toContain("<table");
    expect(html).toContain("<th scope=\"col\"");
    expect(html).toContain(">r2</td>");
    expect(html).not.toContain("forge-empty-state");
  });

  it("composes EmptyState when there are no rows", () => {
    const html = renderToString(
      <DataTable<Row>
        columns={[{ key: "id", header: "ID" }]}
        rows={[]}
        emptyMessage="No scans yet"
        emptyDescription="Run your first scan to see results"
      />
    );
    expect(html).not.toContain("<table");
    expect(html).toContain("forge-empty-state");
    expect(html).toContain("No scans yet");
    expect(html).toContain("Run your first scan to see results");
  });
});

describe("FormField", () => {
  it("renders label, control and hint", () => {
    const html = renderToString(
      <FormField label="Target URL" htmlFor="target" hint="Must be a valid URL">
        <Input id="target" />
      </FormField>
    );
    expect(html).toContain('<label for="target"');
    expect(html).toContain("Target URL");
    expect(html).toContain('id="target"');
    expect(html).toContain("Must be a valid URL");
  });

  it("renders error state with role=alert and semantic token color", () => {
    const html = renderToString(
      <FormField label="Target URL" error="Invalid URL provided">
        <Input />
      </FormField>
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Invalid URL provided");
    expect(html).toContain("color:var(--forge-colors-semantic-error)");
    expect(html).not.toContain("forge-form-field-hint");
  });

  it("marks required fields", () => {
    const html = renderToString(<FormField label="API key" required>…</FormField>);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("*");
  });
});

describe("StatusBadge", () => {
  it("composes Badge with the status text and tone", () => {
    const html = renderToString(<StatusBadge status="Active" tone="success" />);
    expect(html).toContain("forge-badge forge-badge--success");
    expect(html).toContain("background-color:var(--forge-colors-semantic-success)");
    expect(html).toContain("Active");
  });
});

describe("SeverityBadge", () => {
  it("uses severity tokens for known severity keys", () => {
    const html = renderToString(<SeverityBadge severity="critical" />);
    expect(html).toContain("background-color:var(--forge-colors-severity-critical");
    expect(html).toContain("critical");
  });

  it("falls back to semantic error when severity tokens are undefined", () => {
    // No severity tokens in this theme → var fallback references semantic.error.
    const html = renderToString(
      <SeverityBadge severity="critical" />
    );
    expect(html).toMatch(/var\(--forge-colors-severity-critical, ?var\(--forge-colors-semantic-error\)\)/);
  });

  it("renders unknown severity keys neutrally without crashing", () => {
    const html = renderToString(<SeverityBadge severity="archived" label="Archived" />);
    expect(html).toContain("Archived");
    expect(html).toContain("forge-severity-badge");
  });
});

describe("EmptyState", () => {
  it("renders title, description and action slot", () => {
    const html = renderToString(
      <EmptyState title="Nothing here" description="Try adjusting filters">
        <button type="button">Reset</button>
      </EmptyState>
    );
    expect(html).toContain("forge-empty-state");
    expect(html).toContain("Nothing here");
    expect(html).toContain("Try adjusting filters");
    expect(html).toContain("Reset");
  });
});

describe("LoadingState", () => {
  it("renders an accessible busy indicator with token spinner", () => {
    const html = renderToString(<LoadingState label="Analyzing token…" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Analyzing token…");
    expect(html).toContain("border-top-color:var(--forge-colors-brand-primary)");
    expect(html).toContain("forge-spin");
  });
});

describe("Pagination", () => {
  it("renders the page window, status and disabled bounds", () => {
    const html = renderToString(<Pagination page={2} pageSize={10} total={45} />);
    expect(html).toContain('aria-label="Pagination"');
    expect(stripComments(html)).toContain("Page 2 of 5");
    expect(html).toContain('aria-label="Page 1"');
    expect(html).toContain('aria-label="Page 3"');
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('disabled=""'); // page 2 of 5: both bounds enabled
  });

  it("disables Previous on page 1 and Next on the last page", () => {
    const first = renderToString(<Pagination page={1} pageSize={10} total={45} />);
    expect(first).toContain('aria-label="Previous page" disabled=""');
    expect(first).not.toContain('aria-label="Next page" disabled=""');

    const last = renderToString(<Pagination page={5} pageSize={10} total={45} />);
    expect(stripComments(last)).toContain('aria-label="Next page" disabled=""');
    expect(stripComments(last)).not.toContain('aria-label="Previous page" disabled=""');
  });

  it("handles total=0 without crashing (single page, both disabled)", () => {
    const html = renderToString(<Pagination page={1} pageSize={10} total={0} />);
    expect(stripComments(html)).toContain("Page 1 of 1");
    expect(stripComments(html)).toContain('aria-label="Previous page" disabled=""');
    expect(html).toContain('aria-label="Next page" disabled=""');
  });

  it("is deterministic for identical props", () => {
    const props = { page: 2, pageSize: 10, total: 45 } as const;
    expect(renderToString(<Pagination {...props} />)).toBe(renderToString(<Pagination {...props} />));
  });
});
