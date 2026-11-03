import { FormattedMessage } from 'react-intl'
import { isRouteErrorResponse, Link, useParams, useRouteError } from 'react-router'
import { ApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { ErrorLayout } from '@/layouts/ErrorLayout'

function statusOf(error: unknown) {
  if (error instanceof ApiError || isRouteErrorResponse(error)) return error.status
  return undefined
}

function ErrorView({ inPage }: { inPage: boolean }) {
  const status = statusOf(useRouteError())
  const { azienda } = useParams()
  // Inside the layout the company is valid: back to its dashboard
  const home = inPage && azienda ? `/${azienda}` : '/'
  const homeLink = (
    <Button asChild variant="outline">
      <Link to={home}>
        <FormattedMessage id="error.home" />
      </Link>
    </Button>
  )

  if (status === 404) {
    return (
      <ErrorLayout title="error.notFound.title" text="error.notFound.text" inPage={inPage}>
        {homeLink}
      </ErrorLayout>
    )
  }
  if (status === 403) {
    return (
      <ErrorLayout title="error.forbidden.title" text="error.forbidden.text" inPage={inPage}>
        {homeLink}
      </ErrorLayout>
    )
  }
  return (
    <ErrorLayout title="error.generic.title" text="error.generic.text" inPage={inPage}>
      <Button onClick={() => window.location.reload()}>
        <FormattedMessage id="error.reload" />
      </Button>
      {homeLink}
    </ErrorLayout>
  )
}

/** Errors that replace the whole page, layout included. */
export function RouteError() {
  return <ErrorView inPage={false} />
}

/** Errors of a page inside the app layout: menu and header stay. */
export function PageError() {
  return <ErrorView inPage />
}
