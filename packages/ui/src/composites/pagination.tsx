/**
 * @forge/ui — Pagination composite (V3 §10.3): deterministic page window with
 * Previous/Next controls. Page numbers are stable for identical props.
 */

import type { CSSProperties } from "react";
import { tokenVar } from "../theme/apply.js";
import { cn } from "../classnames.js";

export interface PaginationProps {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly onPageChange?: (page: number) => void;
  readonly siblingCount?: number;
  readonly className?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function Pagination({ page, pageSize, total, onPageChange, siblingCount = 1, className }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const currentPage = clamp(Math.floor(page), 1, pageCount);

  const from = clamp(currentPage - siblingCount, 1, pageCount);
  const to = clamp(currentPage + siblingCount, 1, pageCount);
  const pages: number[] = [];
  for (let p = from; p <= to; p += 1) {
    pages.push(p);
  }

  const buttonStyle = (active = false): CSSProperties => ({
    backgroundColor: active ? tokenVar(["colors", "brand", "primary"]) : tokenVar(["colors", "surface", "background"]),
    color: active ? tokenVar(["colors", "brand", "primaryForeground"]) : tokenVar(["colors", "surface", "foreground"]),
    border: "var(--forge-borders-width) var(--forge-borders-style) var(--forge-colors-surface-border)",
    borderRadius: "var(--forge-borders-radius)",
    padding: "calc(var(--forge-spacing-unit) * 1) calc(var(--forge-spacing-unit) * 2)",
    fontFamily: "var(--forge-typography-font-family-sans)",
    fontSize: "var(--forge-typography-font-size)",
    cursor: "pointer",
    minWidth: "calc(var(--forge-spacing-unit) * 8)",
  });

  const navStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "calc(var(--forge-spacing-unit) * 1)",
  };

  return (
    <nav className={cn("forge-pagination", className)} aria-label="Pagination" style={navStyle}>
      <button
        type="button"
        className="forge-pagination-previous"
        aria-label="Previous page"
        disabled={currentPage <= 1}
        onClick={() => onPageChange?.(currentPage - 1)}
        style={buttonStyle()}
      >
        ‹
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={cn("forge-pagination-page", p === currentPage && "forge-pagination-page--active")}
          aria-label={`Page ${p}`}
          aria-current={p === currentPage ? "page" : undefined}
          onClick={() => onPageChange?.(p)}
          style={buttonStyle(p === currentPage)}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        className="forge-pagination-next"
        aria-label="Next page"
        disabled={currentPage >= pageCount}
        onClick={() => onPageChange?.(currentPage + 1)}
        style={buttonStyle()}
      >
        ›
      </button>
      <span className="forge-pagination-status" style={{ marginLeft: "calc(var(--forge-spacing-unit) * 2)", color: tokenVar(["colors", "surface", "mutedForeground"]) }}>
        Page {currentPage} of {pageCount}
      </span>
    </nav>
  );
}
