import { z } from 'zod'
import { fromInputDecimal, toInputDecimal } from '@/lib/decimal'
import type { MessageId } from '@/i18n/it'
import {
  LINE_KINDS,
  VAT_RATES,
  type Quote,
  type QuoteInput,
  type QuoteLine,
  type QuoteLineInput,
  type VatRate,
} from './api'

// Messages are ids of src/i18n/it.ts: the form translates them
const message = (id: MessageId) => ({ error: id })

const requiredText = (max: number) =>
  z.string().trim().min(1, message('validation.required')).max(max, message('validation.tooLong'))

// An empty field is sent as null
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, message('validation.tooLong'))
    .transform((value) => value || null)

/** The same rules as the backend (QuoteInput). The backend checks again. */
export const quoteSchema = z.object({
  client_id: z.string().min(1, message('validation.required')),
  subject: requiredText(200),
  validity_days: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, message('quotes.validityDays.invalid'))
    .transform(Number)
    .refine((days) => days >= 1 && days <= 365, message('quotes.validityDays.invalid')),
  notes: optionalText(5000),
  terms: optionalText(10000),
}) satisfies z.ZodType<QuoteInput>

export type QuoteFormValues = z.input<typeof quoteSchema>

const DEFAULT_VALIDITY_DAYS = 30

/** In the order the form shows the fields: after a 422 the cursor goes to the first wrong one. */
export function quoteFormValues(quote?: Quote): QuoteFormValues {
  return {
    client_id: quote?.client_id ?? '',
    subject: quote?.subject ?? '',
    validity_days: String(quote?.validity_days ?? DEFAULT_VALIDITY_DAYS),
    notes: quote?.notes ?? '',
    terms: quote?.terms ?? '',
  }
}

/** A decimal typed the Italian way ("1.234,5"), checked against the contract's pattern. */
const decimal = (pattern: RegExp) =>
  z
    .string()
    .transform(fromInputDecimal)
    .refine((value) => value === '' || pattern.test(value), message('validation.decimal'))

const QUANTITY = /^-?\d{1,11}(\.\d{1,3})?$/
const PRICE = /^\d{1,13}(\.\d{1,2})?$/
// From 0 to 100, with up to two decimals
const DISCOUNT = /^(\d{1,2}(\.\d{1,2})?|100(\.0{1,2})?)$/

/**
 * A line. Lines with a price (item) need unit, quantity, price and VAT; text and sections
 * only a description, and send the rest as null, as the contract asks.
 */
export const quoteLineSchema = z
  .object({
    kind: z.enum(LINE_KINDS),
    description: requiredText(5000),
    unit: z.string().trim().max(20, message('validation.tooLong')),
    quantity: decimal(QUANTITY),
    unit_price: decimal(PRICE),
    discount_percent: decimal(DISCOUNT),
    vat_rate: z.string(),
  })
  .superRefine((line, context) => {
    if (line.kind !== 'item') return
    for (const field of ['unit', 'quantity', 'unit_price', 'vat_rate'] as const) {
      if (line[field] === '') {
        context.addIssue({ code: 'custom', path: [field], message: 'validation.required' })
      }
    }
  })
  .transform((line): QuoteLineInput => {
    if (line.kind !== 'item') {
      return {
        kind: line.kind,
        description: line.description,
        unit: null,
        quantity: null,
        unit_price: null,
        discount_percent: null,
        vat_rate: null,
      }
    }
    return {
      kind: line.kind,
      description: line.description,
      unit: line.unit,
      quantity: line.quantity,
      unit_price: line.unit_price,
      discount_percent: line.discount_percent || '0',
      vat_rate: Number(line.vat_rate) as VatRate,
    }
  })

export type QuoteLineFormValues = z.input<typeof quoteLineSchema>

/** A new line of `kind`, or `line` as it is. VAT starts at the rate of the last item line. */
export function quoteLineFormValues(
  kind: QuoteLineFormValues['kind'],
  line?: QuoteLine,
  vatRate: VatRate = VAT_RATES[0],
): QuoteLineFormValues {
  return {
    kind: line?.kind ?? kind,
    description: line?.description ?? '',
    unit: line?.unit ?? '',
    quantity: toInputDecimal(line?.quantity),
    unit_price: toInputDecimal(line?.unit_price),
    discount_percent: toInputDecimal(line?.discount_percent),
    vat_rate: String(line?.vat_rate ?? vatRate),
  }
}
