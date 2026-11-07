import { useQuery } from '@tanstack/react-query'
import { FormattedMessage } from 'react-intl'
import { ApiError } from '@/api/errors'
import { useCompany } from '@/auth/me'
import { siteQuery } from '../api'
import { useSiteId } from '../paths'

/** The site's name in the breadcrumbs. It follows the cache, so a renamed site shows at once. */
export function SiteCrumb() {
  const company = useCompany()
  const id = useSiteId()
  // Only what the route's loader put in the cache: no second request for a site that failed
  const { data, error } = useQuery({ ...siteQuery(company.slug, id), enabled: false })
  if (data) return data.record.name
  const notFound = error instanceof ApiError && error.status === 404
  return <FormattedMessage id={notFound ? 'crumb.notFound' : 'sites.one'} />
}
