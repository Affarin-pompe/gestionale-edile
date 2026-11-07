import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { PageHeader } from '@/components/common/PageHeader'
import { today } from '@/lib/days'
import { useCreateReport, type DailyReportInput } from '../api'
import { ReportForm } from '../components/ReportForm'
import { FILTER, reportPaths } from '../paths'
import { emptyReportValues } from '../schemas'

/** A report for any day; ?cantiere=<id> starts it on that site. */
export function ReportNewPage() {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const paths = reportPaths(company.slug)
  const [params] = useSearchParams()
  const create = useCreateReport(company.slug)

  async function save(input: DailyReportInput) {
    const { record } = await create.mutateAsync(input)
    toast.success(intl.formatMessage({ id: 'dailyReports.created' }))
    await navigate(paths.detail(record.id))
  }

  return (
    <div className="mx-auto flex w-full max-w-200 flex-col gap-5">
      <PageHeader
        back={{ to: paths.list, label: <FormattedMessage id="dailyReports.title" /> }}
        title={<FormattedMessage id="dailyReports.new" />}
      />
      <ReportForm
        defaultValues={emptyReportValues(params.get(FILTER.site) ?? '', today())}
        onSubmit={save}
        cancelTo={paths.list}
      />
    </div>
  )
}
