// Amounts arrive as decimal strings ("1234.50"). The share of the budget is worked out in
// cents with BigInt, so no JavaScript float touches an amount.

const AMOUNT = /^(-?)(\d+)(?:\.(\d{1,2}))?$/

function cents(amount: string): bigint | undefined {
  const match = AMOUNT.exec(amount)
  if (!match) return undefined
  const [, sign, whole = '0', fraction = ''] = match
  const value = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
  return sign ? -value : value
}

/**
 * How much of the budget the costs used, in whole percent rounded down (e.g. 105 when
 * over budget). Undefined without a budget, or with a budget of zero.
 */
export function budgetShare(total: string, budget: string | null): number | undefined {
  if (budget === null) return undefined
  const spent = cents(total)
  const available = cents(budget)
  if (spent === undefined || available === undefined || available <= 0n) return undefined
  return Number((spent * 100n) / available)
}
