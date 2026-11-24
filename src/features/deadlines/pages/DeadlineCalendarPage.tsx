import { useQuery } from '@tanstack/react-query'
import { cn } from 'cn'
import { ChevronLeft, ChevronRight, List, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { FormattedDate, FormattedMessage, useIntl } from 'react-intl'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import { FilterBar } from '@/components/common/FilterBar'
import { PageHeader } from '@/components/common/PageHeader'
import { PermissionGate } from '@/components/common/PermissionGate'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useListParams } from '@/hooks/use-list-params'
import { useIsMobile } from '@/hooks/use-mobile'
import { dayToDate, isMonth, monthOf, monthRange, monthWeeks, shiftMonth, today } from '@/lib/days'
import {
  DEADLINE_KINDS,
  DEADLINE_SORTS,
  DEADLINE_STATUSES,
  deadlineListQuery,
  isOverdue,
  MAX_PER_PAGE,
  type Deadline,
  type DeadlineKind,
  type DeadlineStatus,
} from '../api'
import { DeadlineFilters } from '../components/DeadlineFilters'
import { deadlinePaths, FILTER, isSubjectParam, subjectFromParam } from '../paths'

const FILTERS = {
  [FILTER.month]: isMonth,
  [FILTER.kind]: DEADLINE_KINDS,
  [FILTER.status]: DEADLINE_STATUSES,
  [FILTER.subject]: isSubjectParam,
}
// The deadlines a day of the grid shows; the others are one click away, in the list
const SHOWN_PER_DAY = 3

/** The deadlines of a month on a grid, Monday to Sunday; on a phone, day by day. */
export function DeadlineCalendarPage() {
  const intl = useIntl()
  const company = useCompany()
  const paths = deadlinePaths(company.slug)
  const isMobile = useIsMobile()
  const now = today()
  const list = useListParams({ sorts: DEADLINE_SORTS, filters: FILTERS })
  const { filters } = list
  const month = filters[FILTER.month] ?? monthOf(now)
  const weeks = monthWeeks(month)
  // The grid shows the days of the months around it too: they are asked as well
  const from = weeks[0]?.[0] ?? monthRange(month).from
  const to = weeks.at(-1)?.[6] ?? monthRange(month).to
  const query = useQuery(
    deadlineListQuery(company.slug, {
      page: 1,
      perPage: MAX_PER_PAGE,
      sort: 'due_on',
      search: '',
      from,
      to,
      kind: filters[FILTER.kind] as DeadlineKind | undefined,
      status: filters[FILTER.status] as DeadlineStatus | undefined,
      subject: subjectFromParam(filters[FILTER.subject]),
    }),
  )

  const byDay = new Map<string, Deadline[]>()
  for (const deadline of query.data?.data ?? []) {
    const day = byDay.get(deadline.due_on) ?? []
    day.push(deadline)
    byDay.set(deadline.due_on, day)
  }

  /** The list with the calendar's filters, for one day or for the whole month. */
  function listHrefFor(first: string, last: string) {
    const params = new URLSearchParams({ [FILTER.from]: first, [FILTER.to]: last })
    for (const name of [FILTER.kind, FILTER.status, FILTER.subject]) {
      const value = filters[name]
      if (value) params.set(name, value)
    }
    return `${paths.list}?${params}`
  }
  const range = monthRange(month)

  const monthTitle = (
    <FormattedDate value={dayToDate(`${month}-01`)} timeZone="UTC" month="long" year="numeric" />
  )

  let body: ReactNode
  if (query.isError && !query.data) {
    body = (
      <div role="alert" className="flex flex-col items-start gap-2.5 p-5">
        <p className="text-muted-foreground">
          <FormattedMessage id="list.loadFailed" />
        </p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          <FormattedMessage id="list.retry" />
        </Button>
      </div>
    )
  } else if (query.isPending) {
    body = (
      <div className="p-5">
        <Skeleton className="h-96 w-full" />
      </div>
    )
  } else if (isMobile) {
    // Day by day, only the days of the month that have deadlines
    const days = [...byDay.keys()].filter((day) => monthOf(day) === month)
    body =
      days.length === 0 ? (
        <p className="p-5 text-muted-foreground">
          <FormattedMessage id="deadlines.calendar.empty" />
        </p>
      ) : (
        <ul className="divide-y">
          {days.map((day) => (
            <li key={day} className="flex flex-col gap-1.5 px-5 py-3">
              <h3 className={cn('text-sm font-medium', day === now && 'text-primary')}>
                <FormattedDate
                  value={dayToDate(day)}
                  timeZone="UTC"
                  weekday="long"
                  day="numeric"
                  month="long"
                />
              </h3>
              <ul className="flex flex-col gap-1">
                {byDay.get(day)?.map((deadline) => (
                  <li key={deadline.id}>
                    <CalendarItem deadline={deadline} now={now} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )
  } else {
    const weekdays = weeks[0] ?? []
    body = (
      <table className={cn('w-full table-fixed', query.isPlaceholderData && 'opacity-60')}>
        <caption className="sr-only">{monthTitle}</caption>
        <thead>
          <tr>
            {weekdays.map((day) => (
              <th
                key={day}
                scope="col"
                className="border-b px-2 py-2 text-left text-2sm font-normal text-muted-foreground"
              >
                <FormattedDate value={dayToDate(day)} timeZone="UTC" weekday="short" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((day) => {
                const deadlines = byDay.get(day) ?? []
                const outside = monthOf(day) !== month
                return (
                  <td key={day} className="h-28 border-r border-b p-1.5 align-top last:border-r-0">
                    <div className="flex flex-col gap-1">
                      <span
                        className={cn(
                          'flex size-6 items-center justify-center rounded-full text-2sm',
                          outside && 'text-muted-foreground',
                          day === now && 'bg-primary font-medium text-primary-foreground',
                        )}
                      >
                        <FormattedDate value={dayToDate(day)} timeZone="UTC" day="numeric" />
                      </span>
                      {deadlines.slice(0, SHOWN_PER_DAY).map((deadline) => (
                        <CalendarItem key={deadline.id} deadline={deadline} now={now} compact />
                      ))}
                      {deadlines.length > SHOWN_PER_DAY && (
                        <Link
                          to={listHrefFor(day, day)}
                          className="px-1 text-2sm text-muted-foreground hover:text-foreground"
                        >
                          <FormattedMessage
                            id="deadlines.calendar.more"
                            values={{ count: deadlines.length - SHOWN_PER_DAY }}
                          />
                        </Link>
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back={{ to: paths.list, label: <FormattedMessage id="deadlines.title" /> }}
        title={<FormattedMessage id="deadlines.calendar" />}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={listHrefFor(range.from, range.to)}>
                <List aria-hidden="true" />
                <FormattedMessage id="deadlines.calendar.asList" />
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
      <Card aria-busy={query.isPending || query.isPlaceholderData}>
        <CardHeader className="flex flex-wrap justify-between">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={intl.formatMessage({ id: 'deadlines.calendar.previous' })}
              onClick={() => list.setFilter(FILTER.month, shiftMonth(month, -1))}
            >
              <ChevronLeft />
            </Button>
            <h2 className="min-w-36 text-center font-heading text-base font-semibold first-letter:uppercase">
              {monthTitle}
            </h2>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={intl.formatMessage({ id: 'deadlines.calendar.next' })}
              onClick={() => list.setFilter(FILTER.month, shiftMonth(month, 1))}
            >
              <ChevronRight />
            </Button>
            {month !== monthOf(now) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => list.setFilter(FILTER.month, undefined)}
              >
                <FormattedMessage id="deadlines.calendar.today" />
              </Button>
            )}
          </div>
          <FilterBar>
            <DeadlineFilters
              kind={filters[FILTER.kind]}
              status={filters[FILTER.status]}
              subject={filters[FILTER.subject]}
              onChange={(name, value) => list.setFilter(FILTER[name], value)}
            />
          </FilterBar>
        </CardHeader>
        {query.data && query.data.meta.total > MAX_PER_PAGE && (
          <p role="status" className="border-b px-5 py-3 text-sm text-muted-foreground">
            <FormattedMessage
              id="deadlines.calendar.tooMany"
              values={{ shown: MAX_PER_PAGE, total: query.data.meta.total }}
            />
          </p>
        )}
        {body}
      </Card>
    </div>
  )
}

/** A deadline in a day of the calendar: red when overdue, struck through when done. */
function CalendarItem({
  deadline,
  now,
  compact = false,
}: {
  deadline: Deadline
  now: string
  compact?: boolean
}) {
  const company = useCompany()
  const done = deadline.status === 'done'
  const overdue = isOverdue(deadline, now)
  return (
    <Link
      to={deadlinePaths(company.slug).detail(deadline.id)}
      title={deadline.title}
      className={cn(
        'block rounded-sm px-1 underline-offset-4 hover:underline',
        compact ? 'truncate text-2sm' : 'text-sm',
        overdue && 'font-medium text-destructive',
        done && 'text-muted-foreground line-through',
      )}
    >
      {deadline.title}
      {overdue && (
        <span className="sr-only">
          {' '}
          <FormattedMessage id="deadlines.overdue" />
        </span>
      )}
      {done && (
        <span className="sr-only">
          {' '}
          <FormattedMessage id="deadlines.status.done" />
        </span>
      )}
    </Link>
  )
}
