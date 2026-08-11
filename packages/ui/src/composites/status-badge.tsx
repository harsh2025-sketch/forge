/**
 * @forge/ui — StatusBadge composite (V3 §10.3): a Badge labelled with a status
 * string, tone-selected by the caller (status vocabulary is product-owned).
 */

import type { BadgeTone } from "../primitives/badge.js";
import { Badge } from "../primitives/badge.js";

export interface StatusBadgeProps {
  readonly status: string;
  readonly tone?: BadgeTone;
  readonly className?: string;
}

export function StatusBadge({ status, tone = "neutral", className }: StatusBadgeProps) {
  return (
    <Badge tone={tone} className={className}>
      {status}
    </Badge>
  );
}
