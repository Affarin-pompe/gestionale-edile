import type { UseQueryResult } from '@tanstack/react-query'
import { useTable, type RowData, type SortingState, type Updater } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { FormattedMessage, FormattedNumber, useIntl } from 'react-intl'
import { ApiError } from '@/api/errors'
import type { components } from '@/api/schema'
import { Button } from '@/components/ui/button'
import { Card, CardFooter, CardHeader } from '@/components/ui/card'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PER_PAGE_OPTIONS } from '@/hooks/use-list-params'
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
 * A page of a list that the backend has already filtered, sorted and paged, in a card:
 * the count and the filters above, the pages below. On a phone each row becomes a card
 * (renderCard).
 */
export function DataTable<TData extends RowData>({
  columns,
  query,
  filters,
  sort,
  onSortChange,
  onPageChange,
  onPerPageChange,
  getRowId,
  renderCard,
  empty,
}: {
  columns: ListColumn<TData>[]
  query: UseQueryResult<{ data: TData[]; meta: ListMeta }>
  /** Search box and filters, in the card's header. */
  filters?: ReactNode
  sort: string
  onSortChange: (sort: string) => void
  onPageChange: (page: number) => void
  onPerPageChange: (perPage: number) => void
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

  const rows = table.getRowModel().rows
  // While another page or filter loads, the previous one stays visible, dimmed
  const busy = query.isPending || query.isPlaceholderData
  const meta = query.data?.meta

  let body: ReactNode
  if (query.isError && !query.data) {
    const forbidden = query.error instanceof ApiError && query.error.status === 403
    body = (
      <div role="alert" className="flex flex-col items-start gap-2.5 p-5">
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
  } else if (query.isPending) {
    body = (
      <div className="flex flex-col gap-2 p-5">
        {Array.from({ length: LOADING_ROWS }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  } else if (rows.length === 0) {
    body = (
      <p className="p-5 text-muted-foreground">
        <FormattedMessage id={empty} />
      </p>
    )
  } else if (isMobile) {
    body = (
      <ul className={`divide-y ${busy ? 'opacity-60' : ''}`}>
        {rows.map((row) => (
          <li key={row.id}>{renderCard(row.original)}</li>
        ))}
      </ul>
    )
  } else {
    body = (
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
                        className="-ml-2.5 font-normal text-muted-foreground"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {label}
                        {direction === 'asc' ? (
                          <ArrowUp />
                        ) : direction === 'desc' ? (
                          <ArrowDown />
                        ) : (
                          <ArrowUpDown />
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
    )
  }

  return (
    <Card aria-busy={busy}>
      <CardHeader className="flex flex-wrap justify-between">
        <p className="text-sm font-medium">
          {meta && <FormattedMessage id="list.results" values={{ total: meta.total }} />}
        </p>
        {filters}
      </CardHeader>
      {body}
      {meta && meta.total > 0 && (
        <CardFooter>
          <PerPage value={meta.per_page} onChange={onPerPageChange} />
          <Pagination meta={meta} shown={rows.length} onPageChange={onPageChange} />
        </CardFooter>
      )}
    </Card>
  )
}

function PerPage({ value, onChange }: { value: number; onChange: (perPage: number) => void }) {
  const id = useId()
  return (
    <div className="flex items-center gap-2 text-2sm text-muted-foreground">
      <label htmlFor={id}>
        <FormattedMessage id="list.perPage" />
      </label>
      <NativeSelect
        id={id}
        className="w-18"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {PER_PAGE_OPTIONS.map((n) => (
          <NativeSelectOption key={n} value={n}>
            {n}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}

/** The pages to show: the first, the last and those next to the current; null is a gap. */
function pageNumbers(page: number, pages: number): (number | null)[] {
  const shown = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b)
  const result: (number | null)[] = []
  for (const n of shown) {
    const previous = result.at(-1)
    // A gap of one page shows that page, not the dots
    if (typeof previous === 'number' && n - previous === 2) result.push(previous + 1)
    else if (typeof previous === 'number' && n - previous > 2) result.push(null)
    result.push(n)
  }
  return result
}

function Pagination({
  meta,
  shown,
  onPageChange,
}: {
  meta: ListMeta
  /** Rows on this page: none when the URL asks for a page past the last one. */
  shown: number
  onPageChange: (page: number) => void
}) {
  const intl = useIntl()
  const pages = Math.max(1, Math.ceil(meta.total / meta.per_page))
  const from = (meta.page - 1) * meta.per_page + 1
  return (
    <nav
      aria-label={intl.formatMessage({ id: 'list.pagination' })}
      className="flex flex-wrap items-center gap-2.5 text-2sm text-muted-foreground"
    >
      {shown > 0 && (
        <span>
          <FormattedMessage
            id="list.range"
            values={{
              from: <FormattedNumber value={from} />,
              to: <FormattedNumber value={from + shown - 1} />,
              total: <FormattedNumber value={meta.total} />,
            }}
          />
        </span>
      )}
      <span className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={intl.formatMessage({ id: 'list.previous' })}
          disabled={meta.page <= 1}
          onClick={() => onPageChange(Math.min(meta.page - 1, pages))}
        >
          <ChevronLeft />
        </Button>
        {pageNumbers(meta.page, pages).map((n, index) =>
          n === null ? (
            <span key={`gap-${index}`} aria-hidden="true" className="px-1">
              …
            </span>
          ) : (
            <Button
              key={n}
              variant={n === meta.page ? 'outline' : 'ghost'}
              size="icon-sm"
              aria-label={intl.formatMessage({ id: 'list.goToPage' }, { page: n })}
              aria-current={n === meta.page ? 'page' : undefined}
              onClick={() => onPageChange(n)}
            >
              {n}
            </Button>
          ),
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={intl.formatMessage({ id: 'list.next' })}
          disabled={meta.page >= pages}
          onClick={() => onPageChange(meta.page + 1)}
        >
          <ChevronRight />
        </Button>
      </span>
    </nav>
  )
}
