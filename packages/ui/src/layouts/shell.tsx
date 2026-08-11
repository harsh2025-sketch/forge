/**
 * @forge/ui — Shell layout shell (V3 §10.3): structural app frame that
 * composes optional Sidebar/TopNav slots with a main content region. Pure
 * structure — no product content, no branding.
 */

import type { CSSProperties, ReactNode } from "react";
import { tokenVar } from "../theme/apply.js";
import { cn } from "../classnames.js";

export interface ShellProps {
  readonly sidebar?: ReactNode;
  readonly topNav?: ReactNode;
  readonly children?: ReactNode;
  readonly className?: string;
}

export function Shell({ sidebar, topNav, children, className }: ShellProps) {
  const shellStyle: CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    backgroundColor: tokenVar(["colors", "surface", "background"]),
    color: tokenVar(["colors", "surface", "foreground"]),
    fontFamily: "var(--forge-typography-font-family-sans)",
    fontSize: "var(--forge-typography-font-size)",
  };

  const bodyStyle: CSSProperties = {
    display: "flex",
    flex: 1,
    minHeight: 0,
  };

  const mainStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    overflow: "auto",
    padding: "calc(var(--forge-spacing-unit) * 6)",
  };

  return (
    <div className={cn("forge-shell", className)} style={shellStyle}>
      {topNav}
      <div className="forge-shell-body" style={bodyStyle}>
        {sidebar}
        <main className="forge-shell-main" style={mainStyle}>
          {children}
        </main>
      </div>
    </div>
  );
}
