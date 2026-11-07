import { useQuery } from '@tanstack/react-query'
import { FormattedMessage } from 'react-intl'
import { useCompany, useMe } from '@/auth/me'
import { useCan } from '@/auth/permissions'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { dashboardQuery } from '../api'
import { DeadlineList } from '../components/DeadlineList'
import { CostsIndicator, ReportsIndicator, SitesIndicator } from '../components/Indicators'
import { OverBudgetList } from '../components/OverBudgetList'

/**
 * The company's home: indicators, the deadlines close at hand and the sites over budget.
 * A part shows only to roles that may see it (the backend sends it as null to the others).
 */
export function DashboardPage() {
  const me = useMe()
  const company = useCompany()
  const can = {
    sites: useCan('sites.view'),
    costs: useCan('costs.view'),
    reports: useCan('reports.view'),
    deadlines: useCan('deadlines.view'),
  }
  const overBudget = can.sites && can.costs
  const anything = can.sites || can.costs || can.reports || can.deadlines
  const query = useQuery({ ...dashboardQuery(company.slug), enabled: anything })
  const data = query.data

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <PageHeader title={<FormattedMessage id="home.greeting" values={{ name: me.name }} />} />
        <p className="text-muted-foreground">
          <FormattedMessage
            id="home.membership"
            values={{ company: company.name, role: company.role }}
          />
        </p>
      </div>

      {anything && query.isError && !data && (
        <div className="flex flex-wrap items-center gap-2.5">
          <p role="alert" className="text-destructive">
            <FormattedMessage id="dashboard.loadFailed" />
          </p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            <FormattedMessage id="list.retry" />
          </Button>
        </div>
      )}

      {anything && query.isPending && (
        <div aria-busy="true" className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <span className="sr-only">
            <FormattedMessage id="dashboard.loading" />
          </span>
          {can.sites && <Skeleton className="h-36 rounded-xl md:col-span-2" />}
          {can.costs && <Skeleton className="h-36 rounded-xl" />}
          {can.reports && <Skeleton className="h-36 rounded-xl" />}
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {can.sites && data.sites && <SitesIndicator sites={data.sites} />}
            {can.costs && data.costs_this_month && <CostsIndicator costs={data.costs_this_month} />}
            {can.reports && data.reports && <ReportsIndicator reports={data.reports} />}
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            {can.deadlines && data.deadlines && <DeadlineList deadlines={data.deadlines} />}
            {overBudget && data.over_budget && <OverBudgetList sites={data.over_budget} />}
          </div>
        </>
      )}
    </div>
  )
}
