import { useQuery } from '@tanstack/react-query'
import { FormattedMessage } from 'react-intl'
import { ApiError } from '@/api/errors'
import { useCompany } from '@/auth/me'
import { clientQuery } from '../api'
import { useClientId } from '../paths'

/** The client's name in the breadcrumbs. It follows the cache, so a renamed client shows at once. */
export function ClientCrumb() {
  const company = useCompany()
  const id = useClientId()
  // Only what the route's loader put in the cache: no second request for a client that failed
  const { data, error } = useQuery({ ...clientQuery(company.slug, id), enabled: false })
  if (data) return data.name
  // Only a 404 says the client is not there; after other errors nothing is known about it
  const notFound = error instanceof ApiError && error.status === 404
  return <FormattedMessage id={notFound ? 'crumb.notFound' : 'clients.one'} />
}
