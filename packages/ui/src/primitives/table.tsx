/**
 * @forge/ui — Table primitive (V3 §10.3). Rows/headers styled through theme
 * tokens; striped variant uses a static, class-scoped style block (no user
 * input inside), keeping output deterministic and safe.
 */

import type { CSSProperties, ReactNode, TableHTMLAttributes } from "react";
import { tokenVar } from "../theme/apply.js";
import { cn } from "../classnames.js";

export type TableVariant = "default" | "striped" | "minimal" | "bordered";

export interface TableColumn<TRow extends Record<string, unknown>> {
  readonly key: string;
  readonly header: string;
  readonly align?: "left" | "center" | "right";
  readonly render?: (row: TRow) => ReactNode;
}

export interface TableProps<TRow extends Record<string, unknown>>
  extends Omit<TableHTMLAttributes<HTMLTableElement>, "children"> {
  readonly columns: readonly TableColumn<TRow>[];
  readonly rows: readonly TRow[];
  readonly variant?: TableVariant;
  readonly caption?: string;
}

const STRIPED_CSS =
  ".forge-table--striped tbody tr:nth-child(even){background-color:var(--forge-colors-surface-muted);}";

function cellStyle(align?: "left" | "center" | "right"): CSSProperties {
  return {
    textAlign: align ?? "left",
    padding: "calc(var(--forge-density-row-y) * 1) calc(var(--forge-density-row-x) * 1)",
  };
}

export function Table<TRow extends Record<string, unknown>>({
  columns,
  rows,
  variant = "default",
  caption,
  className,
  style,
  ...rest
}: TableProps<TRow>) {
  const tableStyle: CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    color: tokenVar(["colors", "surface", "foreground"]),
    fontFamily: "var(--forge-typography-font-family-sans)",
    fontSize: "var(--forge-typography-font-size)",
    border: variant === "bordered" ? "var(--forge-borders-width) var(--forge-borders-style) var(--forge-colors-surface-border)" : undefined,
    ...style,
  };

  const headerRowStyle: CSSProperties = {
    borderBottom: "var(--forge-borders-width) var(--forge-borders-style) var(--forge-colors-surface-border)",
    backgroundColor: tokenVar(["colors", "surface", "muted"]),
    color: tokenVar(["colors", "surface", "mutedForeground"]),
  };

  const rowStyle: CSSProperties =
    variant === "minimal"
      ? {}
      : { borderBottom: "var(--forge-borders-width) var(--forge-borders-style) var(--forge-colors-surface-border)" };

  return (
    <>
      {variant === "striped" && <style>{STRIPED_CSS}</style>}
      <table className={cn("forge-table", `forge-table--${variant}`, className)} style={tableStyle} {...rest}>
        {caption !== undefined && (
          <caption style={{ textAlign: "left", color: tokenVar(["colors", "surface", "mutedForeground"]), paddingBottom: "calc(var(--forge-spacing-unit) * 2)" }}>
            {caption}
          </caption>
        )}
        <thead>
          <tr style={headerRowStyle}>
            {columns.map((column) => (
              <th key={column.key} scope="col" style={cellStyle(column.align)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} style={rowStyle}>
              {columns.map((column) => (
                <td key={column.key} style={cellStyle(column.align)}>
                  {column.render ? column.render(row) : String(row[column.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
