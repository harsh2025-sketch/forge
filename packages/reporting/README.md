# @forge/reporting

Report generation infrastructure for the Forge Master SaaS Framework (V3 Day 8, §3.2, §20.2).

Provider-neutral, framework-neutral, product-neutral reporting subsystem.
Depends only on `@forge/domain` + `@forge/shared` (V3 §4.1).

## Conceptual flow

```
Report data/model  →  ReportTemplate  →  pipeline  →  JSON | Markdown | HTML (+ optional PDF)
```

## Exports

| Module | Purpose |
|--------|---------|
| `ReportTemplate<TData>` | Contract: `{ name, format, build(data) → ReportDocument }` |
| `ReportDocument` | Canonical format-neutral report model (supports `ReportSummary`, `BaseFinding`, `Metric`, `Diagnostic` from `@forge/domain`) |
| `ReportFormat` | `"json" \| "markdown" \| "html" \| "pdf"` enum + `isReportFormat` guard |
| `renderJson(document)` | Deterministic JSON (sorted keys, explicit errors, no env values) |
| `renderMarkdown(document)` | Deterministic Markdown (headings, tables, lists, escaping) |
| `renderHtml(document, options?)` | Deterministic, injection-safe HTML (all user text escaped; optional `cssVariables` bridge to `@forge/ui` theme tokens) |
| `renderPdf(html, options?)` | Optional HTML→PDF wrapper (puppeteer-core, dynamic import, injectable launcher) |
| `render(report, data, format?)` | Pipeline orchestrator — one entry point for json/markdown/html |
| `renderPdfReport(report, data, options?)` | Async pipeline entry for the optional PDF format |
| `ReportRenderError` / `ReportValidationError` | Typed errors (extend `@forge/shared` `AppError`) |

## Boundaries

- MUST NOT import adapters, vendor SDKs, `@forge/db`, application code or any
  frontend framework.
- No environment reads, no clocks, no network calls in the core generators —
  all timestamps are caller-supplied (`generatedAt`), so output is deterministic.
- Puppeteer is an **optional dependency** (`puppeteer-core`) and is imported
  dynamically only when `renderPdf` is invoked; the core pipeline never touches
  a browser, and ordinary tests inject a fake launcher.
