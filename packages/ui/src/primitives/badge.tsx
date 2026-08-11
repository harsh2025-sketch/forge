/**
 * @forge/ui — Badge primitive (V3 §10.3). Tones map to semantic token colors;
 * shape (pill/square/default) comes from the token layer via
 * `--forge-components-badge-radius`.
 */

import type { CSSProperties, HTMLAttributes } from "react";
import { tokenVar } from "../theme/apply.js";
import { cn } from "../classnames.js";

export type BadgeTone = "neutral" | "success" | "warning" | "error" | "info";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: BadgeTone;
}

const BADGE_BACKGROUND: Record<BadgeTone, string> = {
  neutral: tokenVar(["colors", "surface", "muted"]),
  success: tokenVar(["colors", "semantic", "success"]),
  warning: tokenVar(["colors", "semantic", "warning"]),
  error: tokenVar(["colors", "semantic", "error"]),
  info: tokenVar(["colors", "semantic", "info"]),
};

const BADGE_FOREGROUND: Record<BadgeTone, string> = {
  neutral: tokenVar(["colors", "surface", "mutedForeground"]),
  success: tokenVar(["colors", "surface", "background"]),
  warning: tokenVar(["colors", "surface", "background"]),
  error: tokenVar(["colors", "surface", "background"]),
  info: tokenVar(["colors", "surface", "background"]),
};

export function Badge({ tone = "neutral", className, style, ...rest }: BadgeProps) {
  const badgeStyle: CSSProperties = {
    display: "inline-block",
    backgroundColor: BADGE_BACKGROUND[tone],
    color: BADGE_FOREGROUND[tone],
    borderRadius: "var(--forge-components-badge-radius)",
    padding: "calc(var(--forge-spacing-unit) * 0.5) calc(var(--forge-spacing-unit) * 2)",
    fontFamily: "var(--forge-typography-font-family-sans)",
    fontSize: "calc(var(--forge-typography-font-size) * 0.8125)",
    fontWeight: "var(--forge-typography-heading-weight)",
    lineHeight: 1.4,
    ...style,
  };

  return <span className={cn("forge-badge", `forge-badge--${tone}`, className)} style={badgeStyle} {...rest} />;
}
