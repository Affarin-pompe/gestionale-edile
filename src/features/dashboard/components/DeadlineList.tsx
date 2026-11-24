import { TriangleAlert } from 'lucide-react'
import { FormattedDate, FormattedMessage } from 'react-intl'
import { calendarDay } from '@/lib/dates'
import { formatEuro } from '@/lib/money'
import type { DashboardDeadline } from '../api'
import { DashboardSection } from './DashboardSection'

/** Open deadlines, overdue or within a week, oldest first as the backend sends them. */
export function DeadlineList({ deadlines }: { deadlines: DashboardDeadline[] }) {
  return (
    <DashboardSection title={<FormattedMessage id="dashboard.deadlines" />}>
      {deadlines.length === 0 ? (
        <p className="text-muted-foreground">
          <FormattedMessage id="dashboard.deadlines.empty" />
        </p>
      ) : (
        <ul className="-my-3 divide-y">
          {deadlines.map((deadline) => (
            <DeadlineRow key={deadline.id} deadline={deadline} />
          ))}
        </ul>
      )}
    </DashboardSection>
  )
}

function DeadlineRow({ deadline }: { deadline: DashboardDeadline }) {
  const date = (
    <FormattedDate
      value={calendarDay(deadline.due_on)}
      day="2-digit"
      month="2-digit"
      year="numeric"
      timeZone="UTC"
    />
  )
  return (
    <li className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
      <div className="min-w-0">
        <p className="font-medium break-words">{deadline.title}</p>
        <p className="text-muted-foreground">
          <FormattedMessage id={`dashboard.deadlineKind.${deadline.kind}`} />
          {deadline.amount !== null && ` · ${formatEuro(deadline.amount)}`}
        </p>
      </div>
      {deadline.overdue ? (
        <p className="flex shrink-0 items-center gap-1.5 font-medium text-destructive">
          <TriangleAlert className="size-4" aria-hidden="true" />
          <FormattedMessage id="dashboard.deadlines.overdue" values={{ date }} />
        </p>
      ) : (
        <p className="shrink-0 text-muted-foreground">
          <FormattedMessage id="dashboard.deadlines.due" values={{ date }} />
        </p>
      )}
    </li>
  )
}
