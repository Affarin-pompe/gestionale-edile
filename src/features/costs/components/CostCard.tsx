import { useIntl } from 'react-intl'
import { Day } from '@/components/common/Formats'
import { formatEuro } from '@/lib/money'
import { siteLabel, type SiteCost } from '../api'
import { CostLink } from './CostLink'

/** A cost in the list on a phone, where a table does not fit. The whole card opens it. */
export function CostCard({ cost }: { cost: SiteCost }) {
  const intl = useIntl()
  return (
    <article className="relative flex flex-col gap-1.5 px-5 py-3 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-inset">
      <h2 className="flex items-baseline justify-between gap-2.5">
        {/* The link's area covers the card, so the whole card can be tapped */}
        <CostLink cost={cost} className="min-w-0 outline-none after:absolute after:inset-0" />
        <span className="shrink-0 font-medium tabular-nums">{formatEuro(cost.amount)}</span>
      </h2>
      <p className="text-sm break-words text-muted-foreground">
        <Day value={cost.date} />
        {' · '}
        {intl.formatMessage({ id: `costs.category.${cost.category}` })}
        {' · '}
        {siteLabel(cost.site)}
        {cost.supplier && ` · ${cost.supplier.name}`}
      </p>
    </article>
  )
}
