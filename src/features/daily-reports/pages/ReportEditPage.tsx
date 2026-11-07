import { useSuspenseQuery } from '@tanstack/react-query'
import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { Day } from '@/components/common/Formats'
import { PageHeader } from '@/components/common/PageHeader'
import { reportQuery, useUpdateReport, type DailyReportInput } from '../api'
import { ReportForm } from '../components/ReportForm'
import { reportPaths, useReportId } from '../paths'
import { reportFormValues } from '../schemas'

export function ReportEditPage() {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const id = useReportId()
  const paths = reportPaths(company.slug)
  // Already loaded by the route's loader, with the version the changes apply to
  const { data, refetch } = useSuspenseQuery(reportQuery(company.slug, id))
  const { record: report, etag } = data
  const update = useUpdateReport(company.slug)

  async function save(input: DailyReportInput) {
    await update.mutateAsync({ id, input, etag })
    toast.success(intl.formatMessage({ id: 'dailyReports.updated' }))
    await navigate(paths.detail(id))
  }

  // After a 412: the newer version replaces the form (its key is the version)
  async function reload() {
    const result = await refetch()
    if (result.isError) throw result.error
  }

  const back = (
    <FormattedMessage id="dailyReports.ofDay" values={{ date: <Day value={report.date} /> }} />
  )
  return (
    <div className="mx-auto flex w-full max-w-200 flex-col gap-5">
      <PageHeader
        back={{ to: paths.detail(id), label: back }}
        title={<FormattedMessage id="dailyReports.editTitle" />}
      />
      {report.status === 'draft' ? (
        <ReportForm
          key={etag}
          report={report}
          defaultValues={reportFormValues(report)}
          onSubmit={save}
          onReload={reload}
          cancelTo={paths.detail(id)}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          <FormattedMessage id="dailyReports.notDraft" />
        </p>
      )}
    </div>
  )
}
