import { cn } from 'cn'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import type { Estimate } from '../api'
import { estimatePaths } from '../paths'

/** The estimate's title, linking to its page. */
export function EstimateLink({ estimate, className }: { estimate: Estimate; className?: string }) {
  const company = useCompany()
  return (
    <Link
      to={estimatePaths(company.slug).detail(estimate.id)}
      className={cn('font-medium break-words underline-offset-4 hover:underline', className)}
    >
      {estimate.title}
    </Link>
  )
}
