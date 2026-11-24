import { FormattedDate, FormattedNumber } from 'react-intl'
import { dayToDate } from '@/lib/days'

/** A date without a time (AAAA-MM-GG) as gg/mm/aaaa. */
export function Day({ value }: { value: string }) {
  return (
    <FormattedDate
      value={dayToDate(value)}
      timeZone="UTC"
      day="2-digit"
      month="2-digit"
      year="numeric"
    />
  )
}

/**
 * An amount in euro, as the backend sends it ("1234.50"). It is only shown: the number is
 * never used for sums, which the backend does.
 */
export function Money({ value }: { value: string }) {
  // At most 13 digits and 2 decimals: a JavaScript number shows them exactly
  return <FormattedNumber value={Number(value)} style="currency" currency="EUR" />
}
