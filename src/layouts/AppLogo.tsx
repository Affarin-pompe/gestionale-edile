import { cn } from 'cn'
import { HardHat } from 'lucide-react'
import { FormattedMessage } from 'react-intl'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'

/** The app's mark and name, linking to the company's dashboard. */
export function AppLogo({
  markOnly = false,
  className,
}: {
  markOnly?: boolean
  className?: string
}) {
  const { slug } = useCompany()
  return (
    <Link
      to={`/${slug}`}
      className={cn(
        'flex min-w-0 items-center gap-2.5 rounded-md font-heading text-base font-semibold outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <HardHat className="size-4.5" aria-hidden="true" />
      </span>
      {/* The name is the link's text even when only the mark shows */}
      <span className={cn('truncate', markOnly && 'sr-only')}>
        <FormattedMessage id="app.name" />
      </span>
    </Link>
  )
}
