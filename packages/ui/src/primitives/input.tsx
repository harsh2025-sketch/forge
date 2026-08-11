/**
 * @forge/ui — Input primitive (V3 §10.3). Token-driven via CSS variables.
 */

import type { CSSProperties, InputHTMLAttributes } from "react";
import { tokenVar } from "../theme/apply.js";
import { cn } from "../classnames.js";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, style, ...rest }: InputProps) {
  const inputStyle: CSSProperties = {
    backgroundColor: tokenVar(["colors", "surface", "background"]),
    color: tokenVar(["colors", "surface", "foreground"]),
    borderWidth: "var(--forge-borders-width)",
    borderStyle: "var(--forge-borders-style)",
    borderColor: tokenVar(["colors", "surface", "input"]),
    borderRadius: "var(--forge-borders-radius)",
    padding: "calc(var(--forge-spacing-unit) * 2) calc(var(--forge-spacing-unit) * 3)",
    fontFamily: "var(--forge-typography-font-family-sans)",
    fontSize: "var(--forge-typography-font-size)",
    width: "100%",
    ...style,
  };

  return <input className={cn("forge-input", className)} style={inputStyle} {...rest} />;
}
