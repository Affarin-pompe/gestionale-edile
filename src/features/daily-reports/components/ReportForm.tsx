import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { FormattedMessage } from 'react-intl'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import { EntityForm, FormSection, OptionsField, TextField } from '@/components/common/EntityForm'
import { Day } from '@/components/common/Formats'
import { siteLabel, useSiteOptions, type DailyReport, type DailyReportInput } from '../api'
import { reportPaths } from '../paths'
import { reportSchema, type ReportFormValues } from '../schemas'
import { HoursRows } from './HoursRows'
import { hoursOptions, useDayOfSite } from './use-hours-options'

const Text = TextField<ReportFormValues>

/** New report when `report` is missing, otherwise the changes of a draft. */
export function ReportForm({
  report,
  defaultValues,
  onSubmit,
  onReload,
  cancelTo,
}: {
  report?: DailyReport
  defaultValues: ReportFormValues
  onSubmit: (input: DailyReportInput) => Promise<void>
  /** Loads the report again after someone else changed it (see EntityForm). */
  onReload?: () => Promise<void>
  cancelTo: string
}) {
  const company = useCompany()
  const paths = reportPaths(company.slug)
  const form = useForm<ReportFormValues, unknown, DailyReportInput>({
    resolver: zodResolver(reportSchema),
    defaultValues,
  })
  const [site, date] = useWatch({ control: form.control, name: ['site_id', 'date'] })
  const sites = useSiteOptions().data
  const siteOptions = (sites ?? []).map((s) => ({ value: s.id, text: siteLabel(s) }))
  // The report's site shows even when it is not among the options (past the first page)
  if (report && !siteOptions.some((o) => o.value === report.site_id)) {
    siteOptions.unshift({ value: report.site_id, text: siteLabel(report.site) })
  }
  const day = useDayOfSite(site, date).data
  const options = hoursOptions(day, report)
  // One report per site and day: say so before the backend does, with the way to it
  const other = day?.report && day.report.id !== report?.id ? day.report : undefined
  const noSite = site === '' ? 'dailyReports.rows.chooseSite' : undefined

  return (
    <EntityForm form={form} onSubmit={onSubmit} onReload={onReload} cancelTo={cancelTo}>
      <FormSection legend="dailyReports.section.day">
        {/* Keyed on the options, so the saved choice is selected once they arrive */}
        <OptionsField<ReportFormValues>
          key={sites ? 'loaded' : 'loading'}
          name="site_id"
          label="dailyReports.site"
          empty="dailyReports.site.choose"
          groups={[{ options: siteOptions }]}
          required
        />
        <Text name="date" label="dailyReports.date" type="date" required />
        {other && (
          <p role="status" className="text-sm text-destructive">
            <FormattedMessage
              id="dailyReports.alreadyExists"
              values={{
                date: <Day value={other.date} />,
                link: (chunks) => (
                  <Link
                    to={paths.detail(other.id)}
                    className="font-medium underline underline-offset-4"
                  >
                    {chunks}
                  </Link>
                ),
              }}
            />
          </p>
        )}
        <Text
          name="weather"
          label="dailyReports.weather"
          hint="dailyReports.weather.hint"
          maxLength={100}
        />
      </FormSection>
      <FormSection legend="dailyReports.workDone">
        <Text name="work_done" label="dailyReports.workDone.field" multiline maxLength={5000} />
      </FormSection>
      <FormSection legend="dailyReports.section.labor">
        <HoursRows kind="labor" options={options.labor} disabledHint={noSite} />
      </FormSection>
      <FormSection legend="dailyReports.section.vehicles">
        <HoursRows kind="vehicles" options={options.vehicles} disabledHint={noSite} />
      </FormSection>
      <Text name="notes" label="dailyReports.notes" multiline maxLength={2000} />
    </EntityForm>
  )
}
