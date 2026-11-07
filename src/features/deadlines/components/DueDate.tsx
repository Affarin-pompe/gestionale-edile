import { cn } from 'cn'
import { Day } from '@/components/common/Formats'
import { isOverdue, type Deadline } from '../api'

/** The day of the deadline, in red when it has passed and the deadline is still open. */
export function DueDate({ deadline, className }: { deadline: Deadline; className?: string }) {
  return (
    <span className={cn(isOverdue(deadline) && 'font-medium text-destructive', className)}>
      <Day value={deadline.due_on} />
    </span>
  )
}
