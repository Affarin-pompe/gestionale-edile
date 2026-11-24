import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { FormattedMessage } from 'react-intl'
import { Link } from 'react-router'
import { useCompany } from '@/auth/me'
import { ItalianDate } from '@/components/common/ItalianDate'
import { Badge } from '@/components/reui/badge'
import { Button } from '@/components/ui/button'
import { formatDecimal } from '@/lib/decimal'
import { formatEuro } from '@/lib/money'
import { latestSiteCostsQuery, siteCostSummaryQuery, type SiteCostSummary } from '../api'
import { budgetShare } from '../budget'
import { QueryBody, TabSection } from '../components/TabSection'
import { sitePaths, useSiteId } from '../paths'

/** The site's costs against its budget, by category, and the latest costs entered by hand. */
export function SiteCostsPage() {
  const company = useCompany()
  const id = useSiteId()
  const summary = useQuery(siteCostSummaryQuery(company.slug, id))

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <TabSection
        title="sites.costs.budgetTitle"
        description={summary.data?.over_budget && <OverBudget />}
      >
        <QueryBody query={summary} isEmpty={() => false} empty="sites.costs.empty">
          {(data) => <BudgetUse summary={data} />}
        </QueryBody>
      </TabSection>
      <TabSection title="sites.costs.byCategory">
        <QueryBody query={summary} isEmpty={() => false} empty="sites.costs.empty">
          {(data) => <ByCategory summary={data} />}
        </QueryBody>
      </TabSection>
      <div className="lg:col-span-2">
        <LatestCosts siteId={id} />
      </div>
    </div>
  )
}

function OverBudget() {
  return (
    <Badge variant="destructive-light">
      <FormattedMessage id="sites.costs.overBudget" />
    </Badge>
  )
}

/** Total against budget, with a bar of the share used. */
function BudgetUse({ summary }: { summary: SiteCostSummary }) {
  const share = budgetShare(summary.total, summary.budget)
  const over = summary.over_budget
  return (
    <div className="flex flex-col gap-4 p-5">
      <dl className="grid grid-cols-2 gap-5">
        <Figure label={<FormattedMessage id="sites.costs.total" />}>
          {formatEuro(summary.total)}
        </Figure>
        <Figure label={<FormattedMessage id="sites.budget" />}>
          {summary.budget ? (
            formatEuro(summary.budget)
          ) : (
            <span className="text-muted-foreground">
              <FormattedMessage id="sites.costs.noBudget" />
            </span>
          )}
        </Figure>
      </dl>
      {share !== undefined && (
        <div className="flex flex-col gap-2">
          <div
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(share, 100)}
            aria-label={`${share}%`}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={over ? 'h-full bg-destructive' : 'h-full bg-primary'}
              style={{ width: `${Math.min(share, 100)}%` }}
            />
          </div>
          <p className={over ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
            {summary.budget_remaining !== null &&
              (over ? (
                <FormattedMessage
                  id="sites.costs.overBy"
                  values={{
                    share,
                    amount: formatEuro(summary.budget_remaining.replace(/^-/, '')),
                  }}
                />
              ) : (
                <FormattedMessage
                  id="sites.costs.remaining"
                  values={{ share, amount: formatEuro(summary.budget_remaining) }}
                />
              ))}
          </p>
        </div>
      )}
      {summary.missing_hourly_costs > 0 && (
        <p className="text-sm text-destructive">
          <FormattedMessage
            id="sites.costs.missingHourlyCosts"
            values={{ count: summary.missing_hourly_costs }}
          />
        </p>
      )}
    </div>
  )
}

function Figure({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-heading text-xl leading-none font-semibold tabular-nums">{children}</dd>
    </div>
  )
}

/** Labour and vehicles from the approved reports, then the costs entered by hand. */
function ByCategory({ summary }: { summary: SiteCostSummary }) {
  const rows = [
    {
      label: 'sites.costs.labor',
      amount: summary.labor.amount,
      hours: summary.labor.hours,
    },
    {
      label: 'sites.costs.vehicles',
      amount: summary.vehicles.amount,
      hours: summary.vehicles.hours,
    },
    { label: 'sites.costs.materials', amount: summary.materials },
    { label: 'sites.costs.rentals', amount: summary.rentals },
    { label: 'sites.costs.subcontract', amount: summary.subcontract },
    { label: 'sites.costs.other', amount: summary.other },
  ] as const
  return (
    <dl className="flex flex-col gap-2.5 p-5 tabular-nums">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-2.5">
          <dt className="text-muted-foreground">
            <FormattedMessage id={row.label} />
            {'hours' in row && (
              <>
                {' · '}
                <FormattedMessage
                  id="sites.costs.hours"
                  values={{ hours: formatDecimal(row.hours, 2) }}
                />
              </>
            )}
          </dt>
          <dd className="whitespace-nowrap">{formatEuro(row.amount)}</dd>
        </div>
      ))}
      <div className="flex items-baseline justify-between gap-2.5 border-t pt-2.5 font-semibold">
        <dt>
          <FormattedMessage id="sites.costs.total" />
        </dt>
        <dd className="whitespace-nowrap">{formatEuro(summary.total)}</dd>
      </div>
    </dl>
  )
}

function LatestCosts({ siteId }: { siteId: string }) {
  const company = useCompany()
  const query = useQuery(latestSiteCostsQuery(company.slug, siteId))
  return (
    <TabSection
      title="sites.costs.latest"
      description={<FormattedMessage id="sites.costs.latest.hint" />}
      actions={
        <Button asChild variant="outline">
          <Link to={sitePaths(company.slug).allCosts(siteId)}>
            <FormattedMessage id="sites.seeAll" />
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      <QueryBody query={query} isEmpty={(data) => data.data.length === 0} empty="sites.costs.none">
        {({ data }) => (
          <ul className="divide-y">
            {data.map((cost) => (
              <li
                key={cost.id}
                className="flex items-baseline justify-between gap-2.5 px-5 py-3 tabular-nums"
              >
                <div className="min-w-0">
                  <p className="font-medium break-words">{cost.description}</p>
                  <p className="text-sm text-muted-foreground">
                    <ItalianDate value={cost.date} />
                    {' · '}
                    <FormattedMessage id={`sites.costs.category.${cost.category}`} />
                    {cost.supplier && ` · ${cost.supplier.name}`}
                  </p>
                </div>
                <span className="whitespace-nowrap">{formatEuro(cost.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </QueryBody>
    </TabSection>
  )
}
