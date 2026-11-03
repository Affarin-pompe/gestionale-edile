import { z } from 'zod'
import type { MessageId } from '@/i18n/it'
import { CLIENT_KINDS, type Client, type ClientInput } from './api'

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
    sdi_code: optionalText(7),
    street: optionalText(200),
    postal_code: optionalText(10),
    city: optionalText(100),
    province: optionalText(2),
    notes: optionalText(2000),
  })
  .superRefine((client, context) => {
    if (client.kind === 'company' && !client.vat_number) {
      context.addIssue({ code: 'custom', path: ['vat_number'], message: 'clients.vatRequired' })
    }
    if (client.kind === 'person' && !client.tax_code) {
      context.addIssue({ code: 'custom', path: ['tax_code'], message: 'clients.taxCodeRequired' })
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
    notes: client?.notes ?? '',
  }
}
