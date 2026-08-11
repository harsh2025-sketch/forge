/**
 * @forge/ui — TopNav layout shell (V3 §10.3): structural top bar with brand
 * slot, nav slot and actions slot. Pure structure, token-driven colors.
 */

import type { CSSProperties, ReactNode } from "react";
import { tokenVar } from "../theme/apply.js";
import { cn } from "../classnames.js";

export interface TopNavProps {
  readonly brand?: ReactNode;
  readonly children?: ReactNode;
  readonly actions?: ReactNode;
  readonly className?: string;
}

export function TopNav({ brand, children, actions, className }: TopNavProps) {
  const style: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "calc(var(--forge-spacing-unit) * 4)",
    padding: "calc(var(--forge-spacing-unit) * 2) calc(var(--forge-spacing-unit) * 6)",
    borderBottom: "var(--forge-borders-width) var(--forge-borders-style) var(--forge-colors-surface-border)",
    backgroundColor: tokenVar(["colors", "surface", "background"]),
    color: tokenVar(["colors", "surface", "foreground"]),
  };

  return (
    <header className={cn("forge-topnav", className)} style={style}>
      {brand !== undefined && <div className="forge-topnav-brand">{brand}</div>}
      {children !== undefined && <nav className="forge-topnav-nav">{children}</nav>}
      {actions !== undefined && (
        <div className="forge-topnav-actions" style={{ marginLeft: "auto" }}>
          {actions}
        </div>
      )}
    </header>
  );
}
