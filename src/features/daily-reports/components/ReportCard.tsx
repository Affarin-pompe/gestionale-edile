import { FormattedMessage } from 'react-intl'
import { siteLabel, type DailyReportSummary } from '../api'
import { formatHours } from '../hours'
import { ReportLink } from './ReportLinks'
import { ReportStatusBadge } from './ReportStatusBadge'

/** A report in the list on a phone, where a table does not fit. The whole card opens it. */
export function ReportCard({ report }: { report: DailyReportSummary }) {
  return (
    <article className="relative flex flex-col gap-1.5 px-5 py-3 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-inset">
      <h2 className="flex flex-wrap items-center gap-2.5">
        {/* The link's area covers the card, so the whole card can be tapped */}
        <ReportLink report={report} className="outline-none after:absolute after:inset-0" />
        <ReportStatusBadge status={report.status} />
      </h2>
      <p className="text-sm break-words">{siteLabel(report.site)}</p>
      <p className="text-sm text-muted-foreground">
        <FormattedMessage
          id="dailyReports.totals"
          values={{
            labor: formatHours(report.total_labor_hours),
            vehicles: formatHours(report.total_vehicle_hours),
          }}
        />
      </p>
    </article>
  )
}
