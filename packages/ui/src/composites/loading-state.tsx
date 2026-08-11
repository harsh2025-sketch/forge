/**
 * @forge/ui — LoadingState composite (V3 §10.3): accessible loading indicator
 * (role="status" + aria-busy) with a static, class-scoped spinner animation.
 */

import type { CSSProperties } from "react";
import { tokenVar } from "../theme/apply.js";
import { cn } from "../classnames.js";

const SPIN_KEYFRAMES = "@keyframes forge-spin{to{transform:rotate(360deg)}}";

export interface LoadingStateProps {
  readonly label?: string;
  readonly className?: string;
}

export function LoadingState({ label, className }: LoadingStateProps) {
  const style: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "calc(var(--forge-spacing-unit) * 2)",
    color: tokenVar(["colors", "surface", "mutedForeground"]),
    fontFamily: "var(--forge-typography-font-family-sans)",
    fontSize: "var(--forge-typography-font-size)",
  };

  return (
    <div className={cn("forge-loading", className)} role="status" aria-busy="true" style={style}>
      <style>{SPIN_KEYFRAMES}</style>
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: 16,
          height: 16,
          borderRadius: 9999,
          border: "2px solid var(--forge-colors-surface-border)",
          borderTopColor: tokenVar(["colors", "brand", "primary"]),
          animation: "forge-spin 0.8s linear infinite",
        }}
      />
      <span>{label ?? "Loading…"}</span>
    </div>
  );
}
