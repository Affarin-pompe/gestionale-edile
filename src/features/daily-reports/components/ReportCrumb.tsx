import { useQuery } from '@tanstack/react-query'
import { FormattedMessage } from 'react-intl'
import { ApiError } from '@/api/errors'
import { useCompany } from '@/auth/me'
import { Day } from '@/components/common/Formats'
import { reportQuery } from '../api'
import { useReportId } from '../paths'

/** "Rapportino del 06/11/2026" in the breadcrumbs. It follows the cache. */
export function ReportCrumb() {
  const company = useCompany()
  const id = useReportId()
  // Only what the route's loader put in the cache: no second request for one that failed
  const { data, error } = useQuery({ ...reportQuery(company.slug, id), enabled: false })
  if (data) {
    return (
      <FormattedMessage
        id="dailyReports.ofDay"
        values={{ date: <Day value={data.record.date} /> }}
      />
    )
  }
  const notFound = error instanceof ApiError && error.status === 404
  return <FormattedMessage id={notFound ? 'crumb.notFound' : 'dailyReports.one'} />
}
