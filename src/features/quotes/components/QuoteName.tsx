import { FormattedMessage } from 'react-intl'
import type { Quote } from '../api'

/** "Preventivo 2026/001", or "Bozza" before the first sending gives it a number. */
export function QuoteName({ quote }: { quote: Pick<Quote, 'number'> }) {
  return quote.number ? (
    <FormattedMessage id="quotes.numbered" values={{ number: quote.number }} />
  ) : (
    <FormattedMessage id="quotes.status.draft" />
  )
}
