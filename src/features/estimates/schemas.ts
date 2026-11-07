import { z } from 'zod'
import { fromInputDecimal, toInputDecimal } from '@/lib/decimal'
import type { MessageId } from '@/i18n/it'
import { VAT_RATES, type VatRate } from '@/features/quotes/api'
import { quoteSchema } from '@/features/quotes/schemas'
import {
  ESTIMATE_STATUSES,
  type Estimate,
  type EstimateChapter,
  type EstimateChapterInput,
  type EstimateInput,
  type EstimateItem,
  type EstimateItemInput,
  type EstimateMeasurement,
  type EstimateMeasurementInput,
  type QuoteFromEstimateInput,
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

const optionalId = z.string().transform((value) => value || null)

/** The same rules as the backend (EstimateInput). The backend checks again. */
export const estimateSchema = z.object({
  title: requiredText(200),
  client_id: optionalId,
  site_id: optionalId,
  site_address: optionalText(300),
  status: z.enum(ESTIMATE_STATUSES, message('validation.required')),
  notes: optionalText(2000),
}) satisfies z.ZodType<EstimateInput>

export type EstimateFormValues = z.input<typeof estimateSchema>

export function estimateFormValues(estimate?: Estimate): EstimateFormValues {
  return {
    title: estimate?.title ?? '',
    client_id: estimate?.client_id ?? '',
    site_id: estimate?.site_id ?? '',
    site_address: estimate?.site_address ?? '',
    status: estimate?.status ?? 'draft',
    notes: estimate?.notes ?? '',
  }
}

export const chapterSchema = z.object({
  code: optionalText(50),
  title: requiredText(200),
}) satisfies z.ZodType<EstimateChapterInput>

export type ChapterFormValues = z.input<typeof chapterSchema>

export function chapterFormValues(chapter?: EstimateChapter): ChapterFormValues {
  return { code: chapter?.code ?? '', title: chapter?.title ?? '' }
}

const PRICE = /^\d{1,13}(\.\d{1,2})?$/
const FACTOR = /^-?\d{1,9}(\.\d{1,3})?$/

/** A decimal typed the Italian way ("1.234,5"), checked against the contract's pattern. */
const decimal = (pattern: RegExp) =>
  z
    .string()
    .transform(fromInputDecimal)
    .refine((value) => value === '' || pattern.test(value), message('validation.decimal'))

export const itemSchema = z.object({
  code: optionalText(50),
  description: requiredText(5000),
  unit: requiredText(20),
  unit_price: decimal(PRICE).refine((value) => value !== '', message('validation.required')),
}) satisfies z.ZodType<EstimateItemInput>

export type ItemFormValues = z.input<typeof itemSchema>

export function itemFormValues(item?: EstimateItem): ItemFormValues {
  return {
    code: item?.code ?? '',
    description: item?.description ?? '',
    unit: item?.unit ?? '',
    unit_price: toInputDecimal(item?.unit_price),
  }
}

const factor = decimal(FACTOR).transform((value) => value || null)

/** A measurement line: the quantity is the product of the factors given, at least one. */
export const measurementSchema = z
  .object({
    description: optionalText(500),
    equal_parts: factor,
    length: factor,
    width: factor,
    height: factor,
  })
  .superRefine((line, context) => {
    if (line.equal_parts || line.length || line.width || line.height) return
    context.addIssue({
      code: 'custom',
      path: ['equal_parts'],
      message: 'estimates.measurement.factorRequired',
    })
  }) satisfies z.ZodType<EstimateMeasurementInput>

export type MeasurementFormValues = z.input<typeof measurementSchema>

export function measurementFormValues(line?: EstimateMeasurement): MeasurementFormValues {
  return {
    description: line?.description ?? '',
    equal_parts: toInputDecimal(line?.equal_parts),
    length: toInputDecimal(line?.length),
    width: toInputDecimal(line?.width),
    height: toInputDecimal(line?.height),
  }
}

/** The header of the quote made from an estimate, with the VAT rate of all its lines. */
export const quoteFromEstimateSchema = quoteSchema.extend({
  vat_rate: z
    .enum(VAT_RATES.map(String) as [string, ...string[]])
    .transform((value) => Number(value) as VatRate),
}) satisfies z.ZodType<QuoteFromEstimateInput>

export type QuoteFromEstimateFormValues = z.input<typeof quoteFromEstimateSchema>

export function quoteFromEstimateFormValues(estimate: Estimate): QuoteFromEstimateFormValues {
  return {
    client_id: estimate.client_id ?? '',
    subject: estimate.title,
    validity_days: '30',
    notes: '',
    terms: '',
    vat_rate: '10',
  }
}
