import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Plus } from 'lucide-react'
import { FormattedMessage, useIntl } from 'react-intl'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import { DataTable } from '@/components/common/DataTable'
import { FilterBar, SearchFilter } from '@/components/common/FilterBar'
import { Money } from '@/components/common/Formats'
import { listColumnHelper } from '@/components/common/list-table'
import { PageHeader } from '@/components/common/PageHeader'
import { PermissionGate } from '@/components/common/PermissionGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useListParams } from '@/hooks/use-list-params'
import { isDay, monthOf } from '@/lib/days'
import {
  DEADLINE_KINDS,
  DEADLINE_SORTS,
  DEADLINE_STATUSES,
  deadlineListQuery,
  type Deadline,
  type DeadlineKind,
  type DeadlineStatus,
} from '../api'
import { DeadlineCard } from '../components/DeadlineCard'
import { DeadlineFilters } from '../components/DeadlineFilters'
import { DeadlineLink } from '../components/DeadlineLink'
import { DeadlineStatusBadge } from '../components/DeadlineStatusBadge'
import { DoneButton } from '../components/DoneButton'
import { DueDate } from '../components/DueDate'
import { deadlinePaths, FILTER, isSubjectParam, subjectFromParam } from '../paths'

const column = listColumnHelper<Deadline>()
// Sortable columns have the id of a sort value of the API
const columns = column.columns([
  column.accessor('due_on', {
    header: () => <FormattedMessage id="deadlines.dueOn" />,
    cell: ({ row }) => <DueDate deadline={row.original} />,
  }),
  column.accessor('title', {
    header: () => <FormattedMessage id="deadlines.titleField" />,
    cell: ({ row }) => <DeadlineLink deadline={row.original} />,
    enableSorting: false,
  }),
  column.accessor('kind', {
    header: () => <FormattedMessage id="deadlines.kind" />,
    cell: (info) => <FormattedMessage id={`deadlines.kind.${info.getValue()}`} />,
    enableSorting: false,
  }),
  column.display({
    id: 'subject',
    header: () => <FormattedMessage id="deadlines.subject" />,
    cell: ({ row }) => row.original.client?.name ?? row.original.supplier?.name,
  }),
  column.accessor('amount', {
    header: () => <FormattedMessage id="deadlines.amount" />,
    cell: (info) => {
      const value = info.getValue()
      return value && <Money value={value} />
    },
    enableSorting: false,
  }),
  column.accessor('status', {
    header: () => <FormattedMessage id="deadlines.status" />,
    cell: ({ row }) => <DeadlineStatusBadge deadline={row.original} />,
    enableSorting: false,
  }),
  column.display({
    id: 'actions',
    header: () => (
      <span className="sr-only">
        <FormattedMessage id="deadlines.actions" />
      </span>
    ),
    cell: ({ row }) => <DoneButton deadline={row.original} compact />,
  }),
])

const FILTERS = {
  [FILTER.from]: isDay,
  [FILTER.to]: isDay,
  [FILTER.kind]: DEADLINE_KINDS,
  [FILTER.status]: DEADLINE_STATUSES,
  [FILTER.subject]: isSubjectParam,
}

export function DeadlineListPage() {
  const intl = useIntl()
  const company = useCompany()
  const paths = deadlinePaths(company.slug)
  const list = useListParams({ sorts: DEADLINE_SORTS, filters: FILTERS })
  const { filters } = list
  const from = filters[FILTER.from]
  const to = filters[FILTER.to]
  // The backend refuses a range that ends before it starts: the end is left out until fixed
  const badRange = from !== undefined && to !== undefined && to < from
  const query = useQuery(
    deadlineListQuery(company.slug, {
      page: list.page,
      perPage: list.perPage,
      sort: list.sort,
      search: list.search,
      from,
      to: badRange ? undefined : to,
      kind: filters[FILTER.kind] as DeadlineKind | undefined,
      status: filters[FILTER.status] as DeadlineStatus | undefined,
      subject: subjectFromParam(filters[FILTER.subject]),
    }),
  )
  const filtered =
    list.search.trim() !== '' || Object.values(filters).some(Boolean) || list.page > 1

  // The calendar opens on the month the list starts from, with the same filters
  const calendar = new URLSearchParams()
  if (from) calendar.set(FILTER.month, monthOf(from))
  for (const name of [FILTER.kind, FILTER.status, FILTER.subject]) {
    const value = filters[name]
    if (value) calendar.set(name, value)
  }
  const calendarHref = `${paths.calendar}${calendar.size > 0 ? `?${calendar}` : ''}`

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={<FormattedMessage id="deadlines.title" />}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={calendarHref}>
                <CalendarDays aria-hidden="true" />
                <FormattedMessage id="deadlines.calendar" />
              </Link>
            </Button>
            <PermissionGate permission="deadlines.create">
              <Button asChild>
                <Link to={paths.new}>
                  <Plus aria-hidden="true" />
                  <FormattedMessage id="deadlines.new" />
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
            <SearchFilter label="deadlines.search" value={list.search} onChange={list.setSearch} />
            <span className="flex items-center gap-2 text-2sm text-muted-foreground">
              <Input
                type="date"
                className="w-40"
                aria-label={intl.formatMessage({ id: 'deadlines.filter.from' })}
                title={intl.formatMessage({ id: 'deadlines.filter.from' })}
                value={from ?? ''}
                max={to}
                onChange={(event) => list.setFilter(FILTER.from, event.target.value || undefined)}
              />
              –
              <Input
                type="date"
                className="w-40"
                aria-label={intl.formatMessage({ id: 'deadlines.filter.to' })}
                title={intl.formatMessage({ id: 'deadlines.filter.to' })}
                value={to ?? ''}
                min={from}
                aria-invalid={badRange || undefined}
                onChange={(event) => list.setFilter(FILTER.to, event.target.value || undefined)}
              />
            </span>
            <DeadlineFilters
              kind={filters[FILTER.kind]}
              status={filters[FILTER.status]}
              subject={filters[FILTER.subject]}
              onChange={(name, value) => list.setFilter(FILTER[name], value)}
            />
          </FilterBar>
        }
        sort={list.sort}
        onSortChange={list.setSort}
        onPageChange={list.setPage}
        onPerPageChange={list.setPerPage}
        getRowId={(deadline) => deadline.id}
        renderCard={(deadline) => <DeadlineCard deadline={deadline} />}
        empty={filtered ? 'list.noResults' : 'deadlines.empty'}
      />
    </div>
  )
}
