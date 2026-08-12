/**
 * @forge/ui — ErrorState composite (V3 §10.3): accessible error surface
 * (role="alert") that consumes semantic error tokens. Product copy and
 * recovery actions stay in the caller.
 */

import type { CSSProperties, ReactNode } from "react";
import { tokenVar } from "../theme/apply.js";
import { cn } from "../classnames.js";

export interface ErrorStateProps {
  readonly title: string;
  readonly description?: string;
  readonly children?: ReactNode;
  readonly className?: string;
}

export function ErrorState({ title, description, children, className }: ErrorStateProps) {
  const style: CSSProperties = {
    textAlign: "center",
    padding: "calc(var(--forge-spacing-unit) * 8)",
    color: tokenVar(["colors", "semantic", "error"]),
    fontFamily: "var(--forge-typography-font-family-sans)",
    border: "var(--forge-borders-width) var(--forge-borders-style) var(--forge-colors-semantic-error)",
    borderRadius: "var(--forge-borders-radius)",
    backgroundColor: tokenVar(["colors", "surface", "background"]),
  };

  return (
    <div className={cn("forge-error-state", className)} role="alert" style={style}>
      <p
        style={{
          margin: 0,
          fontWeight: "var(--forge-typography-heading-weight)",
          color: tokenVar(["colors", "semantic", "error"]),
        }}
      >
        {title}
      </p>
      {description !== undefined && (
        <p style={{ margin: "calc(var(--forge-spacing-unit) * 1) 0 0 0", color: tokenVar(["colors", "surface", "foreground"]) }}>
          {description}
        </p>
      )}
      {children !== undefined && <div style={{ marginTop: "calc(var(--forge-spacing-unit) * 4)" }}>{children}</div>}
    </div>
  );
}
