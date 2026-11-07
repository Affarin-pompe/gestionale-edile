import { FormattedMessage } from 'react-intl'
import { formatEuro } from '@/lib/decimal'
import type { Estimate } from '../api'
import { EstimateLink } from './EstimateLink'

/** An estimate in the list on a phone, where a table does not fit. The whole card opens it. */
export function EstimateCard({ estimate }: { estimate: Estimate }) {
  return (
    <article className="relative px-5 py-3 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-inset">
      <h2>
        <EstimateLink estimate={estimate} className="outline-none after:absolute after:inset-0" />
      </h2>
      <p className="text-sm text-muted-foreground">
        <FormattedMessage id={`estimates.status.${estimate.status}`} />
        {estimate.client && ` · ${estimate.client.name}`}
        {` · ${formatEuro(estimate.total)}`}
      </p>
    </article>
  )
}
