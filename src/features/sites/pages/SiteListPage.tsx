import { useQuery } from '@tanstack/react-query'
import { FileDown, Plus } from 'lucide-react'
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
import { formatEuro } from '@/lib/money'
import {
  SITE_SORTS,
  SITE_STATUSES,
  siteExportUrl,
  siteListQuery,
  type Site,
  type SiteStatus,
} from '../api'
import { SiteCard } from '../components/SiteCard'
import { SiteLink } from '../components/SiteLink'
import { SiteStatusBadge } from '../components/SiteStatusBadge'
import { sitePaths } from '../paths'

const STATUS = 'stato'
const column = listColumnHelper<Site>()
// Sortable columns have the id of a sort value of the API
const columns = column.columns([
  column.accessor('code', {
    header: () => <FormattedMessage id="sites.code" />,
  }),
  column.accessor('name', {
    header: () => <FormattedMessage id="sites.name" />,
    cell: ({ row }) => <SiteLink site={row.original} />,
  }),
  column.display({
    id: 'client',
    header: () => <FormattedMessage id="sites.client" />,
    cell: ({ row }) => row.original.client?.name,
  }),
  column.accessor('status', {
    header: () => <FormattedMessage id="sites.status" />,
    cell: (info) => <SiteStatusBadge status={info.getValue()} />,
    enableSorting: false,
  }),
  column.accessor('start_on', {
    header: () => <FormattedMessage id="sites.startOn" />,
    cell: (info) => {
      const day = info.getValue()
      return day && <ItalianDate value={day} />
    },
  }),
  column.accessor('end_on', {
    header: () => <FormattedMessage id="sites.endOn" />,
    cell: (info) => {
      const day = info.getValue()
      return day && <ItalianDate value={day} />
    },
    enableSorting: false,
  }),
  column.display({
    id: 'budget',
    header: () => (
      <span className="block text-right">
        <FormattedMessage id="sites.budget" />
      </span>
    ),
    cell: ({ row }) =>
      row.original.budget && (
        <span className="block text-right whitespace-nowrap tabular-nums">
          {formatEuro(row.original.budget)}
        </span>
      ),
  }),
  column.accessor('updated_at', {
    header: () => <FormattedMessage id="sites.updatedAt" />,
    cell: (info) => <ItalianDate value={info.getValue()} />,
    sortDescFirst: true,
  }),
])

export function SiteListPage() {
  const intl = useIntl()
  const company = useCompany()
  const list = useListParams({ sorts: SITE_SORTS, filters: { [STATUS]: SITE_STATUSES } })
  const status = list.filters[STATUS] as SiteStatus | undefined
  const query = useQuery(
    siteListQuery(company.slug, {
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
        title={<FormattedMessage id="sites.title" />}
        actions={
          <>
            <Button asChild variant="outline">
              <a
                href={siteExportUrl(company.slug, { sort: list.sort, search: list.search, status })}
                download
              >
                <FileDown aria-hidden="true" />
                <FormattedMessage id="sites.export" />
              </a>
            </Button>
            <PermissionGate permission="sites.create">
              <Button asChild>
                <Link to={sitePaths(company.slug).new}>
                  <Plus aria-hidden="true" />
                  <FormattedMessage id="sites.new" />
                </Link>
              </Button>
            </PermissionGate>
          </>
        }
      />
      <DataTable
        columns={columns}
        query={query}
        filters={
          <FilterBar>
            <SearchFilter label="sites.search" value={list.search} onChange={list.setSearch} />
            <NativeSelect
              aria-label={intl.formatMessage({ id: 'sites.status' })}
              value={status ?? ''}
              onChange={(event) => list.setFilter(STATUS, event.target.value || undefined)}
            >
              <NativeSelectOption value="">
                {intl.formatMessage({ id: 'list.all' })}
              </NativeSelectOption>
              {SITE_STATUSES.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {intl.formatMessage({ id: `sites.status.${value}` })}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FilterBar>
        }
        sort={list.sort}
        onSortChange={list.setSort}
        onPageChange={list.setPage}
        onPerPageChange={list.setPerPage}
        getRowId={(site) => site.id}
        renderCard={(site) => <SiteCard site={site} />}
        empty={filtered ? 'list.noResults' : 'sites.empty'}
      />
    </div>
  )
}
