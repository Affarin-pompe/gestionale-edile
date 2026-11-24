import { useQuery } from '@tanstack/react-query'
import { FormattedMessage } from 'react-intl'
import { ApiError } from '@/api/errors'
import { useCompany } from '@/auth/me'
import { costQuery } from '../api'
import { useCostId } from '../paths'

/** The cost's description in the breadcrumbs. It follows the cache. */
export function CostCrumb() {
  const company = useCompany()
  const id = useCostId()
  // Only what the route's loader put in the cache: no second request for one that failed
  const { data, error } = useQuery({ ...costQuery(company.slug, id), enabled: false })
  if (data) return data.record.description
  const notFound = error instanceof ApiError && error.status === 404
  return <FormattedMessage id={notFound ? 'crumb.notFound' : 'costs.one'} />
}
