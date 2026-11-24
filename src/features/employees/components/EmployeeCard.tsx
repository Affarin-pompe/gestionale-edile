import type { Employee } from '../api'
import { ActiveBadge } from './ActiveBadge'
import { EmployeeLink } from './EmployeeLink'

/** An employee in the list on a phone, where a table does not fit. The whole card opens it. */
export function EmployeeCard({ employee }: { employee: Employee }) {
  return (
    <article className="relative flex flex-col gap-1 px-5 py-3 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-inset">
      <h2 className="flex flex-wrap items-center gap-2.5">
        {/* The link's area covers the card, so the whole card can be tapped */}
        <EmployeeLink employee={employee} className="outline-none after:absolute after:inset-0" />
        <ActiveBadge active={employee.active} />
      </h2>
      {employee.job_title && <p className="text-sm text-muted-foreground">{employee.job_title}</p>}
    </article>
  )
}
