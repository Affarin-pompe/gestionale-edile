// Amounts and quantities travel as strings with a dot ("1234.50", "-0.640"). They are shown
// and typed the Italian way ("1.234,50") by moving characters, never through JavaScript
// numbers, so nothing is rounded on the way.

const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/

/**
 * "1234.5" → "1.234,50" with `decimals` (at least: longer fractions are kept as they are).
 * A value that is not a decimal is returned unchanged.
 */
export function formatDecimal(value: string, decimals = 0) {
  const match = DECIMAL.exec(value)
  if (!match) return value
  const [, sign = '', whole = '0', fraction = ''] = match
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const digits = fraction.padEnd(decimals, '0')
  return `${sign}${grouped}${digits ? `,${digits}` : ''}`
}

/** An amount in euro: "1234.5" → "1.234,50 €". */
export function formatEuro(value: string) {
  return `${formatDecimal(value, 2)}\u00a0€`
}

/** A value of the API ready for a text input: "18.50" → "18,50"; null → "". */
export function toInputDecimal(value: string | null | undefined) {
  return value == null ? '' : value.replace('.', ',')
}

/**
 * What the user typed, as the API wants it: "1.234,5" → "1234.5", "1,5" → "1.5".
 * With a comma the dots are thousands separators; without one a dot is the decimal point.
 * Spaces and a leading "+" go. The result may still be invalid: the schema checks it.
 */
export function fromInputDecimal(text: string) {
  const compact = text.replace(/\s/g, '').replace(/^\+/, '')
  return compact.includes(',') ? compact.replace(/\./g, '').replace(',', '.') : compact
}
