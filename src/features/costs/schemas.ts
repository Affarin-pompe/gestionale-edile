import { z } from 'zod'
import { fromInputDecimal, toInputDecimal } from '@/lib/decimal'
import { message, optionalText, requiredDay, requiredText } from '@/lib/form-schema'
import { COST_CATEGORIES, type SiteCost, type SiteCostInput } from './api'

// As the contract's Amount: up to 13 digits and 2 decimals, not negative. Typed the Italian
// way ("1.234,50") and sent with the point: the text is never turned into a number.
const AMOUNT = /^\d{1,13}(\.\d{1,2})?$/

/** The same rules as the backend (SiteCostInput), so most mistakes show before saving. */
export const costSchema = z.object({
  site_id: z.string().min(1, message('validation.required')),
  date: requiredDay,
  category: z.enum(COST_CATEGORIES, message('validation.required')),
  description: requiredText(300),
  amount: z
    .string()
    .trim()
    .min(1, message('validation.required'))
    .transform(fromInputDecimal)
    .refine((value) => AMOUNT.test(value), message('validation.amount')),
  supplier_id: z.string().transform((value) => value || null),
  notes: optionalText(2000),
}) satisfies z.ZodType<SiteCostInput>

export type CostFormValues = z.input<typeof costSchema>

/** In the order the form shows the fields: after a 422 the cursor goes to the first wrong one. */
export function costFormValues(
  cost: SiteCost | undefined,
  start: { site: string; date: string },
): CostFormValues {
  return {
    site_id: cost?.site_id ?? start.site,
    date: cost?.date ?? start.date,
    category: cost?.category ?? 'materials',
    description: cost?.description ?? '',
    amount: toInputDecimal(cost?.amount),
    supplier_id: cost?.supplier_id ?? '',
    notes: cost?.notes ?? '',
  }
}
