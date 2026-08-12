/**
 * @forge/ui — Notice composite (V3 §10.3): inline notification primitive.
 * Info/success use role="status"; warning/error use role="alert".
 * Products supply copy; the framework only supplies structure and tokens.
 */

import type { CSSProperties, ReactNode } from "react";
import { tokenVar } from "../theme/apply.js";
import { cn } from "../classnames.js";

export type NoticeTone = "info" | "success" | "warning" | "error";

export interface NoticeProps {
  readonly title: string;
  readonly description?: string;
  readonly tone?: NoticeTone;
  readonly children?: ReactNode;
  readonly className?: string;
}

const TONE_COLOR: Record<NoticeTone, string> = {
  info: tokenVar(["colors", "semantic", "info"]),
  success: tokenVar(["colors", "semantic", "success"]),
  warning: tokenVar(["colors", "semantic", "warning"]),
  error: tokenVar(["colors", "semantic", "error"]),
};

export function Notice({ title, description, tone = "info", children, className }: NoticeProps) {
  const accent = TONE_COLOR[tone];
  const style: CSSProperties = {
    border: "var(--forge-borders-width) var(--forge-borders-style) var(--forge-colors-surface-border)",
    borderLeft: `4px solid ${accent}`,
    borderRadius: "var(--forge-borders-radius)",
    padding: "calc(var(--forge-spacing-unit) * 3)",
    backgroundColor: tokenVar(["colors", "surface", "muted"]),
    color: tokenVar(["colors", "surface", "foreground"]),
    fontFamily: "var(--forge-typography-font-family-sans)",
    fontSize: "var(--forge-typography-font-size)",
  };

  return (
    <div
      className={cn("forge-notice", `forge-notice--${tone}`, className)}
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
      style={style}
    >
      <p style={{ margin: 0, fontWeight: "var(--forge-typography-heading-weight)", color: accent }}>{title}</p>
      {description !== undefined && (
        <p style={{ margin: "calc(var(--forge-spacing-unit) * 1) 0 0 0", color: tokenVar(["colors", "surface", "mutedForeground"]) }}>
          {description}
        </p>
      )}
      {children !== undefined && <div style={{ marginTop: "calc(var(--forge-spacing-unit) * 2)" }}>{children}</div>}
    </div>
  );
}
