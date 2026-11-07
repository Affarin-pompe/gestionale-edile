import { FormattedMessage } from 'react-intl'
import { formatEuro } from '@/lib/money'
import type { DashboardOverBudgetSite } from '../api'
import { DashboardSection } from './DashboardSection'

/** Sites whose costs went past the budget, the worst first as the backend sends them. */
export function OverBudgetList({ sites }: { sites: DashboardOverBudgetSite[] }) {
  return (
    <DashboardSection title={<FormattedMessage id="dashboard.overBudget" />}>
      {sites.length === 0 ? (
        <p className="text-muted-foreground">
          <FormattedMessage id="dashboard.overBudget.empty" />
        </p>
      ) : (
        <ul className="-my-3 divide-y">
          {sites.map((row) => (
            <li
              key={row.site.id}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5"
            >
              <div className="min-w-0">
                <p className="font-medium break-words">{row.site.name}</p>
                {row.site.code && <p className="text-muted-foreground">{row.site.code}</p>}
              </div>
              <div className="shrink-0 sm:text-right">
                <p className="font-medium text-destructive">
                  <FormattedMessage
                    id="dashboard.overBudget.overrun"
                    values={{ amount: formatEuro(row.overrun) }}
                  />
                </p>
                <p className="text-muted-foreground">
                  <FormattedMessage
                    id="dashboard.overBudget.detail"
                    values={{ total: formatEuro(row.total), budget: formatEuro(row.budget) }}
                  />
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  )
}
