import { FormattedMessage } from 'react-intl'
import { Badge } from '@/components/reui/badge'
import { today } from '@/lib/days'
import type { Deadline } from '../api'

/** Done, overdue, due today or still to do. Overdue is worked out on today's date in Italy. */
export function DeadlineStatusBadge({ deadline }: { deadline: Deadline }) {
  const now = today()
  if (deadline.status === 'done') {
    return (
      <Badge variant="success-light" size="lg">
        <FormattedMessage id="deadlines.status.done" />
      </Badge>
    )
  }
  if (deadline.due_on < now) {
    return (
      <Badge variant="destructive-light" size="lg">
        <FormattedMessage id="deadlines.overdue" />
      </Badge>
    )
  }
  if (deadline.due_on === now) {
    return (
      <Badge variant="warning-light" size="lg">
        <FormattedMessage id="deadlines.dueToday" />
      </Badge>
    )
  }
  return (
    <Badge variant="primary-light" size="lg">
      <FormattedMessage id="deadlines.status.open" />
    </Badge>
  )
}
