/**
 * @forge/ui — Card primitive (V3 §10.3). Variants come from the token layer
 * (`--forge-components-card-shadow`, surface colors); no hard-coded branding.
 */

import type { CSSProperties, HTMLAttributes } from "react";
import { tokenVar } from "../theme/apply.js";
import { cn } from "../classnames.js";

export type CardVariant = "flat" | "bordered" | "elevated" | "glass";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly variant?: CardVariant;
}

const CARD_BACKGROUND: Record<CardVariant, string> = {
  flat: "transparent",
  bordered: tokenVar(["colors", "surface", "background"]),
  elevated: tokenVar(["colors", "surface", "background"]),
  glass: tokenVar(["colors", "surface", "muted"]),
};

const CARD_BORDER: Record<CardVariant, string> = {
  flat: "none",
  bordered: "var(--forge-borders-width) var(--forge-borders-style) var(--forge-colors-surface-border)",
  elevated: "none",
  glass: "var(--forge-borders-width) var(--forge-borders-style) var(--forge-colors-surface-border)",
};

export function Card({ variant = "bordered", className, style, ...rest }: CardProps) {
  const cardStyle: CSSProperties = {
    backgroundColor: CARD_BACKGROUND[variant],
    color: tokenVar(["colors", "surface", "foreground"]),
    border: CARD_BORDER[variant],
    borderRadius: "var(--forge-borders-radius)",
    boxShadow: "var(--forge-components-card-shadow)",
    padding: "calc(var(--forge-spacing-unit) * 4)",
    ...style,
  };

  return <div className={cn("forge-card", `forge-card--${variant}`, className)} style={cardStyle} {...rest} />;
}
