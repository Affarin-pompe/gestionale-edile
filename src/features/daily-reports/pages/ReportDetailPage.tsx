import { useSuspenseQuery } from '@tanstack/react-query'
import { FormattedDate, FormattedMessage } from 'react-intl'
import { useCompany } from '@/auth/me'
import { Detail, DetailSection, NotesSection, Section } from '@/components/common/DetailSection'
import { Day } from '@/components/common/Formats'
import { PageHeader } from '@/components/common/PageHeader'
import type { MessageId } from '@/i18n/it'
import { reportQuery, type DailyReport } from '../api'
import { ReportActions } from '../components/ReportActions'
import { SiteLink } from '../components/ReportLinks'
import { ReportStatusBadge } from '../components/ReportStatusBadge'
import { formatHours } from '../hours'
import { reportPaths, useReportId } from '../paths'

export function ReportDetailPage() {
  const company = useCompany()
  const id = useReportId()
  const paths = reportPaths(company.slug)
  // Already loaded by the route's loader
  const { record: report, etag } = useSuspenseQuery(reportQuery(company.slug, id)).data

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <PageHeader
        back={{ to: paths.list, label: <FormattedMessage id="dailyReports.title" /> }}
        title={
          <FormattedMessage
            id="dailyReports.ofDay"
            values={{ date: <Day value={report.date} /> }}
          />
        }
        actions={<ReportActions report={report} etag={etag} />}
      />
      <p className="flex flex-wrap items-center gap-2.5">
        <ReportStatusBadge status={report.status} />
        <span className="text-sm text-muted-foreground">
          <StatusNote report={report} />
        </span>
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        <DetailSection title="dailyReports.section.day">
          <Detail label="dailyReports.site">
            <SiteLink site={report.site} />
          </Detail>
          <Detail label="dailyReports.date">
            <FormattedDate
              value={`${report.date}T12:00:00Z`}
              timeZone="UTC"
              weekday="long"
              day="numeric"
              month="long"
              year="numeric"
            />
          </Detail>
          <Detail label="dailyReports.weather">{report.weather}</Detail>
          <Detail label="dailyReports.createdBy">{report.created_by?.name}</Detail>
        </DetailSection>
        <NotesSection title="dailyReports.workDone" notes={report.work_done} />
        <HoursSection
          title="dailyReports.section.labor"
          empty="dailyReports.labor.none"
          total={report.total_labor_hours}
          rows={report.labor.map((row) => ({
            id: row.employee_id,
            name: `${row.last_name} ${row.first_name}`,
            hours: row.hours,
            description: row.description,
          }))}
        />
        <HoursSection
          title="dailyReports.section.vehicles"
          empty="dailyReports.vehicles.none"
          total={report.total_vehicle_hours}
          rows={report.vehicles.map((row) => ({
            id: row.vehicle_id,
            name: row.plate ? `${row.name} (${row.plate})` : row.name,
            hours: row.hours,
            description: row.description,
          }))}
        />
        <NotesSection title="dailyReports.notes" notes={report.notes} />
      </div>
    </div>
  )
}

/** When it was sent and approved, and by whom. */
function StatusNote({ report }: { report: DailyReport }) {
  const when = (value: string) => (
    <FormattedDate
      value={value}
      timeZone="Europe/Rome"
      day="2-digit"
      month="2-digit"
      year="numeric"
      hour="2-digit"
      minute="2-digit"
    />
  )
  if (report.status === 'approved' && report.approved_at) {
    return (
      <FormattedMessage
        id="dailyReports.approvedOn"
        values={{ when: when(report.approved_at), who: report.approved_by?.name ?? '—' }}
      />
    )
  }
  if (report.status === 'submitted' && report.submitted_at) {
    return (
      <FormattedMessage
        id="dailyReports.submittedOn"
        values={{ when: when(report.submitted_at) }}
      />
    )
  }
  if (report.status === 'draft') return <FormattedMessage id="dailyReports.draftNote" />
  return null
}

function HoursSection({
  title,
  empty,
  total,
  rows,
}: {
  title: MessageId
  empty: MessageId
  total: string
  rows: { id: string; name: string; hours: string; description: string | null }[]
}) {
  return (
    <Section title={title}>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">
          <FormattedMessage id={empty} />
        </p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-baseline justify-between gap-2.5 border-b py-2.5 first:pt-0"
            >
              <span className="min-w-0 break-words">
                {row.name}
                {row.description && (
                  <span className="block text-sm text-muted-foreground">{row.description}</span>
                )}
              </span>
              <span className="shrink-0 tabular-nums">
                <FormattedMessage
                  id="dailyReports.hoursValue"
                  values={{ hours: formatHours(row.hours) }}
                />
              </span>
            </li>
          ))}
          <li className="flex justify-between gap-2.5 pt-2.5 font-medium">
            <FormattedMessage id="dailyReports.total" />
            <span className="tabular-nums">
              <FormattedMessage
                id="dailyReports.hoursValue"
                values={{ hours: formatHours(total) }}
              />
            </span>
          </li>
        </ul>
      )}
    </Section>
  )
}
