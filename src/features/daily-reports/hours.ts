// Hours travel as strings with a dot ("7.50"). Sums and checks are done on whole hundredths
// of an hour, parsed from the text: integers, so no decimal of JavaScript rounds them.
import { formatDecimal } from '@/lib/decimal'

const HOURS = /^(\d{1,4})(?:\.(\d{1,2}))?$/
/** The contract's limits: from 0.01 to 24 hours a row. */
export const MIN_HUNDREDTHS = 1
export const MAX_HUNDREDTHS = 2400

/** "7.5" → 750; anything that is not hours as the contract writes them → undefined. */
export function toHundredths(value: string) {
  const match = HOURS.exec(value)
  if (!match) return undefined
  const [, whole = '0', fraction = ''] = match
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

/** 750 → "7.50". */
export function fromHundredths(hundredths: number) {
  const whole = Math.floor(hundredths / 100)
  return `${whole}.${String(hundredths % 100).padStart(2, '0')}`
}

/** The sum of the valid values; the others count as nothing (the form shows their error). */
export function sumHours(values: readonly string[]) {
  return fromHundredths(values.reduce((sum, value) => sum + (toHundredths(value) ?? 0), 0))
}

/** "8.00" → "8", "7.50" → "7,5": hours as people say them. */
export function formatHours(value: string) {
  const trimmed = value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value
  return formatDecimal(trimmed)
}
