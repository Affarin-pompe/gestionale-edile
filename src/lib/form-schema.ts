import { z } from 'zod'
import type { MessageId } from '@/i18n/it'
import { isDay } from './days'

// Pieces of the modules' Zod schemas. The messages are ids of src/i18n/it.ts: the form
// translates them. What the inputs hold is always text; empty optional fields become null,
// as the contract asks.

export const message = (id: MessageId) => ({ error: id })

export const requiredText = (max: number) =>
  z.string().trim().min(1, message('validation.required')).max(max, message('validation.tooLong'))

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, message('validation.tooLong'))
    .transform((value) => value || null)

export const optionalEmail = z
  .string()
  .trim()
  .max(254, message('validation.tooLong'))
  .refine(
    (value) => value === '' || z.email().safeParse(value).success,
    message('validation.email'),
  )
  .transform((value) => value || null)

/** From an input of type date, which gives AAAA-MM-GG. */
export const requiredDay = z
  .string()
  .trim()
  .min(1, message('validation.required'))
  .refine(isDay, message('validation.date'))

export const optionalDay = z
  .string()
  .trim()
  .refine((value) => value === '' || isDay(value), message('validation.date'))
  .transform((value) => value || null)

// As the contract's Amount: up to 13 digits and 2 decimals. The comma is accepted, as
// people write it in Italy, and becomes the point: the text is never turned into a number.
const AMOUNT = /^\d{1,13}([.,]\d{1,2})?$/

export const optionalAmount = z
  .string()
  .trim()
  .refine((value) => value === '' || AMOUNT.test(value), message('validation.amount'))
  .transform((value) => (value ? value.replace(',', '.') : null))

/** An amount from the backend ("1234.50") as the input shows it ("1234,50"). */
export function amountInput(value: string | null | undefined) {
  return value ? value.replace('.', ',') : ''
}
