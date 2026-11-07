import { useQuery } from '@tanstack/react-query'
import { FormattedMessage } from 'react-intl'
import { ApiError } from '@/api/errors'
import { useCompany } from '@/auth/me'
import { quoteQuery } from '../api'
import { useQuoteId } from '../paths'
import { QuoteName } from './QuoteName'

/** The quote's number (or "Bozza") in the breadcrumbs, following the cache. */
export function QuoteCrumb() {
  const company = useCompany()
  const id = useQuoteId()
  // Only what the route's loader put in the cache: no second request for a quote that failed
  const { data, error } = useQuery({ ...quoteQuery(company.slug, id), enabled: false })
  if (data) return <QuoteName quote={data.data} />
  const notFound = error instanceof ApiError && error.status === 404
  return <FormattedMessage id={notFound ? 'crumb.notFound' : 'quotes.one'} />
}
