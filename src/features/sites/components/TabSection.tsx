import type { UseQueryResult } from '@tanstack/react-query'
import { useId, type ReactNode } from 'react'
import { FormattedMessage } from 'react-intl'
import { ApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { MessageId } from '@/i18n/it'

/**
 * A block of a site's tab: a card with one title, optional actions on its right, and the
 * content right inside it, without further boxes.
 */
export function TabSection({
  title,
  description,
  actions,
  children,
}: {
  title: MessageId
  /** One line under the title, e.g. a count or a warning. */
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  const id = useId()
  return (
    <Card asChild>
      <section aria-labelledby={id}>
        <CardHeader>
          <h2 id={id} className="font-heading text-base leading-none font-semibold">
            <FormattedMessage id={title} />
          </h2>
          {description && <div className="text-sm text-muted-foreground">{description}</div>}
          {actions && <CardAction className="flex flex-wrap gap-2.5">{actions}</CardAction>}
        </CardHeader>
        {children}
      </section>
    </Card>
  )
}

/**
 * The content of a block that loads its data: skeletons while loading, a retry after an
 * error (only the message for a 403), the empty text, or `children` with the data.
 */
export function QueryBody<T>({
  query,
  isEmpty,
  empty,
  children,
}: {
  query: UseQueryResult<T>
  isEmpty: (data: T) => boolean
  empty: MessageId
  children: (data: T) => ReactNode
}) {
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-2 p-5">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }
  if (query.isError) {
    const forbidden = query.error instanceof ApiError && query.error.status === 403
    return (
      <div role="alert" className="flex flex-col items-start gap-2.5 p-5">
        <p className="text-muted-foreground">
          <FormattedMessage id={forbidden ? 'action.forbidden' : 'list.loadFailed'} />
        </p>
        {!forbidden && (
          <Button variant="outline" onClick={() => void query.refetch()}>
            <FormattedMessage id="list.retry" />
          </Button>
        )}
      </div>
    )
  }
  if (isEmpty(query.data)) {
    return (
      <p className="p-5 text-muted-foreground">
        <FormattedMessage id={empty} />
      </p>
    )
  }
  return children(query.data)
}
