/**
 * @forge/ui — ThemeScope: applies ThemeTokens to a component subtree as inline
 * CSS custom properties (V3 §10.3 CSS custom property application).
 *
 * Components always reference `var(--forge-...)`; ThemeScope provides the
 * variable values. This is what makes the same UI structure render genuinely
 * differently under two token sets (Day-8 validation gate) while keeping zero
 * product branding inside components.
 */

import type { CSSProperties, ElementType, ReactNode } from "react";
import type { ThemeTokens } from "./types.js";
import { themeToCssVariables } from "./apply.js";
import { cn } from "../classnames.js";

export interface ThemeScopeProps {
  readonly tokens: ThemeTokens;
  readonly as?: ElementType;
  readonly className?: string;
  readonly id?: string;
  readonly children?: ReactNode;
}

export function ThemeScope({
  tokens,
  as: Tag = "div",
  className,
  id,
  children,
}: ThemeScopeProps): ReactNode {
  const style = themeToCssVariables(tokens) as CSSProperties;
  return (
    <Tag id={id} className={cn("forge-theme", className)} style={style} data-forge-theme="true">
      {children}
    </Tag>
  );
}
