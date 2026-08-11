/**
 * @forge/ui — Sidebar layout shell (V3 §10.3): structural navigation rail.
 * Width comes from the token layer (`--forge-navigation-sidebar-width`);
 * active state is brand-driven. Item content stays product-owned.
 */

import type { CSSProperties, ReactNode } from "react";
import { tokenVar } from "../theme/apply.js";
import { cn } from "../classnames.js";

export interface SidebarItem {
  readonly label: string;
  readonly href?: string;
  readonly active?: boolean;
  readonly icon?: ReactNode;
}

export interface SidebarProps {
  readonly items: readonly SidebarItem[];
  readonly header?: ReactNode;
  readonly footer?: ReactNode;
  readonly className?: string;
}

export function Sidebar({ items, header, footer, className }: SidebarProps) {
  const asideStyle: CSSProperties = {
    width: "var(--forge-navigation-sidebar-width, 18rem)",
    flexShrink: 0,
    borderRight: "var(--forge-borders-width) var(--forge-borders-style) var(--forge-colors-surface-border)",
    backgroundColor: tokenVar(["colors", "surface", "background"]),
    display: "flex",
    flexDirection: "column",
    overflow: "auto",
  };

  const listStyle: CSSProperties = {
    listStyle: "none",
    margin: 0,
    padding: "calc(var(--forge-spacing-unit) * 2)",
    display: "flex",
    flexDirection: "column",
    gap: "calc(var(--forge-spacing-unit) * 1)",
    flex: 1,
  };

  const itemStyle = (active: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "calc(var(--forge-spacing-unit) * 2)",
    padding: "calc(var(--forge-spacing-unit) * 1.5) calc(var(--forge-spacing-unit) * 2)",
    borderRadius: "var(--forge-borders-radius)",
    textDecoration: "none",
    fontFamily: "var(--forge-typography-font-family-sans)",
    fontSize: "var(--forge-typography-font-size)",
    fontWeight: active ? "var(--forge-typography-heading-weight)" : undefined,
    backgroundColor: active ? tokenVar(["colors", "brand", "primary"]) : "transparent",
    color: active
      ? tokenVar(["colors", "brand", "primaryForeground"])
      : tokenVar(["colors", "surface", "foreground"]),
  });

  return (
    <aside className={cn("forge-sidebar", className)} style={asideStyle}>
      {header !== undefined && <div className="forge-sidebar-header">{header}</div>}
      <nav aria-label="Sidebar">
        <ul style={listStyle}>
          {items.map((item) => {
            const style = itemStyle(item.active === true);
            const content = (
              <>
                {item.icon !== undefined && <span aria-hidden="true">{item.icon}</span>}
                <span>{item.label}</span>
              </>
            );
            return (
              <li key={item.label}>
                {item.href !== undefined ? (
                  <a href={item.href} className={cn("forge-sidebar-item", item.active && "forge-sidebar-item--active")} style={style}>
                    {content}
                  </a>
                ) : (
                  <span className={cn("forge-sidebar-item", item.active && "forge-sidebar-item--active")} style={style}>
                    {content}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      {footer !== undefined && <div className="forge-sidebar-footer">{footer}</div>}
    </aside>
  );
}
