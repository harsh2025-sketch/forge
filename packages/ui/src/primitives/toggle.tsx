/**
 * @forge/ui — Toggle (switch) primitive (V3 §10.3). role="switch", token-driven
 * on/off colors.
 */

import type { ButtonHTMLAttributes, CSSProperties } from "react";
import { tokenVar } from "../theme/apply.js";
import { cn } from "../classnames.js";

export interface ToggleProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type"> {
  readonly checked: boolean;
  readonly onToggle?: (next: boolean) => void;
  /** Accessible name for the switch (rendered as aria-label). */
  readonly label?: string;
}

export function Toggle({ checked, onToggle, label, className, style, ...rest }: ToggleProps) {
  const trackStyle: CSSProperties = {
    width: 44,
    height: 24,
    borderRadius: 9999,
    border: "none",
    padding: 2,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: checked ? "flex-end" : "flex-start",
    backgroundColor: checked
      ? tokenVar(["colors", "brand", "primary"])
      : tokenVar(["colors", "surface", "muted"]),
    cursor: "pointer",
    ...style,
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cn("forge-toggle", className)}
      style={trackStyle}
      onClick={() => onToggle?.(!checked)}
      {...rest}
    >
      <span
        aria-hidden="true"
        style={{
          display: "block",
          width: 20,
          height: 20,
          borderRadius: 9999,
          backgroundColor: tokenVar(["colors", "surface", "background"]),
        }}
      />
    </button>
  );
}
