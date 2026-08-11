/**
 * @forge/ui — DataTable composite (V3 §10.3): composes the Table primitive and
 * the EmptyState composite. No duplicated primitive logic.
 */

import { Table } from "../primitives/table.js";
import type { TableColumn, TableVariant } from "../primitives/table.js";
import { EmptyState } from "./empty-state.js";

export interface DataTableProps<TRow extends Record<string, unknown>> {
  readonly columns: readonly TableColumn<TRow>[];
  readonly rows: readonly TRow[];
  readonly variant?: TableVariant;
  readonly caption?: string;
  readonly emptyMessage?: string;
  readonly emptyDescription?: string;
}

export function DataTable<TRow extends Record<string, unknown>>({
  columns,
  rows,
  variant,
  caption,
  emptyMessage,
  emptyDescription,
}: DataTableProps<TRow>) {
  if (rows.length === 0) {
    return <EmptyState title={emptyMessage ?? "No data"} description={emptyDescription} />;
  }
  return <Table columns={columns} rows={rows} variant={variant} caption={caption} />;
}
