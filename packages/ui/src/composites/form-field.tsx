/**
 * @forge/ui — FormField composite (V3 §10.3): label + control slot + hint/error
 * text. Error presentation is token-driven (semantic error color).
 */

import type { ReactNode } from "react";
import { tokenVar } from "../theme/apply.js";
import { cn } from "../classnames.js";

export interface FormFieldProps {
  readonly label: string;
  readonly htmlFor?: string;
  readonly hint?: string;
  readonly error?: string;
  readonly required?: boolean;
  readonly children?: ReactNode;
  readonly className?: string;
}

export function FormField({ label, htmlFor, hint, error, required, children, className }: FormFieldProps) {
  const id = htmlFor ?? `forge-form-field-${label}`;

  return (
    <div className={cn("forge-form-field", className)}>
      <label
        htmlFor={id}
        style={{
          display: "block",
          marginBottom: "calc(var(--forge-spacing-unit) * 1)",
          fontFamily: "var(--forge-typography-font-family-sans)",
          fontSize: "var(--forge-typography-font-size)",
          fontWeight: "var(--forge-typography-heading-weight)",
          color: tokenVar(["colors", "surface", "foreground"]),
        }}
      >
        {label}
        {required === true && (
          <span aria-hidden="true" style={{ color: tokenVar(["colors", "semantic", "error"]) }}>
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {error !== undefined ? (
        <p
          role="alert"
          className="forge-form-field-error"
          style={{
            margin: "calc(var(--forge-spacing-unit) * 1) 0 0 0",
            fontSize: "calc(var(--forge-typography-font-size) * 0.875)",
            color: tokenVar(["colors", "semantic", "error"]),
          }}
        >
          {error}
        </p>
      ) : hint !== undefined ? (
        <p
          className="forge-form-field-hint"
          style={{
            margin: "calc(var(--forge-spacing-unit) * 1) 0 0 0",
            fontSize: "calc(var(--forge-typography-font-size) * 0.875)",
            color: tokenVar(["colors", "surface", "mutedForeground"]),
          }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
