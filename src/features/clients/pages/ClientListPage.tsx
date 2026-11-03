import { useQuery } from '@tanstack/react-query'
import { FormattedDate, FormattedMessage, useIntl } from 'react-intl'
import { useCompany } from '@/auth/me'
import { DataTable } from '@/components/common/DataTable'
import { FilterBar, SearchFilter } from '@/components/common/FilterBar'
import { listColumnHelper } from '@/components/common/list-table'
import { PageHeader } from '@/components/common/PageHeader'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useListParams } from '@/hooks/use-list-params'
import { CLIENT_KINDS, CLIENT_SORTS, clientListQuery, type Client, type ClientKind } from '../api'
import { ClientCard } from '../components/ClientCard'

const KIND = 'tipo'
const column = listColumnHelper<Client>()
// Sortable columns have the id of a sort value of the API
const columns = column.columns([
  column.accessor('name', { header: () => <FormattedMessage id="clients.name" /> }),
  column.accessor('kind', {
    header: () => <FormattedMessage id="clients.kind" />,
    cell: (info) => <FormattedMessage id={`clients.kind.${info.getValue()}`} />,
    enableSorting: false,
  }),
  column.display({
    id: 'taxId',
    header: () => <FormattedMessage id="clients.taxId" />,
    cell: ({ row }) => row.original.vat_number ?? row.original.tax_code,
  }),
  column.accessor('city', {
    header: () => <FormattedMessage id="clients.city" />,
    enableSorting: false,
  }),
  column.accessor('created_at', {
    header: () => <FormattedMessage id="clients.createdAt" />,
    cell: (info) => (
      <FormattedDate value={info.getValue()} day="2-digit" month="2-digit" year="numeric" />
    ),
    // Newest first, the first time it is sorted
    sortDescFirst: true,
  }),
])

export function ClientListPage() {
  const intl = useIntl()
  const company = useCompany()
  const list = useListParams({ sorts: CLIENT_SORTS, filters: { [KIND]: CLIENT_KINDS } })
  const kind = list.filters[KIND] as ClientKind | undefined
  const query = useQuery(
    clientListQuery(company.slug, {
      page: list.page,
      sort: list.sort,
      search: list.search,
      kind,
    }),
  )
  const filtered = list.search.trim() !== '' || kind !== undefined || list.page > 1

  return (
    <div className="flex flex-col gap-4 p-4">
      <PageHeader title="clients.title" />
      <FilterBar>
        <SearchFilter label="clients.search" value={list.search} onChange={list.setSearch} />
        <NativeSelect
          aria-label={intl.formatMessage({ id: 'clients.kind' })}
          value={kind ?? ''}
          onChange={(event) => list.setFilter(KIND, event.target.value || undefined)}
        >
          <NativeSelectOption value="">{intl.formatMessage({ id: 'list.all' })}</NativeSelectOption>
          {CLIENT_KINDS.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {intl.formatMessage({ id: `clients.kind.${value}` })}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </FilterBar>
      <DataTable
        columns={columns}
        query={query}
        sort={list.sort}
        onSortChange={list.setSort}
        onPageChange={list.setPage}
        getRowId={(client) => client.id}
        renderCard={(client) => <ClientCard client={client} />}
        empty={filtered ? 'list.noResults' : 'clients.empty'}
      />
    </div>
  )
}
