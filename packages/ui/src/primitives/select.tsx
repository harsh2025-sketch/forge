/**
 * @forge/ui — Select primitive (V3 §10.3). Native <select> styled through
 * theme tokens.
 */

import type { CSSProperties, SelectHTMLAttributes } from "react";
import { tokenVar } from "../theme/apply.js";
import { cn } from "../classnames.js";

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  readonly options: readonly SelectOption[];
  readonly placeholder?: string;
}

export function Select({ options, placeholder, className, style, ...rest }: SelectProps) {
  const selectStyle: CSSProperties = {
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

  return (
    <select className={cn("forge-select", className)} style={selectStyle} {...rest}>
      {placeholder !== undefined && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
