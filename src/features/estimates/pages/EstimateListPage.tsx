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
import {
  ESTIMATE_SORTS,
  ESTIMATE_STATUSES,
  estimateListQuery,
  type Estimate,
  type EstimateStatus,
} from '../api'
import { EstimateCard } from '../components/EstimateCard'
import { EstimateLink } from '../components/EstimateLink'
import { EstimateStatusBadge } from '../components/EstimateStatusBadge'
import { estimatePaths } from '../paths'

const STATUS = 'stato'
const column = listColumnHelper<Estimate>()
// Sortable columns have the id of a sort value of the API
const columns = column.columns([
  column.accessor('title', {
    header: () => <FormattedMessage id="estimates.titleField" />,
    cell: ({ row }) => <EstimateLink estimate={row.original} />,
  }),
  column.display({
    id: 'client',
    header: () => <FormattedMessage id="estimates.client" />,
    cell: ({ row }) => row.original.client?.name,
  }),
  column.display({
    id: 'site',
    header: () => <FormattedMessage id="estimates.site" />,
    cell: ({ row }) => row.original.site?.name ?? row.original.site_address,
  }),
  column.accessor('status', {
    header: () => <FormattedMessage id="estimates.status" />,
    cell: (info) => <EstimateStatusBadge status={info.getValue()} />,
    enableSorting: false,
  }),
  column.accessor('total', {
    header: () => (
      <span className="block text-right">
        <FormattedMessage id="estimates.total" />
      </span>
    ),
    cell: (info) => (
      <span className="block text-right whitespace-nowrap tabular-nums">
        {formatEuro(info.getValue())}
      </span>
    ),
    enableSorting: false,
  }),
  column.accessor('updated_at', {
    header: () => <FormattedMessage id="estimates.updatedAt" />,
    cell: (info) => <ItalianDate value={info.getValue()} />,
    sortDescFirst: true,
  }),
])

export function EstimateListPage() {
  const intl = useIntl()
  const company = useCompany()
  const list = useListParams({ sorts: ESTIMATE_SORTS, filters: { [STATUS]: ESTIMATE_STATUSES } })
  const status = list.filters[STATUS] as EstimateStatus | undefined
  const query = useQuery(
    estimateListQuery(company.slug, {
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
        title={<FormattedMessage id="estimates.title" />}
        actions={
          <PermissionGate permission="estimates.create">
            <Button asChild>
              <Link to={estimatePaths(company.slug).new}>
                <Plus aria-hidden="true" />
                <FormattedMessage id="estimates.new" />
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
            <SearchFilter label="estimates.search" value={list.search} onChange={list.setSearch} />
            <NativeSelect
              aria-label={intl.formatMessage({ id: 'estimates.status' })}
              value={status ?? ''}
              onChange={(event) => list.setFilter(STATUS, event.target.value || undefined)}
            >
              <NativeSelectOption value="">
                {intl.formatMessage({ id: 'list.all' })}
              </NativeSelectOption>
              {ESTIMATE_STATUSES.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {intl.formatMessage({ id: `estimates.status.${value}` })}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FilterBar>
        }
        sort={list.sort}
        onSortChange={list.setSort}
        onPageChange={list.setPage}
        onPerPageChange={list.setPerPage}
        getRowId={(estimate) => estimate.id}
        renderCard={(estimate) => <EstimateCard estimate={estimate} />}
        empty={filtered ? 'list.noResults' : 'estimates.empty'}
      />
    </div>
  )
}
