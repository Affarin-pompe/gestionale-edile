import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

/**
 * The title of a page, with its main actions on the right and, above it, an optional
 * link back to where the page belongs (e.g. from a client to the list).
 */
export function PageHeader({
  title,
  back,
  actions,
}: {
  /** A text from src/i18n (FormattedMessage) or data, like a client's name. */
  title: ReactNode
  /** Where the page belongs, named: a text from src/i18n or data, like a client's name. */
  back?: { to: string; label: ReactNode }
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      {back && (
        <Link
          to={back.to}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-2xl font-semibold break-words">{title}</h1>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}
