import { z } from 'zod'
import {
  amountInput,
  message,
  optionalAmount,
  optionalDay,
  optionalText,
  requiredDay,
  requiredText,
} from '@/lib/form-schema'
import {
  SITE_STATUSES,
  type Site,
  type SiteActivity,
  type SiteActivityInput,
  type SiteInput,
} from './api'

/** The same rules as the backend (SiteInput), so most mistakes show before saving. */
export const siteSchema = z
  .object({
    name: requiredText(200),
    code: optionalText(50),
    client_id: z.string().transform((value) => value || null),
    status: z.enum(SITE_STATUSES, message('validation.required')),
    address: optionalText(300),
    start_on: optionalDay,
    end_on: optionalDay,
    budget: optionalAmount,
    notes: optionalText(2000),
  })
  .superRefine((site, context) => {
    // Dates as AAAA-MM-GG compare as text
    if (site.start_on && site.end_on && site.end_on < site.start_on) {
      context.addIssue({ code: 'custom', path: ['end_on'], message: 'sites.endBeforeStart' })
    }
  }) satisfies z.ZodType<SiteInput>

export type SiteFormValues = z.input<typeof siteSchema>

/** In the order the form shows the fields: after a 422 the cursor goes to the first wrong one. */
export function siteFormValues(site?: Site): SiteFormValues {
  return {
    name: site?.name ?? '',
    code: site?.code ?? '',
    client_id: site?.client_id ?? '',
    status: site?.status ?? 'planned',
    address: site?.address ?? '',
    start_on: site?.start_on ?? '',
    end_on: site?.end_on ?? '',
    budget: amountInput(site?.budget),
    notes: site?.notes ?? '',
  }
}

/** An activity of the schedule (SiteActivityInput). A cycle of dependencies only the backend sees. */
export const activitySchema = z
  .object({
    name: requiredText(200),
    start_on: requiredDay,
    end_on: requiredDay,
    progress: z
      .string()
      .trim()
      .regex(/^\d{1,3}$/, message('sites.schedule.progressInvalid'))
      .transform(Number)
      .refine((value) => value <= 100, message('sites.schedule.progressInvalid')),
    depends_on: z.array(z.string()).max(50, message('sites.schedule.tooManyDependencies')),
    notes: optionalText(2000),
  })
  .superRefine((activity, context) => {
    if (activity.end_on < activity.start_on) {
      context.addIssue({ code: 'custom', path: ['end_on'], message: 'sites.endBeforeStart' })
    }
  }) satisfies z.ZodType<SiteActivityInput>

export type ActivityFormValues = z.input<typeof activitySchema>

export function activityFormValues(activity?: SiteActivity, day?: string): ActivityFormValues {
  return {
    name: activity?.name ?? '',
    start_on: activity?.start_on ?? day ?? '',
    end_on: activity?.end_on ?? day ?? '',
    progress: String(activity?.progress ?? 0),
    depends_on: activity?.depends_on ?? [],
    notes: activity?.notes ?? '',
  }
}
