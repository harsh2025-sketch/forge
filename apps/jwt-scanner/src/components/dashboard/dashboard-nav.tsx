/**
 * Dashboard navigation (V3 §10.3): token-driven Sidebar composition.
 * Item content and active state are product-owned; the Sidebar primitive
 * provides the structure.
 */

import type { ReactNode } from "react";
import { Sidebar } from "@forge/ui";

export interface DashboardNavProps {
  readonly activePath: string;
  readonly orgName: string;
}

export function DashboardNav({ activePath, orgName }: DashboardNavProps): ReactNode {
  const isActive = (href: string): boolean => activePath.startsWith(href);
  return (
    <Sidebar
      header={
        <div style={{ padding: "calc(var(--forge-spacing-unit) * 3)", fontWeight: "var(--forge-typography-heading-weight)" }}>
          JWT Scanner
          <div style={{ fontWeight: "normal", color: "var(--forge-colors-surface-muted-foreground)", fontSize: "calc(var(--forge-typography-font-size) * 0.9)" }}>
            {orgName}
          </div>
        </div>
      }
      items={[
        { label: "Scanner", href: "/scanner", active: isActive("/scanner") },
        { label: "Billing", href: "/billing", active: isActive("/billing") },
      ]}
      footer={
        <div style={{ padding: "calc(var(--forge-spacing-unit) * 3)", color: "var(--forge-colors-surface-muted-foreground)", fontSize: "calc(var(--forge-typography-font-size) * 0.9)" }}>
          <a href="/" style={{ color: "inherit" }}>
            Landing
          </a>
        </div>
      }
    />
  );
}
