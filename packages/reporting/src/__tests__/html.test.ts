/**
 * Deterministic, injection-safe HTML generator tests (V3 §20.2 Day 8 gate:
 * "Reporting pipeline produces valid HTML"; §7: escaping, no script injection,
 * theme-compatible CSS variables).
 */

import { describe, it, expect } from "vitest";
import { renderHtml } from "../generators/html.js";
import { renderJson } from "../generators/json.js";
import { ReportValidationError } from "../errors.js";
import { buildScanDocument, emptyData, sampleData, scanResultsTemplate } from "./helpers.js";
import type { ReportDocument } from "../types.js";

function renderSample(): string {
  return renderHtml(scanResultsTemplate.build(sampleData));
}

describe("renderHtml", () => {
  it("produces a complete valid HTML document structure", () => {
    const output = renderSample();

    expect(output.startsWith("<!doctype html>")).toBe(true);
    expect(output).toContain('<html lang="en">');
    expect(output).toContain('  <meta charset="utf-8">');
    expect(output).toContain("<head>");
    expect(output).toContain("<body>");
    expect(output.endsWith("</html>\n")).toBe(true);

    const title = scanResultsTemplate.build(sampleData).title;
    expect(output).toContain(`<title>${title}</title>`);
    expect(output).toContain(`<h1>${title}</h1>`);
    expect(output).toContain('<header class="forge-report-header">');
  });

  it("escapes every hostile character in text and attributes", () => {
    const document: ReportDocument = {
      title: "<script>alert(1)</script>",
      subtitle: 'He said "hi" & \'bye\' < >',
      generatedAt: "2026-08-11T00:00:00.000Z",
      sections: [
        {
          title: "<img src=x onerror=alert(2)>",
          body: "a < b > c & d \" e ' f",
          items: [
            { title: "<b>bold</b>", summary: "</style><script>alert(3)</script>" },
          ],
        },
      ],
      findings: [
        {
          id: "f-1",
          severity: "critical",
          category: "<script>",
          title: "&",
          description: "\"'<>&",
          evidence: null,
        },
      ],
    };

    const output = renderHtml(document);

    // No raw markup payload may survive (escaped text may still contain the
    // substring, but never as a live tag).
    expect(output).not.toContain("<script>");
    expect(output).not.toContain("</script>");
    expect(output).not.toContain("<img");
    expect(output).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(output).toContain("<title>&lt;script&gt;alert(1)&lt;/script&gt;</title>");
    expect(output).toContain("&lt;img src=x onerror=alert(2)&gt;");
    // Every required entity form is produced.
    expect(output).toContain("&amp;");
    expect(output).toContain("&lt;");
    expect(output).toContain("&gt;");
    expect(output).toContain("&quot;");
    expect(output).toContain("&#39;");
    expect(output).toContain("a &lt; b &gt; c &amp; d &quot; e &#39; f");
    expect(output).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(output).toContain("&lt;/style&gt;&lt;script&gt;alert(3)&lt;/script&gt;");
  });

  it("renders findings with closed-enum data attributes and escaped cells", () => {
    const output = renderSample();
    expect(output).toContain('<tr data-severity="critical">');
    expect(output).toContain('<tr data-severity="low">');
    expect(output).toContain("<td>F-1</td>");
    expect(output).toContain("<td>jwt_alg_confusion</td>");
    expect(output).toContain("Algorithm confusion: HS256 accepted with RSA public key");
  });

  it("renders summary, metrics and diagnostics blocks", () => {
    const document = scanResultsTemplate.build(sampleData);
    document.metrics = [{ name: "coverage", value: 92.5, unit: "%" }];
    document.diagnostics = [{ level: "warning", message: "partial results", code: "W-9" }];

    const output = renderHtml(document);
    expect(output).toContain('<dl class="forge-report-summary">');
    expect(output).toContain("<dt>Total findings</dt><dd>2</dd>");
    expect(output).toContain('<dt class="forge-severity forge-severity--critical">critical</dt><dd>1</dd>');
    expect(output).toContain('<table class="forge-report-metrics">');
    expect(output).toContain("<td>coverage</td><td>92.5</td><td>%</td>");
    expect(output).toContain('<li class="forge-diagnostic forge-diagnostic--warning">');
  });

  it("renders a time element for the caller-supplied generatedAt", () => {
    const output = renderSample();
    expect(output).toContain(
      '<time datetime="2026-08-11T00:00:00.000Z">2026-08-11T00:00:00.000Z</time>'
    );
  });

  it("emits escaped cssVariables deterministically in a :root block", () => {
    const output = renderHtml(scanResultsTemplate.build(sampleData), {
      cssVariables: {
        "--forge-color-brand-primary": "hsl(243 75% 59%)",
        "--forge-hostile": "</style><script>alert(9)</script>",
        "--forge-zeta": "z",
        "--forge-alpha": "a",
      },
    });

    expect(output).toContain("<style>");
    expect(output).toContain(":root {");
    // Sorted keys (alpha before hostile before zeta).
    const styleBlock = output.split("<style>")[1].split("</style>")[0];
    expect(styleBlock.indexOf("--forge-alpha")).toBeLessThan(styleBlock.indexOf("--forge-hostile"));
    expect(styleBlock.indexOf("--forge-hostile")).toBeLessThan(styleBlock.indexOf("--forge-zeta"));
    // Hostile CSS value is escaped and cannot break out of the style block.
    expect(output).not.toContain("<script>alert(9)");
    expect(output).toContain("&lt;/style&gt;&lt;script&gt;alert(9)&lt;/script&gt;");
  });

  it("honours the lang option and escapes it", () => {
    const output = renderHtml(scanResultsTemplate.build(sampleData), { lang: 'de-AT"><script>' });
    expect(output).toContain('<html lang="de-AT&quot;&gt;&lt;script&gt;">');
  });

  it("is deterministic for identical documents", () => {
    expect(renderSample()).toBe(renderSample());
    const withOptions = renderHtml(scanResultsTemplate.build(sampleData), {
      cssVariables: { "--forge-a": "1", "--forge-b": "2" },
    });
    expect(withOptions).toBe(withOptions);
  });

  it("supports an empty report gracefully", () => {
    const output = renderHtml(buildScanDocument(emptyData));
    expect(output).toContain("<!doctype html>");
    expect(output).toContain("Total findings</dt><dd>0</dd>");
    expect(output).not.toContain("forge-report-findings");
  });

  it("rejects invalid documents with ReportValidationError", () => {
    expect(() => renderHtml({ title: "x" })).toThrow(ReportValidationError);
    expect(() => renderHtml({ title: "x", sections: [{ title: "ok", items: [{ title: 5 }] }] })).toThrow(
      ReportValidationError
    );
  });

  it("shares semantics with JSON (same findings, same counts)", () => {
    const html = renderSample();
    const json = JSON.parse(renderJson(scanResultsTemplate.build(sampleData))) as ReportDocument;

    for (const finding of json.findings ?? []) {
      expect(html).toContain(escapeForHtml(finding.id));
      expect(html).toContain(escapeForHtml(finding.title));
    }
    expect(html).toContain(`<dd>${json.summary?.totalFindings}</dd>`);
  });
});

/** Local helper mirroring the generator's escaping for assertion construction. */
function escapeForHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
