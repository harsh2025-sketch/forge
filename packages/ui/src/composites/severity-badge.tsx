/**
 * @forge/ui — SeverityBadge primitive (V3 §10.3): uses the severity token set
 * (`colors.severity.*`) when the product defines it, otherwise falls back to
 * the semantic tone colors. Severity CATEGORY definitions remain product-owned
 * (§10.3 "Not Provided"); this component accepts any severity key string.
 */

import type { CSSProperties } from "react";
import { Badge } from "../primitives/badge.js";
import type { BadgeTone } from "../primitives/badge.js";
import { tokenVar } from "../theme/apply.js";
import { cn } from "../classnames.js";

const SEVERITY_KEYS = ["critical", "high", "medium", "low", "info"] as const;

/** Semantic fallback tone per severity key (used when severity tokens absent). */
const SEVERITY_TONE_FALLBACK: Record<(typeof SEVERITY_KEYS)[number], BadgeTone> = {
  critical: "error",
  high: "warning",
  medium: "warning",
  low: "info",
  info: "info",
};

export interface SeverityBadgeProps {
  readonly severity: string;
  readonly label?: string;
  readonly className?: string;
}

export function SeverityBadge({ severity, label, className }: SeverityBadgeProps) {
  const isKnown = (SEVERITY_KEYS as readonly string[]).includes(severity);
  const tone: BadgeTone = isKnown ? SEVERITY_TONE_FALLBACK[severity as (typeof SEVERITY_KEYS)[number]] : "neutral";

  const style: CSSProperties = isKnown
    ? {
        backgroundColor: tokenVar(
          ["colors", "severity", severity],
          tokenVar(["colors", "semantic", SEVERITY_TONE_FALLBACK[severity as (typeof SEVERITY_KEYS)[number]]])
        ),
      }
    : {};

  return (
    <Badge tone={tone} className={cn("forge-severity-badge", className)} style={style}>
      {label ?? severity}
    </Badge>
  );
}
