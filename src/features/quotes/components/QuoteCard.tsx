import { FormattedMessage } from 'react-intl'
import { formatEuro } from '@/lib/decimal'
import type { Quote } from '../api'
import { QuoteLink } from './QuoteLink'

/** A quote in the list on a phone, where a table does not fit. The whole card opens it. */
export function QuoteCard({ quote }: { quote: Quote }) {
  return (
    <article className="relative px-5 py-3 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-inset">
      <h2>
        <QuoteLink quote={quote} className="outline-none after:absolute after:inset-0" />
      </h2>
      <p className="text-sm text-muted-foreground">
        {quote.number ?? <FormattedMessage id="quotes.status.draft" />}
        {quote.number && (
          <>
            {' · '}
            <FormattedMessage id={`quotes.status.${quote.status}`} />
          </>
        )}
        {` · ${quote.client.name} · ${formatEuro(quote.totals.total)}`}
      </p>
    </article>
  )
}
