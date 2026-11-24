import { cn } from 'cn'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import type { Deadline } from '../api'
import { deadlinePaths } from '../paths'

/** The deadline's title, linking to its page. */
export function DeadlineLink({ deadline, className }: { deadline: Deadline; className?: string }) {
  const company = useCompany()
  return (
    <Link
      to={deadlinePaths(company.slug).detail(deadline.id)}
      className={cn('font-medium underline-offset-4 hover:underline', className)}
    >
      {deadline.title}
    </Link>
  )
}
