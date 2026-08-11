/**
 * ChartContainer tests (V3 §10.3): structural frame that wraps any chart
 * library — no chart library is coupled into @forge/ui.
 */

import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { ChartContainer } from "../charts/chart-container.js";

describe("ChartContainer", () => {
  it("renders the frame with title, body slot and legend slot", () => {
    const html = renderToString(
      <ChartContainer title="Findings over time" legend={<span>legend</span>}>
        <svg aria-label="chart" />
      </ChartContainer>
    );

    expect(html).toContain('class="forge-chart"');
    expect(html).toContain(">Findings over time</h3>");
    expect(html).toContain('class="forge-chart-body"');
    expect(html).toContain("<svg");
    expect(html).toContain('class="forge-chart-legend"');
    expect(html).toContain("legend");
  });

  it("applies explicit pixel heights and default height", () => {
    const explicit = renderToString(<ChartContainer height={320}>…</ChartContainer>);
    expect(explicit).toContain("height:320px");

    const defaulted = renderToString(<ChartContainer>…</ChartContainer>);
    expect(defaulted).toContain("height:16rem");
  });
});
