/**
 * @forge/ui — Tabs primitive (V3 §10.3). Structural tablist; active state is
 * token-driven (brand color), never hard-coded.
 */

import type { CSSProperties, ReactNode } from "react";
import { tokenVar } from "../theme/apply.js";
import { cn } from "../classnames.js";

export interface TabItem {
  readonly id: string;
  readonly label: string;
}

export interface TabsProps {
  readonly items: readonly TabItem[];
  readonly activeId?: string;
  readonly onSelect?: (id: string) => void;
  readonly panel?: ReactNode;
  readonly className?: string;
}

export function Tabs({ items, activeId, onSelect, panel, className }: TabsProps) {
  const listStyle: CSSProperties = {
    display: "flex",
    gap: "calc(var(--forge-spacing-unit) * 1)",
    borderBottom: "var(--forge-borders-width) var(--forge-borders-style) var(--forge-colors-surface-border)",
  };

  const tabStyle = (active: boolean): CSSProperties => ({
    background: "transparent",
    border: "none",
    borderBottom: active ? "2px solid var(--forge-colors-brand-primary)" : "2px solid transparent",
    color: active
      ? tokenVar(["colors", "brand", "primary"])
      : tokenVar(["colors", "surface", "mutedForeground"]),
    padding: "calc(var(--forge-spacing-unit) * 1) calc(var(--forge-spacing-unit) * 3)",
    fontFamily: "var(--forge-typography-font-family-sans)",
    fontSize: "var(--forge-typography-font-size)",
    cursor: "pointer",
    marginBottom: "-1px",
  });

  return (
    <div className={cn("forge-tabs", className)}>
      <div role="tablist" className="forge-tabs-list" style={listStyle}>
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={cn("forge-tab", active && "forge-tab--active")}
              style={tabStyle(active)}
              onClick={() => onSelect?.(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {panel !== undefined && (
        <div role="tabpanel" className="forge-tabs-panel" style={{ paddingTop: "calc(var(--forge-spacing-unit) * 3)" }}>
          {panel}
        </div>
      )}
    </div>
  );
}
