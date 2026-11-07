import { z } from 'zod'
import {
  amountInput,
  message,
  optionalAmount,
  optionalText,
  requiredDay,
  requiredText,
} from '@/lib/form-schema'
import { DEADLINE_KINDS, DEADLINE_RECURRENCES, type Deadline, type DeadlineInput } from './api'

// The form picks the client or the supplier in one select: "client:<id>" or "supplier:<id>"
const SUBJECT = /^(client|supplier):(.+)$/

/** The same rules as the backend (DeadlineInput), so most mistakes show before saving. */
export const deadlineSchema = z
  .object({
    title: requiredText(200),
    due_on: requiredDay,
    kind: z.enum(DEADLINE_KINDS, message('validation.required')),
    amount: optionalAmount,
    subject: z
      .string()
      .refine((value) => value === '' || SUBJECT.test(value), message('validation.required')),
    recurrence: z
      .union([z.enum(DEADLINE_RECURRENCES), z.literal('')])
      .transform((value) => value || null),
    notes: optionalText(2000),
  })
  .transform(({ subject, ...deadline }) => {
    const [, kind, id = null] = SUBJECT.exec(subject) ?? []
    return {
      ...deadline,
      client_id: kind === 'client' ? id : null,
      supplier_id: kind === 'supplier' ? id : null,
    }
  }) satisfies z.ZodType<DeadlineInput>

export type DeadlineFormValues = z.input<typeof deadlineSchema>

/** In the order the form shows the fields: after a 422 the cursor goes to the first wrong one. */
export function deadlineFormValues(deadline?: Deadline): DeadlineFormValues {
  return {
    title: deadline?.title ?? '',
    due_on: deadline?.due_on ?? '',
    kind: deadline?.kind ?? 'other',
    amount: amountInput(deadline?.amount),
    subject: deadline?.client_id
      ? `client:${deadline.client_id}`
      : deadline?.supplier_id
        ? `supplier:${deadline.supplier_id}`
        : '',
    recurrence: deadline?.recurrence ?? '',
    notes: deadline?.notes ?? '',
  }
}
