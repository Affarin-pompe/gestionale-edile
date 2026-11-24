import { FormattedDate, FormattedMessage, FormattedNumber } from 'react-intl'
import { calendarDay } from '@/lib/dates'
import { formatEuro } from '@/lib/money'
import type { Dashboard } from '../api'
import { DashboardSection, Stat, Stats } from './DashboardSection'

export function SitesIndicator({ sites }: { sites: NonNullable<Dashboard['sites']> }) {
  return (
    <DashboardSection title={<FormattedMessage id="dashboard.sites" />} className="md:col-span-2">
      <Stats>
        <Stat
          label={<FormattedMessage id="dashboard.sites.active" />}
          value={<FormattedNumber value={sites.active} />}
        />
        <Stat
          label={<FormattedMessage id="dashboard.sites.planned" />}
          value={<FormattedNumber value={sites.planned} />}
        />
        <Stat
          label={<FormattedMessage id="dashboard.sites.suspended" />}
          value={<FormattedNumber value={sites.suspended} />}
        />
        <Stat
          label={<FormattedMessage id="dashboard.sites.completed" />}
          value={<FormattedNumber value={sites.completed} />}
        />
      </Stats>
    </DashboardSection>
  )
}

export function CostsIndicator({ costs }: { costs: NonNullable<Dashboard['costs_this_month']> }) {
  const month = (
    <FormattedDate
      value={calendarDay(`${costs.month}-01`)}
      month="long"
      year="numeric"
      timeZone="UTC"
    />
  )
  return (
    <DashboardSection title={<FormattedMessage id="dashboard.costs" values={{ month }} />}>
      <p className="font-heading text-2xl leading-none font-semibold">{formatEuro(costs.total)}</p>
      <p className="mt-2 text-muted-foreground">
        <FormattedMessage id="dashboard.costs.hint" />
      </p>
    </DashboardSection>
  )
}

export function ReportsIndicator({ reports }: { reports: NonNullable<Dashboard['reports']> }) {
  return (
    <DashboardSection title={<FormattedMessage id="dashboard.reports" />}>
      <dl className="grid grid-cols-2 gap-5">
        <Stat
          label={<FormattedMessage id="dashboard.reports.toApprove" />}
          value={<FormattedNumber value={reports.to_approve} />}
        />
        <Stat
          label={<FormattedMessage id="dashboard.reports.drafts" />}
          value={<FormattedNumber value={reports.drafts} />}
        />
      </dl>
    </DashboardSection>
  )
}
