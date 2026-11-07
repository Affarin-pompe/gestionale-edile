import { useIntl } from 'react-intl'
import type { Deadline } from '../api'
import { DeadlineLink } from './DeadlineLink'
import { DeadlineStatusBadge } from './DeadlineStatusBadge'
import { DoneButton } from './DoneButton'
import { DueDate } from './DueDate'
import { Money } from '@/components/common/Formats'

/** A deadline in the list on a phone, where a table does not fit. */
export function DeadlineCard({ deadline }: { deadline: Deadline }) {
  const intl = useIntl()
  const subject = deadline.client?.name ?? deadline.supplier?.name
  return (
    <article className="flex flex-col gap-1.5 px-5 py-3">
      <h2 className="flex flex-wrap items-center gap-2.5">
        <DeadlineLink deadline={deadline} />
        <DeadlineStatusBadge deadline={deadline} />
      </h2>
      <p className="text-sm text-muted-foreground">
        <DueDate deadline={deadline} />
        {' · '}
        {intl.formatMessage({ id: `deadlines.kind.${deadline.kind}` })}
        {subject && ` · ${subject}`}
        {deadline.amount && (
          <>
            {' · '}
            <Money value={deadline.amount} />
          </>
        )}
      </p>
      <div>
        <DoneButton deadline={deadline} compact />
      </div>
    </article>
  )
}
