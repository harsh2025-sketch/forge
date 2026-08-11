/**
 * @forge/ui — Button primitive (V3 §10.3). Consumes theme tokens via CSS
 * variables only; no hard-coded product colors.
 */

import type { ButtonHTMLAttributes, CSSProperties } from "react";
import { tokenVar } from "../theme/apply.js";
import { cn } from "../classnames.js";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
}

const BUTTON_BACKGROUND: Record<ButtonVariant, string> = {
  primary: tokenVar(["colors", "brand", "primary"]),
  secondary: tokenVar(["colors", "brand", "secondary"]),
  ghost: "transparent",
  danger: tokenVar(["colors", "semantic", "error"]),
};

const BUTTON_FOREGROUND: Record<ButtonVariant, string> = {
  primary: tokenVar(["colors", "brand", "primaryForeground"]),
  secondary: tokenVar(["colors", "brand", "secondaryForeground"]),
  ghost: tokenVar(["colors", "surface", "foreground"]),
  danger: tokenVar(["colors", "surface", "background"]),
};

const SIZE_PADDING_Y: Record<ButtonSize, string> = {
  sm: "calc(var(--forge-spacing-unit) * 1)",
  md: "calc(var(--forge-spacing-unit) * 2)",
  lg: "calc(var(--forge-spacing-unit) * 2.5)",
};

const SIZE_FONT: Record<ButtonSize, string> = {
  sm: "calc(var(--forge-typography-font-size) * 0.875)",
  md: "var(--forge-typography-font-size)",
  lg: "calc(var(--forge-typography-font-size) * 1.125)",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  style,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const buttonStyle: CSSProperties = {
    backgroundColor: BUTTON_BACKGROUND[variant],
    color: BUTTON_FOREGROUND[variant],
    borderRadius: "var(--forge-components-button-radius)",
    borderWidth: "var(--forge-borders-width)",
    borderStyle: "var(--forge-borders-style)",
    borderColor: "transparent",
    padding: `${SIZE_PADDING_Y[size]} calc(var(--forge-spacing-unit) * 3)`,
    fontFamily: "var(--forge-typography-font-family-sans)",
    fontSize: SIZE_FONT[size],
    fontWeight: "var(--forge-typography-heading-weight)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : undefined,
    ...style,
  };

  return (
    <button
      type={type}
      className={cn("forge-button", `forge-button--${variant}`, `forge-button--${size}`, className)}
      style={buttonStyle}
      disabled={disabled}
      {...rest}
    />
  );
}
