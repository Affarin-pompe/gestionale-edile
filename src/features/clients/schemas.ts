import { z } from 'zod'
import type { MessageId } from '@/i18n/it'
import { CLIENT_KINDS, DEFAULT_COUNTRY, type Client, type ClientInput } from './api'

// Messages are ids of src/i18n/it.ts: the form translates them
const message = (id: MessageId) => ({ error: id })

// Lengths as in the contract (ClientInput); an empty field is sent as null
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, message('validation.tooLong'))
    .transform((value) => value || null)

const optionalEmail = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || z.email().safeParse(value).success,
    message('validation.email'),
  )
  .transform((value) => value || null)

/** The same rules as the backend, so most mistakes show before saving. The backend checks again. */
export const clientSchema = z
  .object({
    kind: z.enum(CLIENT_KINDS, message('validation.required')),
    name: z
      .string()
      .trim()
      .min(1, message('validation.required'))
      .max(200, message('validation.tooLong')),
    vat_number: optionalText(20),
    tax_code: optionalText(16),
    email: optionalEmail,
    pec: optionalEmail,
    phone: optionalText(30),
    // 7 characters, 6 for the public administration
    sdi_code: optionalText(7).refine(
      (value) => value === null || value.length >= 6,
      message('clients.sdiCodeLength'),
    ),
    street: optionalText(200),
    postal_code: optionalText(10),
    city: optionalText(100),
    province: optionalText(2),
    // ISO 3166-1 alpha-2; the backend takes it in lower case too, and stores it in upper case
    country: z
      .string()
      .trim()
      .toUpperCase()
      .min(1, message('validation.required'))
      .refine(
        (value) => value === '' || /^[A-Z]{2}$/.test(value),
        message('clients.countryInvalid'),
      ),
    notes: optionalText(2000),
  })
  .superRefine((client, context) => {
    // The tax ids are required only for Italian clients
    if (client.country !== 'IT') return
    if (client.kind === 'person' && !client.tax_code) {
      context.addIssue({ code: 'custom', path: ['tax_code'], message: 'clients.taxCodeRequired' })
    }
    if (client.kind !== 'person' && !client.vat_number && !client.tax_code) {
      context.addIssue({
        code: 'custom',
        path: ['vat_number'],
        message: 'clients.vatOrTaxCodeRequired',
      })
    }
  }) satisfies z.ZodType<ClientInput>

/** What the inputs hold: text, empty when missing. */
export type ClientFormValues = z.input<typeof clientSchema>

/** In the order the form shows the fields: after a 422 the cursor goes to the first wrong one. */
export function clientFormValues(client?: Client): ClientFormValues {
  return {
    kind: client?.kind ?? 'company',
    name: client?.name ?? '',
    vat_number: client?.vat_number ?? '',
    tax_code: client?.tax_code ?? '',
    sdi_code: client?.sdi_code ?? '',
    email: client?.email ?? '',
    pec: client?.pec ?? '',
    phone: client?.phone ?? '',
    street: client?.street ?? '',
    postal_code: client?.postal_code ?? '',
    city: client?.city ?? '',
    province: client?.province ?? '',
    country: client?.country ?? DEFAULT_COUNTRY,
    notes: client?.notes ?? '',
  }
}
