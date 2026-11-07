import { z } from 'zod'
import {
  amountInput,
  optionalAmount,
  optionalDay,
  optionalEmail,
  optionalText,
  requiredText,
} from '@/lib/form-schema'
import type { Employee, EmployeeInput } from './api'

/** The same rules as the backend (EmployeeInput), so most mistakes show before saving. */
export const employeeSchema = z.object({
  first_name: requiredText(100),
  last_name: requiredText(100),
  job_title: optionalText(100),
  // The backend saves it in capitals, without spaces
  tax_code: optionalText(20),
  phone: optionalText(30),
  email: optionalEmail,
  hired_on: optionalDay,
  hourly_cost: optionalAmount,
  active: z.boolean(),
  notes: optionalText(2000),
}) satisfies z.ZodType<EmployeeInput>

export type EmployeeFormValues = z.input<typeof employeeSchema>

/** In the order the form shows the fields: after a 422 the cursor goes to the first wrong one. */
export function employeeFormValues(employee?: Employee): EmployeeFormValues {
  return {
    first_name: employee?.first_name ?? '',
    last_name: employee?.last_name ?? '',
    job_title: employee?.job_title ?? '',
    tax_code: employee?.tax_code ?? '',
    hired_on: employee?.hired_on ?? '',
    hourly_cost: amountInput(employee?.hourly_cost),
    active: employee?.active ?? true,
    phone: employee?.phone ?? '',
    email: employee?.email ?? '',
    notes: employee?.notes ?? '',
  }
}

/** "Rossi Mario", as lists of people are read. */
export function employeeName(employee: Pick<Employee, 'first_name' | 'last_name'>) {
  return `${employee.last_name} ${employee.first_name}`
}
