// Amounts arrive from the API as decimal strings ("1234.50"). They are only formatted here:
// Intl reads the string as an exact decimal, so no float sits in between.
const DECIMAL = /^-?\d+(\.\d+)?$/

// Since ES2023 Intl.NumberFormat takes decimal strings and useGrouping: 'always'; the
// project's types stop at ES2022, hence the casts
interface DecimalFormat {
  format: (value: string) => string
}
const euro = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  // Italian rules leave 4-digit amounts ungrouped (7350,00 €): in a list of amounts it reads badly
  useGrouping: 'always' as unknown as boolean,
}) as unknown as DecimalFormat

/** "7350.00" → "7.350,00 €". Anything that is not a decimal string is shown as it came. */
export function formatEuro(amount: string) {
  return DECIMAL.test(amount) ? euro.format(amount) : amount
}
