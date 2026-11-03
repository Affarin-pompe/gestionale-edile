import type { UseQueryResult } from '@tanstack/react-query'
import { useTable, type RowData, type SortingState, type Updater } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { ApiError } from '@/api/errors'
import type { components } from '@/api/schema'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useIsMobile } from '@/hooks/use-mobile'
import type { MessageId } from '@/i18n/it'
import { listFeatures, type ListColumn } from './list-table'

type ListMeta = components['schemas']['ListMeta']

// Stable, so the table does not rebuild its rows at every render while loading
const NO_ROWS: never[] = []
const LOADING_ROWS = 5

/** "-name" ↔ [{ id: 'name', desc: true }] */
function toSorting(sort: string): SortingState {
  return [{ id: sort.replace(/^-/, ''), desc: sort.startsWith('-') }]
}

/**
 * A page of a list that the backend has already filtered, sorted and paged.
 * On a phone each row becomes a card (renderCard).
 */
export function DataTable<TData extends RowData>({
  columns,
  query,
  sort,
  onSortChange,
  onPageChange,
  getRowId,
  renderCard,
  empty,
}: {
  columns: ListColumn<TData>[]
  query: UseQueryResult<{ data: TData[]; meta: ListMeta }>
  sort: string
  onSortChange: (sort: string) => void
  onPageChange: (page: number) => void
  getRowId: (row: TData) => string
  renderCard: (row: TData) => ReactNode
  empty: MessageId
}) {
  const isMobile = useIsMobile()
  const sorting = toSorting(sort)
  const table = useTable({
    features: listFeatures,
    columns,
    data: query.data?.data ?? NO_ROWS,
    getRowId,
    state: { sorting },
    onSortingChange: (updater: Updater<SortingState>) => {
      const [next] = typeof updater === 'function' ? updater(sorting) : updater
      if (next) onSortChange(`${next.desc ? '-' : ''}${next.id}`)
    },
    manualSorting: true,
    enableSortingRemoval: false,
    enableMultiSort: false,
  })

  if (query.isError && !query.data) {
    const forbidden = query.error instanceof ApiError && query.error.status === 403
    return (
      <div role="alert" className="flex flex-col items-start gap-2 py-8">
        <p className="text-muted-foreground">
          <FormattedMessage id={forbidden ? 'error.forbidden.text' : 'list.loadFailed'} />
        </p>
        {!forbidden && (
          <Button variant="outline" onClick={() => void query.refetch()}>
            <FormattedMessage id="list.retry" />
          </Button>
        )}
      </div>
    )
  }

  const rows = table.getRowModel().rows
  // While another page or filter loads, the previous one stays visible, dimmed
  const busy = query.isPending || query.isPlaceholderData
  const meta = query.data?.meta

  return (
    <div aria-busy={busy} className="flex flex-col gap-3">
      {query.isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: LOADING_ROWS }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-muted-foreground">
          <FormattedMessage id={empty} />
        </p>
      ) : isMobile ? (
        <ul className={`flex flex-col gap-2 ${busy ? 'opacity-60' : ''}`}>
          {rows.map((row) => (
            <li key={row.id}>{renderCard(row.original)}</li>
          ))}
        </ul>
      ) : (
        <Table className={busy ? 'opacity-60' : undefined}>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  const direction = header.column.getIsSorted()
                  const label = <table.FlexRender header={header} />
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={
                        direction === 'asc'
                          ? 'ascending'
                          : direction === 'desc'
                            ? 'descending'
                            : undefined
                      }
                    >
                      {header.column.getCanSort() ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-2.5"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {label}
                          {direction === 'asc' ? (
                            <ArrowUp />
                          ) : direction === 'desc' ? (
                            <ArrowDown />
                          ) : (
                            <ArrowUpDown className="text-muted-foreground" />
                          )}
                        </Button>
                      ) : (
                        label
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {meta && meta.total > 0 && <Pagination meta={meta} onPageChange={onPageChange} />}
    </div>
  )
}

function Pagination({
  meta,
  onPageChange,
}: {
  meta: ListMeta
  onPageChange: (page: number) => void
}) {
  const intl = useIntl()
  const pages = Math.max(1, Math.ceil(meta.total / meta.per_page))
  return (
    <nav
      aria-label={intl.formatMessage({ id: 'list.pagination' })}
      className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"
    >
      <span>
        <FormattedMessage id="list.results" values={{ total: meta.total }} />
        {' · '}
        <FormattedMessage id="list.page" values={{ page: meta.page, pages }} />
      </span>
      <span className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(Math.min(meta.page - 1, pages))}
        >
          <FormattedMessage id="list.previous" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page >= pages}
          onClick={() => onPageChange(meta.page + 1)}
        >
          <FormattedMessage id="list.next" />
        </Button>
      </span>
    </nav>
  )
}
