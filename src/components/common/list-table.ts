import {
  createColumnHelper,
  rowSortingFeature,
  tableFeatures,
  type ColumnDef,
  type RowData,
} from '@tanstack/react-table'

/** The table features a server-side list uses: only sorting, done by the backend. */
export const listFeatures = tableFeatures({ rowSortingFeature })

export type ListColumn<TData extends RowData> = ColumnDef<typeof listFeatures, TData>

/** Columns for DataTable. A column can be sorted only if its id is a sort value of the API. */
export function listColumnHelper<TData extends RowData>() {
  return createColumnHelper<typeof listFeatures, TData>()
}
