/**
 * @forge/ui — ChartContainer (V3 §10.3): wraps ANY chart library. The container
 * owns the sizing/border frame; chart rendering is delegated to children so no
 * chart library is coupled into @forge/ui.
 */

import type { CSSProperties, ReactNode } from "react";
import { tokenVar } from "../theme/apply.js";
import { cn } from "../classnames.js";

export interface ChartContainerProps {
  readonly title?: string;
  readonly height?: number | string;
  readonly legend?: ReactNode;
  readonly children?: ReactNode;
  readonly className?: string;
}

export function ChartContainer({ title, height = "16rem", legend, children, className }: ChartContainerProps) {
  const frameStyle: CSSProperties = {
    border: "var(--forge-borders-width) var(--forge-borders-style) var(--forge-colors-surface-border)",
    borderRadius: "var(--forge-borders-radius)",
    padding: "calc(var(--forge-spacing-unit) * 3)",
    backgroundColor: tokenVar(["colors", "surface", "background"]),
  };

  const bodyStyle: CSSProperties = {
    position: "relative",
    height: typeof height === "number" ? `${height}px` : height,
    overflow: "hidden",
  };

  return (
    <div className={cn("forge-chart", className)} style={frameStyle}>
      {title !== undefined && (
        <h3
          style={{
            margin: "0 0 calc(var(--forge-spacing-unit) * 2) 0",
            fontSize: "calc(var(--forge-typography-font-size) * 0.875)",
            fontWeight: "var(--forge-typography-heading-weight)",
            color: tokenVar(["colors", "surface", "mutedForeground"]),
          }}
        >
          {title}
        </h3>
      )}
      <div className="forge-chart-body" style={bodyStyle}>
        {children}
      </div>
      {legend !== undefined && <div className="forge-chart-legend">{legend}</div>}
    </div>
  );
}
