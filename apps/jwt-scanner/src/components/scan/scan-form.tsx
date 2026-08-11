/**
 * Scan submission form (client component, V3 §20.2 Day 13).
 *
 * The form collects a compact JWT (and an optional project name), calls the
 * injected server action, and surfaces validation/error states from the
 * `Result` the action returns. The action is injected through props so this
 * component stays free of server-only imports (testable with renderToString).
 */

"use client";

import { useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, FormField, Input } from "@forge/ui";
import type { Result } from "@forge/shared";

export interface ScanFormProps {
  /** Server action that submits a scan (returns job id). */
  readonly submitAction: (raw: unknown) => Promise<Result<{ jobId: string; findings: number }, string>>;
}

export function ScanForm({ submitAction }: ScanFormProps): ReactNode {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await submitAction({
        token,
        ...(projectName.trim() === "" ? {} : { projectName: projectName.trim() }),
      });
      if (result.ok) {
        router.push(`/scans/${result.value.jobId}`);
        return;
      }
      setError(result.error);
    } catch {
      setError("The scan could not be submitted. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit} aria-label="Scan a JWT">
        <FormField
          label="JSON Web Token"
          htmlFor="scan-token"
          required
          hint="Paste a compact JWT: header.payload.signature (base64url). It is analyzed in memory and never stored."
        >
          <textarea
            id="scan-token"
            name="token"
            value={token}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setToken(event.target.value)}
            placeholder="eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjM0NTY3ODkwIn0."
            rows={6}
            required
            aria-label="JWT token to scan"
            style={{
              width: "100%",
              backgroundColor: "var(--forge-colors-surface-background)",
              color: "var(--forge-colors-surface-foreground)",
              borderWidth: "var(--forge-borders-width)",
              borderStyle: "var(--forge-borders-style)",
              borderColor: "var(--forge-colors-surface-input)",
              borderRadius: "var(--forge-borders-radius)",
              padding: "calc(var(--forge-spacing-unit) * 2) calc(var(--forge-spacing-unit) * 3)",
              fontFamily: "var(--forge-typography-font-family-mono)",
              fontSize: "var(--forge-typography-font-size)",
            }}
          />
        </FormField>

        <FormField
          label="Project name (optional)"
          htmlFor="scan-project"
          hint="Groups scans under a project. Defaults to “Default project”."
        >
          <Input
            id="scan-project"
            name="projectName"
            value={projectName}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setProjectName(event.target.value)}
            placeholder="Default project"
            maxLength={200}
            aria-label="Project name"
          />
        </FormField>

        {error !== null && (
          <p role="alert" className="scan-form-error" style={{ color: "var(--forge-colors-semantic-error)" }}>
            {error}
          </p>
        )}

        <div style={{ marginTop: "calc(var(--forge-spacing-unit) * 3)" }}>
          <Button type="submit" disabled={submitting || token.trim() === ""}>
            {submitting ? "Scanning…" : "Run scan"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
