import { useQuery } from '@tanstack/react-query'
import { Plus, Smartphone } from 'lucide-react'
import { FormattedMessage, useIntl } from 'react-intl'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import { DataTable } from '@/components/common/DataTable'
import { FilterBar } from '@/components/common/FilterBar'
import { listColumnHelper } from '@/components/common/list-table'
import { PageHeader } from '@/components/common/PageHeader'
import { PermissionGate } from '@/components/common/PermissionGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useListParams } from '@/hooks/use-list-params'
import type { MessageId } from '@/i18n/it'
import { isDay } from '@/lib/days'
import {
  REPORT_SORTS,
  REPORT_STATUSES,
  reportListQuery,
  siteLabel,
  useSiteOptions,
  type DailyReportStatus,
  type DailyReportSummary,
} from '../api'
import { ReportCard } from '../components/ReportCard'
import { ReportLink, SiteLink } from '../components/ReportLinks'
import { ReportStatusBadge } from '../components/ReportStatusBadge'
import { formatHours } from '../hours'
import { FILTER, reportPaths } from '../paths'

const right = 'block text-right tabular-nums'
const column = listColumnHelper<DailyReportSummary>()
// Sortable columns have the id of a sort value of the API
const columns = column.columns([
  column.accessor('date', {
    header: () => <FormattedMessage id="dailyReports.date" />,
    cell: ({ row }) => <ReportLink report={row.original} />,
    sortDescFirst: true,
  }),
  column.display({
    id: 'site',
    header: () => <FormattedMessage id="dailyReports.site" />,
    cell: ({ row }) => <SiteLink site={row.original.site} />,
  }),
  column.accessor('work_done', {
    header: () => <FormattedMessage id="dailyReports.workDone" />,
    cell: (info) => <span className="line-clamp-2 break-words">{info.getValue()}</span>,
    enableSorting: false,
  }),
  column.accessor('total_labor_hours', {
    header: () => (
      <span className={right}>
        <FormattedMessage id="dailyReports.laborHours" />
      </span>
    ),
    cell: (info) => <span className={right}>{formatHours(info.getValue())}</span>,
    enableSorting: false,
  }),
  column.accessor('total_vehicle_hours', {
    header: () => (
      <span className={right}>
        <FormattedMessage id="dailyReports.vehicleHours" />
      </span>
    ),
    cell: (info) => <span className={right}>{formatHours(info.getValue())}</span>,
    enableSorting: false,
  }),
  column.accessor('status', {
    header: () => <FormattedMessage id="dailyReports.status" />,
    cell: (info) => <ReportStatusBadge status={info.getValue()} />,
    enableSorting: false,
  }),
])

// Site ids come from the backend: any short text is passed on, the backend checks it
const isId = (value: string) => value.length > 0 && value.length <= 100

const FILTERS = {
  [FILTER.site]: isId,
  [FILTER.from]: isDay,
  [FILTER.to]: isDay,
  [FILTER.status]: REPORT_STATUSES,
}

export function ReportListPage() {
  const intl = useIntl()
  const company = useCompany()
  const paths = reportPaths(company.slug)
  const list = useListParams({ sorts: REPORT_SORTS, filters: FILTERS })
  const { filters } = list
  const site = filters[FILTER.site]
  const from = filters[FILTER.from]
  const to = filters[FILTER.to]
  // The backend refuses a range that ends before it starts: the end is left out until fixed
  const badRange = from !== undefined && to !== undefined && to < from
  const query = useQuery(
    reportListQuery(company.slug, {
      page: list.page,
      perPage: list.perPage,
      sort: list.sort,
      site,
      status: filters[FILTER.status] as DailyReportStatus | undefined,
      from,
      to: badRange ? undefined : to,
    }),
  )
  const sites = useSiteOptions().data
  const knownSite = sites?.some((s) => s.id === site)
  const filtered = Object.values(filters).some(Boolean) || list.page > 1
  const t = (id: MessageId) => intl.formatMessage({ id })

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={<FormattedMessage id="dailyReports.title" />}
        actions={
          <PermissionGate permission="reports.create">
            <Button asChild variant="outline">
              <Link to={paths.today(site)}>
                <Smartphone aria-hidden="true" />
                <FormattedMessage id="dailyReports.today" />
              </Link>
            </Button>
            <Button asChild>
              <Link to={paths.new(site)}>
                <Plus aria-hidden="true" />
                <FormattedMessage id="dailyReports.new" />
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
            <NativeSelect
              className="w-full sm:w-auto sm:max-w-72"
              aria-label={t('dailyReports.site')}
              value={site ?? ''}
              onChange={(event) => list.setFilter(FILTER.site, event.target.value || undefined)}
            >
              <NativeSelectOption value="">{t('dailyReports.filter.allSites')}</NativeSelectOption>
              {/* A site from a shared URL that is not among the options still shows */}
              {site && !knownSite && (
                <NativeSelectOption value={site}>
                  {t('dailyReports.filter.thisSite')}
                </NativeSelectOption>
              )}
              {sites?.map((option) => (
                <NativeSelectOption key={option.id} value={option.id}>
                  {siteLabel(option)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <span className="flex w-full items-center gap-2 text-2sm text-muted-foreground sm:w-auto">
              <Input
                type="date"
                className="min-w-0 flex-1 sm:w-40 sm:flex-none"
                aria-label={t('dailyReports.filter.from')}
                title={t('dailyReports.filter.from')}
                value={from ?? ''}
                max={to}
                onChange={(event) => list.setFilter(FILTER.from, event.target.value || undefined)}
              />
              –
              <Input
                type="date"
                className="min-w-0 flex-1 sm:w-40 sm:flex-none"
                aria-label={t('dailyReports.filter.to')}
                title={t('dailyReports.filter.to')}
                value={to ?? ''}
                min={from}
                aria-invalid={badRange || undefined}
                onChange={(event) => list.setFilter(FILTER.to, event.target.value || undefined)}
              />
            </span>
            <NativeSelect
              aria-label={t('dailyReports.status')}
              value={filters[FILTER.status] ?? ''}
              onChange={(event) => list.setFilter(FILTER.status, event.target.value || undefined)}
            >
              <NativeSelectOption value="">
                {t('dailyReports.filter.allStatuses')}
              </NativeSelectOption>
              {REPORT_STATUSES.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {t(`dailyReports.status.${value}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FilterBar>
        }
        sort={list.sort}
        onSortChange={list.setSort}
        onPageChange={list.setPage}
        onPerPageChange={list.setPerPage}
        getRowId={(report) => report.id}
        renderCard={(report) => <ReportCard report={report} />}
        empty={filtered ? 'list.noResults' : 'dailyReports.empty'}
      />
    </div>
  )
}
