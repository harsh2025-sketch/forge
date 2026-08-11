/**
 * @forge/ui — EmptyState composite (V3 §10.3): centered empty/placeholder state.
 */

import type { CSSProperties, ReactNode } from "react";
import { tokenVar } from "../theme/apply.js";
import { cn } from "../classnames.js";

export interface EmptyStateProps {
  readonly title: string;
  readonly description?: string;
  readonly children?: ReactNode;
  readonly className?: string;
}

export function EmptyState({ title, description, children, className }: EmptyStateProps) {
  const style: CSSProperties = {
    textAlign: "center",
    padding: "calc(var(--forge-spacing-unit) * 8)",
    color: tokenVar(["colors", "surface", "mutedForeground"]),
    fontFamily: "var(--forge-typography-font-family-sans)",
  };

  return (
    <div className={cn("forge-empty-state", className)} style={style}>
      <p style={{ margin: 0, fontWeight: "var(--forge-typography-heading-weight)", color: tokenVar(["colors", "surface", "foreground"]) }}>
        {title}
      </p>
      {description !== undefined && <p style={{ margin: "calc(var(--forge-spacing-unit) * 1) 0 0 0" }}>{description}</p>}
      {children !== undefined && <div style={{ marginTop: "calc(var(--forge-spacing-unit) * 4)" }}>{children}</div>}
    </div>
  );
}
