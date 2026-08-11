/**
 * @forge/ui — Checkbox primitive (V3 §10.3). Brand color comes from tokens via
 * CSS `accent-color`.
 */

import type { CSSProperties, InputHTMLAttributes } from "react";
import { tokenVar } from "../theme/apply.js";
import { cn } from "../classnames.js";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  readonly label?: string;
}

export function Checkbox({ label, id, className, style, ...rest }: CheckboxProps) {
  const checkboxStyle: CSSProperties = {
    accentColor: tokenVar(["colors", "brand", "primary"]),
    ...style,
  };

  if (label === undefined) {
    return <input type="checkbox" id={id} className={cn("forge-checkbox", className)} style={checkboxStyle} {...rest} />;
  }

  return (
    <label
      className={cn("forge-checkbox-label", className)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "calc(var(--forge-spacing-unit) * 2)",
        fontFamily: "var(--forge-typography-font-family-sans)",
        fontSize: "var(--forge-typography-font-size)",
        color: tokenVar(["colors", "surface", "foreground"]),
        cursor: "pointer",
      }}
    >
      <input type="checkbox" id={id} className="forge-checkbox" style={checkboxStyle} {...rest} />
      <span>{label}</span>
    </label>
  );
}
