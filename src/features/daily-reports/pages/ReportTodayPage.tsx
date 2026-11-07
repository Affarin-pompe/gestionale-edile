import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Send } from 'lucide-react'
import { useId, useState } from 'react'
import { FormProvider, useForm, useFormContext } from 'react-hook-form'
import { FormattedDate, FormattedMessage, useIntl } from 'react-intl'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { ApiError } from '@/api/errors'
import { useCompany } from '@/auth/me'
import { useCan } from '@/auth/permissions'
import { FormSection } from '@/components/common/EntityForm'
import { useShowFormError } from '@/components/common/form-errors'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { isMessageId, type MessageId } from '@/i18n/it'
import {
  reportQuery,
  siteLabel,
  todayQuery,
  useChangeReportStatus,
  useCreateReport,
  useSiteOptions,
  useUpdateReport,
  type DailyReport,
  type DailyReportInput,
  type DailyReportToday,
  type SiteOption,
} from '../api'
import { HoursRows } from '../components/HoursRows'
import { ReportStatusBadge } from '../components/ReportStatusBadge'
import { hoursOptions } from '../components/use-hours-options'
import { formatHours } from '../hours'
import { FILTER, reportPaths } from '../paths'
import { reportFormValues, reportSchema, type ReportFormValues } from '../schemas'

// The sites a report is usually written for come first
const STATUS_ORDER: Record<SiteOption['status'], number> = {
  active: 0,
  suspended: 1,
  planned: 2,
  completed: 3,
}
const WEATHER = [
  'dailyReports.weather.sunny',
  'dailyReports.weather.cloudy',
  'dailyReports.weather.rain',
  'dailyReports.weather.wind',
  'dailyReports.weather.snow',
] as const satisfies MessageId[]

const BIG = 'h-12 text-base md:text-base'

/**
 * Today's report, made for the site manager's phone: pick the site (skipped when only one
 * is in progress), then the report of today opens, or the backend's proposal with the
 * site's team at 8 hours. Save as a draft, or save and send to the office.
 */
export function ReportTodayPage() {
  const [params] = useSearchParams()
  const sites = useSiteOptions()
  const active = sites.data?.filter((s) => s.status === 'active') ?? []
  const chosen = params.get(FILTER.site) ?? (active.length === 1 ? active[0]?.id : undefined)
  const several = (sites.data?.length ?? 0) > 1

  return (
    <div className="mx-auto flex w-full max-w-155 flex-col gap-5">
      <PageHeader title={<FormattedMessage id="dailyReports.today.title" />} />
      {chosen ? (
        <TodayOfSite key={chosen} site={chosen} canChange={several} />
      ) : sites.isPending ? (
        <Skeleton className="h-40" />
      ) : (
        <SitePicker sites={sites.data ?? []} />
      )}
    </div>
  )
}

function SitePicker({ sites }: { sites: SiteOption[] }) {
  const company = useCompany()
  const paths = reportPaths(company.slug)
  const sorted = sites
    .filter((s) => s.status !== 'completed')
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
  if (sorted.length === 0) {
    return (
      <p className="text-base text-muted-foreground">
        <FormattedMessage id="dailyReports.today.noSites" />
      </p>
    )
  }
  return (
    <Card asChild className="gap-0 py-0">
      <nav aria-labelledby="today-sites">
        <h2 id="today-sites" className="border-b px-5 py-4 text-base font-semibold">
          <FormattedMessage id="dailyReports.today.chooseSite" />
        </h2>
        <ul>
          {sorted.map((site) => (
            <li key={site.id} className="border-b last:border-b-0">
              <Link
                to={paths.today(site.id)}
                className="flex min-h-14 items-center justify-between gap-2.5 px-5 py-3 text-base hover:bg-muted/50"
              >
                <span className="min-w-0 break-words">{siteLabel(site)}</span>
                <ChevronRight
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Card>
  )
}

function TodayOfSite({ site, canChange }: { site: string; canChange: boolean }) {
  const company = useCompany()
  const paths = reportPaths(company.slug)
  const canCreate = useCan('reports.create')
  const canUpdate = useCan('reports.update')
  const day = useQuery(todayQuery(company.slug, site))
  const draft = day.data?.report?.status === 'draft' ? day.data.report : undefined
  // A draft is changed over its version: the today's answer has no ETag, the report has
  const versioned = useQuery({
    ...reportQuery(company.slug, draft?.id ?? ''),
    enabled: draft !== undefined && canUpdate,
  })

  if (day.isError) {
    const notFound = day.error instanceof ApiError && day.error.status === 404
    return (
      <div className="flex flex-col gap-2.5">
        <p role="alert" className="text-base text-destructive">
          <FormattedMessage id={notFound ? 'dailyReports.today.siteNotFound' : 'list.loadFailed'} />
        </p>
        <Button asChild variant="outline" size="lg" className={BIG}>
          <Link to={paths.today()}>
            <FormattedMessage id="dailyReports.today.changeSite" />
          </Link>
        </Button>
      </div>
    )
  }
  if (!day.data || (draft && canUpdate && !versioned.data)) {
    return <Skeleton className="h-96" />
  }

  const { data } = day
  const header = (
    <div className="flex flex-col gap-1">
      <p className="text-base font-semibold break-words">{siteLabel(data.site)}</p>
      <p className="flex flex-wrap items-center gap-2.5 text-sm text-muted-foreground">
        <FormattedDate
          value={`${data.date}T12:00:00Z`}
          timeZone="UTC"
          weekday="long"
          day="numeric"
          month="long"
        />
        {canChange && (
          <Link
            to={paths.today()}
            className="font-medium text-foreground underline underline-offset-4"
          >
            <FormattedMessage id="dailyReports.today.changeSite" />
          </Link>
        )}
      </p>
    </div>
  )

  if (draft && canUpdate && versioned.data) {
    return (
      <>
        {header}
        <PhoneForm
          key={versioned.data.etag}
          today={data}
          report={versioned.data.record}
          etag={versioned.data.etag}
        />
      </>
    )
  }
  if (data.report) {
    return (
      <>
        {header}
        <Written report={data.report} />
      </>
    )
  }
  return (
    <>
      {header}
      {canCreate ? (
        <PhoneForm today={data} />
      ) : (
        <p className="text-base text-muted-foreground">
          <FormattedMessage id="dailyReports.today.none" />
        </p>
      )}
    </>
  )
}

/** A report already sent (or one this role cannot change): what it says, and the way to it. */
function Written({ report }: { report: DailyReport }) {
  const company = useCompany()
  const paths = reportPaths(company.slug)
  return (
    <Card className="gap-4 px-5">
      <p className="flex flex-wrap items-center gap-2.5 text-base">
        <ReportStatusBadge status={report.status} />
        <FormattedMessage id={`dailyReports.today.written.${report.status}`} />
      </p>
      <p className="text-sm text-muted-foreground">
        <FormattedMessage
          id="dailyReports.totals"
          values={{
            labor: formatHours(report.total_labor_hours),
            vehicles: formatHours(report.total_vehicle_hours),
          }}
        />
      </p>
      <Button asChild variant="outline" size="lg" className={BIG}>
        <Link to={paths.detail(report.id)}>
          <FormattedMessage id="dailyReports.today.open" />
        </Link>
      </Button>
    </Card>
  )
}

function PhoneForm({
  today,
  report,
  etag,
}: {
  today: DailyReportToday
  /** The draft already written today, with its version; without it, a new report. */
  report?: DailyReport
  etag?: string
}) {
  const intl = useIntl()
  const company = useCompany()
  const canSubmit = useCan('reports.update')
  const create = useCreateReport(company.slug)
  const update = useUpdateReport(company.slug)
  const status = useChangeReportStatus(company.slug)
  const form = useForm<ReportFormValues, unknown, DailyReportInput>({
    resolver: zodResolver(reportSchema),
    defaultValues: reportFormValues(report ?? today.proposal),
  })
  const showError = useShowFormError(form)
  const [problem, setProblem] = useState<string>()
  const [sending, setSending] = useState(false)
  const options = hoursOptions(today, report)

  function submit(send: boolean) {
    return form.handleSubmit(async (input) => {
      setProblem(undefined)
      setSending(send)
      try {
        const saved =
          report && etag
            ? await update.mutateAsync({ id: report.id, input, etag })
            : await create.mutateAsync(input)
        if (send) {
          await status.mutateAsync({ id: saved.record.id, status: 'submitted', etag: saved.etag })
        }
        toast.success(
          intl.formatMessage({ id: send ? 'dailyReports.submitted' : 'dailyReports.today.saved' }),
        )
      } catch (error) {
        setProblem(showError(error))
      }
    })
  }

  const busy = form.formState.isSubmitting
  return (
    <FormProvider {...form}>
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(event) => void submit(canSubmit)(event)}
      >
        <FormSection legend="dailyReports.workDone">
          <BigText
            name="work_done"
            label="dailyReports.workDone.field"
            multiline
            maxLength={5000}
          />
          <WeatherField />
        </FormSection>
        <FormSection legend="dailyReports.section.labor">
          <HoursRows kind="labor" options={options.labor} large />
        </FormSection>
        <FormSection legend="dailyReports.section.vehicles">
          <HoursRows kind="vehicles" options={options.vehicles} large />
        </FormSection>
        <FormSection legend="dailyReports.notes">
          <BigText name="notes" label="dailyReports.notes.field" multiline maxLength={2000} />
        </FormSection>
        {problem && (
          <p role="alert" className="text-base text-destructive">
            {problem}
          </p>
        )}
        <div className="flex flex-col gap-2.5">
          {canSubmit && (
            <Button type="submit" size="lg" className={BIG} disabled={busy}>
              <Send aria-hidden="true" />
              <FormattedMessage
                id={busy && sending ? 'dailyReports.today.sending' : 'dailyReports.today.send'}
              />
            </Button>
          )}
          <Button
            type={canSubmit ? 'button' : 'submit'}
            variant={canSubmit ? 'outline' : 'default'}
            size="lg"
            className={BIG}
            disabled={busy}
            onClick={canSubmit ? (event) => void submit(false)(event) : undefined}
          >
            <FormattedMessage
              id={busy && !sending ? 'form.saving' : 'dailyReports.today.saveDraft'}
            />
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}

/** A big text field with its label above, for a phone. */
function BigText({
  name,
  label,
  multiline = false,
  maxLength,
}: {
  name: 'work_done' | 'notes' | 'weather'
  label: MessageId
  multiline?: boolean
  maxLength: number
}) {
  const intl = useIntl()
  const id = useId()
  const { register, formState } = useFormContext<ReportFormValues>()
  const error = formState.errors[name]?.message
  const message = error && (isMessageId(error) ? intl.formatMessage({ id: error }) : error)
  const control = {
    id,
    maxLength,
    'aria-invalid': message ? true : undefined,
    'aria-describedby': message ? `${id}-error` : undefined,
    ...register(name),
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        <FormattedMessage id={label} />
      </label>
      {multiline ? (
        <Textarea {...control} rows={4} className="min-h-28 text-base md:text-base" />
      ) : (
        <Input {...control} className={BIG} />
      )}
      {message && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  )
}

/** The weather, typed or picked with one tap. */
function WeatherField() {
  const intl = useIntl()
  const { setValue } = useFormContext<ReportFormValues>()
  return (
    <div className="flex flex-col gap-2.5">
      <BigText name="weather" label="dailyReports.weather" maxLength={100} />
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={intl.formatMessage({ id: 'dailyReports.weather.quick' })}
      >
        {WEATHER.map((id) => (
          <Button
            key={id}
            type="button"
            variant="outline"
            size="lg"
            className="h-10 text-sm"
            onClick={() => setValue('weather', intl.formatMessage({ id }), { shouldDirty: true })}
          >
            <FormattedMessage id={id} />
          </Button>
        ))}
      </div>
    </div>
  )
}
