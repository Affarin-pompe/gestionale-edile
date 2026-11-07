import { useQuery } from '@tanstack/react-query'
import { FormattedMessage } from 'react-intl'
import { ApiError } from '@/api/errors'
import { useCompany } from '@/auth/me'
import { deadlineQuery } from '../api'
import { useDeadlineId } from '../paths'

/** The deadline's title in the breadcrumbs. It follows the cache, so a change shows at once. */
export function DeadlineCrumb() {
  const company = useCompany()
  const id = useDeadlineId()
  // Only what the route's loader put in the cache: no second request for one that failed
  const { data, error } = useQuery({ ...deadlineQuery(company.slug, id), enabled: false })
  if (data) return data.record.title
  const notFound = error instanceof ApiError && error.status === 404
  return <FormattedMessage id={notFound ? 'crumb.notFound' : 'deadlines.one'} />
}
