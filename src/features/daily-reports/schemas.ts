import { z } from 'zod'
import { fromInputDecimal, toInputDecimal } from '@/lib/decimal'
import { message, optionalText, requiredDay } from '@/lib/form-schema'
import type { DailyReport, DailyReportInput } from './api'
import { MAX_HUNDREDTHS, MIN_HUNDREDTHS, toHundredths } from './hours'

/** The most rows of each kind the contract takes. */
export const MAX_ROWS = 100

// Typed the Italian way ("7,5"), sent with the point ("7.5"): from 0.01 to 24
const hours = z
  .string()
  .trim()
  .min(1, message('validation.required'))
  .transform(fromInputDecimal)
  .refine((value) => {
    const hundredths = toHundredths(value)
    return hundredths !== undefined && hundredths >= MIN_HUNDREDTHS && hundredths <= MAX_HUNDREDTHS
  }, message('dailyReports.hours.invalid'))

const required = z.string().min(1, message('validation.required'))
const laborRow = z.object({ employee_id: required, hours, description: optionalText(500) })
const vehicleRow = z.object({ vehicle_id: required, hours, description: optionalText(500) })

/** The same employee or vehicle twice: the backend refuses it, the form says where. */
function noDuplicates<TKey extends string>(key: TKey, duplicate: Parameters<typeof message>[0]) {
  return (rows: Record<TKey, string>[], context: z.RefinementCtx) => {
    const seen = new Set<string>()
    rows.forEach((item, index) => {
      const id = item[key]
      if (!id) return
      if (seen.has(id)) context.addIssue({ code: 'custom', path: [index, key], message: duplicate })
      seen.add(id)
    })
  }
}

/** The same rules as the backend (DailyReportInput), so most mistakes show before saving. */
export const reportSchema = z.object({
  site_id: required,
  date: requiredDay,
  weather: optionalText(100),
  work_done: optionalText(5000),
  labor: z
    .array(laborRow)
    .max(MAX_ROWS, message('dailyReports.rows.tooMany'))
    .superRefine(noDuplicates('employee_id', 'dailyReports.labor.duplicate')),
  vehicles: z
    .array(vehicleRow)
    .max(MAX_ROWS, message('dailyReports.rows.tooMany'))
    .superRefine(noDuplicates('vehicle_id', 'dailyReports.vehicles.duplicate')),
  notes: optionalText(2000),
}) satisfies z.ZodType<DailyReportInput>

export type ReportFormValues = z.input<typeof reportSchema>
export type LaborRow = ReportFormValues['labor'][number]
export type VehicleRow = ReportFormValues['vehicles'][number]

/** The hours a new row starts with: a full working day. */
export const DEFAULT_HOURS = '8'

/**
 * A saved report, or a proposal (the backend's, from today's page), as the inputs hold it.
 * In the order the form shows the fields: after a 422 the cursor goes to the first wrong one.
 */
export function reportFormValues(report: DailyReport | DailyReportInput): ReportFormValues {
  return {
    site_id: report.site_id,
    date: report.date,
    weather: report.weather ?? '',
    work_done: report.work_done ?? '',
    labor: report.labor.map((item) => ({
      employee_id: item.employee_id,
      hours: toInputDecimal(hoursInput(item.hours)),
      description: item.description ?? '',
    })),
    vehicles: report.vehicles.map((item) => ({
      vehicle_id: item.vehicle_id,
      hours: toInputDecimal(hoursInput(item.hours)),
      description: item.description ?? '',
    })),
    notes: report.notes ?? '',
  }
}

/** An empty report on a site and a day. */
export function emptyReportValues(site: string, date: string): ReportFormValues {
  return {
    site_id: site,
    date,
    weather: '',
    work_done: '',
    labor: [],
    vehicles: [],
    notes: '',
  }
}

/** "8.00" → "8", "7.50" → "7.5": what one would type. */
function hoursInput(value: string) {
  return value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value
}
