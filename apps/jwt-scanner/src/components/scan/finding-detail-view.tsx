/**
 * Finding detail view (V3 §20.2 Day 13 — finding detail).
 *
 * Displays the information the domain engine produced and the feature layer
 * persisted: category, severity, title/description, evidence (decoded
 * header/payload — never the raw token, V3 §11.3), recommendation and
 * references. The deterministic finding identifier is shown; the UI never
 * re-analyzes the token or fabricates findings.
 */

import type { ReactNode } from "react";
import { Card, SeverityBadge } from "@forge/ui";
import type { FindingRow } from "@/db/schema";

export interface FindingDetailViewProps {
  readonly finding: FindingRow;
  readonly jobId: string;
  /** Renders a link back to the scan results (injected). */
  readonly renderBackLink?: (jobId: string) => ReactNode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** jsonb reference arrays arrive as `unknown`; sanitize to string arrays. */
function referencesOf(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

/** Renders a JSON value safely (evidence objects come from jsonb). */
function JsonValue({ value }: { readonly value: unknown }): ReactNode {
  if (value === null || value === undefined) return <span>—</span>;
  if (typeof value === "string") return <span>{value}</span>;
  if (typeof value === "number" || typeof value === "boolean") return <span>{String(value)}</span>;
  return <span style={{ fontFamily: "var(--forge-typography-font-family-mono)", fontSize: "calc(var(--forge-typography-font-size) * 0.9)" }}>{JSON.stringify(value)}</span>;
}

export function FindingDetailView({ finding, jobId, renderBackLink }: FindingDetailViewProps): ReactNode {
  const evidence = isRecord(finding.evidence) ? finding.evidence : {};

  return (
    <div className="finding-detail">
      {renderBackLink !== undefined && (
        <div style={{ marginBottom: "calc(var(--forge-spacing-unit) * 3)" }}>{renderBackLink(jobId)}</div>
      )}

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: "calc(var(--forge-spacing-unit) * 3)", flexWrap: "wrap" }}>
          <SeverityBadge severity={finding.severity} />
          <span style={{ fontFamily: "var(--forge-typography-font-family-mono)", fontSize: "calc(var(--forge-typography-font-size) * 0.9)" }}>
            {finding.category}
          </span>
          <span style={{ color: "var(--forge-colors-surface-muted-foreground)" }}>{finding.id}</span>
        </div>
        <h2 style={{ marginBottom: "calc(var(--forge-spacing-unit) * 2)" }}>{finding.title}</h2>
        <p style={{ margin: 0 }}>{finding.description}</p>
      </Card>

      <Card>
        <h3 style={{ marginTop: 0 }}>Evidence</h3>
        <p style={{ color: "var(--forge-colors-surface-muted-foreground)" }}>
          Decoded JWT material from the analyzed token. The raw token itself is never persisted.
        </p>
        <section aria-label="Decoded header">
          <h4 style={{ marginBottom: "calc(var(--forge-spacing-unit) * 1)" }}>Header</h4>
          <pre
            style={{
              backgroundColor: "var(--forge-colors-surface-muted)",
              padding: "calc(var(--forge-spacing-unit) * 2)",
              borderRadius: "var(--forge-borders-radius)",
              overflow: "auto",
              fontFamily: "var(--forge-typography-font-family-mono)",
              fontSize: "calc(var(--forge-typography-font-size) * 0.9)",
            }}
          >
            {JSON.stringify(evidence.header ?? {}, null, 2)}
          </pre>
        </section>
        <section aria-label="Decoded payload" style={{ marginTop: "calc(var(--forge-spacing-unit) * 3)" }}>
          <h4 style={{ marginBottom: "calc(var(--forge-spacing-unit) * 1)" }}>Payload</h4>
          <pre
            style={{
              backgroundColor: "var(--forge-colors-surface-muted)",
              padding: "calc(var(--forge-spacing-unit) * 2)",
              borderRadius: "var(--forge-borders-radius)",
              overflow: "auto",
              fontFamily: "var(--forge-typography-font-family-mono)",
              fontSize: "calc(var(--forge-typography-font-size) * 0.9)",
            }}
          >
            {JSON.stringify(evidence.payload ?? {}, null, 2)}
          </pre>
        </section>
        <p style={{ color: "var(--forge-colors-surface-muted-foreground)" }}>
          Signature segment present: {String(evidence.signaturePresent ?? false)}
        </p>
      </Card>

      <Card>
        <h3 style={{ marginTop: 0 }}>Recommendation</h3>
        <p style={{ margin: 0 }}>{finding.recommendation ?? "No recommendation provided."}</p>
        {finding.remediationCode !== null && (
          <pre
            style={{
              backgroundColor: "var(--forge-colors-surface-muted)",
              padding: "calc(var(--forge-spacing-unit) * 2)",
              borderRadius: "var(--forge-borders-radius)",
              overflow: "auto",
              fontFamily: "var(--forge-typography-font-family-mono)",
              fontSize: "calc(var(--forge-typography-font-size) * 0.9)",
            }}
          >
            {finding.remediationCode}
          </pre>
        )}
        {referencesOf(finding.references).length > 0 && (
          <ul>
            {referencesOf(finding.references).map((reference) => (
              <li key={reference}>
                <JsonValue value={reference} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
