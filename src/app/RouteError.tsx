import { FormattedMessage } from 'react-intl'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { ApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { ErrorLayout } from '@/layouts/ErrorLayout'

function statusOf(error: unknown) {
  if (error instanceof ApiError || isRouteErrorResponse(error)) return error.status
  return undefined
}

const homeLink = (
  <Button asChild variant="outline">
    <Link to="/">
      <FormattedMessage id="error.home" />
    </Link>
  </Button>
)

/** What a page shows when its data cannot be loaded. */
export function RouteError() {
  const status = statusOf(useRouteError())
  if (status === 404) {
    return (
      <ErrorLayout title="error.notFound.title" text="error.notFound.text">
        {homeLink}
      </ErrorLayout>
    )
  }
  if (status === 403) {
    return (
      <ErrorLayout title="error.forbidden.title" text="error.forbidden.text">
        {homeLink}
      </ErrorLayout>
    )
  }
  return (
    <ErrorLayout title="error.generic.title" text="error.generic.text">
      <Button onClick={() => window.location.reload()}>
        <FormattedMessage id="error.reload" />
      </Button>
      {homeLink}
    </ErrorLayout>
  )
}
