import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { FormattedMessage } from 'react-intl'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import { ItalianDate } from '@/components/common/ItalianDate'
import { Badge, type BadgeProps } from '@/components/reui/badge'
import { Button } from '@/components/ui/button'
import { formatDecimal } from '@/lib/decimal'
import { latestSiteReportsQuery, LATEST, type SiteReportStatus } from '../api'
import { QueryBody, TabSection } from '../components/TabSection'
import { sitePaths, useSiteId } from '../paths'

const VARIANTS = {
  draft: 'invert-light',
  submitted: 'warning-light',
  approved: 'success-light',
} as const satisfies Record<SiteReportStatus, BadgeProps['variant']>

/** The latest reports of the site; the reports module lists them all. */
export function SiteReportsPage() {
  const company = useCompany()
  const id = useSiteId()
  const paths = sitePaths(company.slug)
  const query = useQuery(latestSiteReportsQuery(company.slug, id))

  return (
    <TabSection
      title="sites.reports.title"
      description={
        query.data && (
          <FormattedMessage
            id="sites.reports.count"
            values={{ shown: query.data.data.length, total: query.data.meta.total, max: LATEST }}
          />
        )
      }
      actions={
        <Button asChild variant="outline">
          <Link to={paths.allReports(id)}>
            <FormattedMessage id="sites.seeAll" />
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      <QueryBody
        query={query}
        isEmpty={(data) => data.data.length === 0}
        empty="sites.reports.empty"
      >
        {({ data }) => (
          <ul className="divide-y">
            {data.map((report) => (
              <li key={report.id} className="relative flex flex-col gap-1 px-5 py-3">
                <p className="flex flex-wrap items-center gap-2.5">
                  <Link
                    to={paths.report(report.id)}
                    className="font-medium underline-offset-4 outline-none after:absolute after:inset-0 hover:underline focus-visible:underline"
                  >
                    <ItalianDate value={report.date} />
                  </Link>
                  <Badge variant={VARIANTS[report.status]}>
                    <FormattedMessage id={`sites.reports.status.${report.status}`} />
                  </Badge>
                </p>
                {report.work_done && <p className="line-clamp-2 break-words">{report.work_done}</p>}
                <p className="text-sm text-muted-foreground tabular-nums">
                  <FormattedMessage
                    id="sites.reports.hours"
                    values={{
                      labor: formatDecimal(report.total_labor_hours, 2),
                      vehicles: formatDecimal(report.total_vehicle_hours, 2),
                    }}
                  />
                  {report.weather && ` · ${report.weather}`}
                  {report.created_by && ` · ${report.created_by.name}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </QueryBody>
    </TabSection>
  )
}
