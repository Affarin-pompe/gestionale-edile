import { FormattedDate } from 'react-intl'

/** A date of the API (2026-11-30, or a date-time) as 30/11/2026. */
export function ItalianDate({ value }: { value: string }) {
  // A date alone is read as midnight UTC: shown in UTC so it does not move a day back
  const timeZone = /^\d{4}-\d{2}-\d{2}$/.test(value) ? 'UTC' : undefined
  return (
    <FormattedDate value={value} day="2-digit" month="2-digit" year="numeric" timeZone={timeZone} />
  )
}
