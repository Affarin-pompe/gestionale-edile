import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { FormattedMessage, useIntl } from 'react-intl'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import { DataTable } from '@/components/common/DataTable'
import { FilterBar, SearchFilter } from '@/components/common/FilterBar'
import { ItalianDate } from '@/components/common/ItalianDate'
import { listColumnHelper } from '@/components/common/list-table'
import { PageHeader } from '@/components/common/PageHeader'
import { PermissionGate } from '@/components/common/PermissionGate'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useListParams } from '@/hooks/use-list-params'
import { formatEuro } from '@/lib/decimal'
import { QUOTE_SORTS, QUOTE_STATUSES, quoteListQuery, type Quote, type QuoteStatus } from '../api'
import { QuoteCard } from '../components/QuoteCard'
import { QuoteLink } from '../components/QuoteLink'
import { QuoteStatusBadge } from '../components/QuoteStatusBadge'
import { quotePaths } from '../paths'

const STATUS = 'stato'
const column = listColumnHelper<Quote>()
// Sortable columns have the id of a sort value of the API
const columns = column.columns([
  column.accessor('number', {
    header: () => <FormattedMessage id="quotes.number" />,
    cell: (info) => info.getValue() ?? <FormattedMessage id="quotes.status.draft" />,
  }),
  column.accessor('subject', {
    header: () => <FormattedMessage id="quotes.subject" />,
    cell: ({ row }) => <QuoteLink quote={row.original} />,
    enableSorting: false,
  }),
  column.display({
    id: 'client',
    header: () => <FormattedMessage id="quotes.client" />,
    cell: ({ row }) => row.original.client.name,
  }),
  column.accessor('status', {
    header: () => <FormattedMessage id="quotes.status" />,
    cell: (info) => <QuoteStatusBadge status={info.getValue()} />,
    enableSorting: false,
  }),
  column.accessor('issue_date', {
    header: () => <FormattedMessage id="quotes.issueDate" />,
    cell: (info) => {
      const date = info.getValue()
      return date && <ItalianDate value={date} />
    },
    sortDescFirst: true,
  }),
  column.display({
    id: 'total',
    header: () => (
      <span className="block text-right">
        <FormattedMessage id="quotes.total" />
      </span>
    ),
    cell: ({ row }) => (
      <span className="block text-right whitespace-nowrap tabular-nums">
        {formatEuro(row.original.totals.total)}
      </span>
    ),
  }),
  column.accessor('updated_at', {
    header: () => <FormattedMessage id="quotes.updatedAt" />,
    cell: (info) => <ItalianDate value={info.getValue()} />,
    sortDescFirst: true,
  }),
])

export function QuoteListPage() {
  const intl = useIntl()
  const company = useCompany()
  const list = useListParams({ sorts: QUOTE_SORTS, filters: { [STATUS]: QUOTE_STATUSES } })
  const status = list.filters[STATUS] as QuoteStatus | undefined
  const query = useQuery(
    quoteListQuery(company.slug, {
      page: list.page,
      perPage: list.perPage,
      sort: list.sort,
      search: list.search,
      status,
    }),
  )
  const filtered = list.search.trim() !== '' || status !== undefined || list.page > 1

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={<FormattedMessage id="quotes.title" />}
        actions={
          <PermissionGate permission="quotes.create">
            <Button asChild>
              <Link to={quotePaths(company.slug).new}>
                <Plus aria-hidden="true" />
                <FormattedMessage id="quotes.new" />
              </Link>
            </Button>
          </PermissionGate>
        }
      />
      <DataTable
        columns={columns}
        query={query}
        filters={
          <FilterBar>
            <SearchFilter label="quotes.search" value={list.search} onChange={list.setSearch} />
            <NativeSelect
              aria-label={intl.formatMessage({ id: 'quotes.status' })}
              value={status ?? ''}
              onChange={(event) => list.setFilter(STATUS, event.target.value || undefined)}
            >
              <NativeSelectOption value="">
                {intl.formatMessage({ id: 'list.all' })}
              </NativeSelectOption>
              {QUOTE_STATUSES.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {intl.formatMessage({ id: `quotes.status.${value}` })}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FilterBar>
        }
        sort={list.sort}
        onSortChange={list.setSort}
        onPageChange={list.setPage}
        onPerPageChange={list.setPerPage}
        getRowId={(quote) => quote.id}
        renderCard={(quote) => <QuoteCard quote={quote} />}
        empty={filtered ? 'list.noResults' : 'quotes.empty'}
      />
    </div>
  )
}
