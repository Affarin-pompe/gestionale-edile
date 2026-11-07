import { cn } from 'cn'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import { Day } from '@/components/common/Formats'
import { siteLabel, type DailyReportSummary } from '../api'
import { reportPaths } from '../paths'

const LINK = 'font-medium underline-offset-4 hover:underline'

/** The report's day, linking to the report. */
export function ReportLink({
  report,
  className,
}: {
  report: Pick<DailyReportSummary, 'id' | 'date'>
  className?: string
}) {
  const company = useCompany()
  return (
    <Link to={reportPaths(company.slug).detail(report.id)} className={cn(LINK, className)}>
      <Day value={report.date} />
    </Link>
  )
}

/** The site's code and name, linking to the site's page. */
export function SiteLink({ site }: { site: DailyReportSummary['site'] }) {
  const company = useCompany()
  return (
    <Link to={reportPaths(company.slug).site(site.id)} className={LINK}>
      {siteLabel(site)}
    </Link>
  )
}
