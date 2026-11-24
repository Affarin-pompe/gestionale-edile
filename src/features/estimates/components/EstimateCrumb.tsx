import { useQuery } from '@tanstack/react-query'
import { FormattedMessage } from 'react-intl'
import { ApiError } from '@/api/errors'
import { useCompany } from '@/auth/me'
import { estimateQuery } from '../api'
import { useEstimateId } from '../paths'

/** The estimate's title in the breadcrumbs, following the cache. */
export function EstimateCrumb() {
  const company = useCompany()
  const id = useEstimateId()
  // Only what the route's loader put in the cache: no second request for one that failed
  const { data, error } = useQuery({ ...estimateQuery(company.slug, id), enabled: false })
  if (data) return data.data.title
  const notFound = error instanceof ApiError && error.status === 404
  return <FormattedMessage id={notFound ? 'crumb.notFound' : 'estimates.one'} />
}
