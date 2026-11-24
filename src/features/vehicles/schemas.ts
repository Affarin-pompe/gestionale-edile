import { z } from 'zod'
import { amountInput, message, optionalAmount, optionalText, requiredText } from '@/lib/form-schema'
import { VEHICLE_KINDS, type Vehicle, type VehicleInput } from './api'

/** The same rules as the backend (VehicleInput), so most mistakes show before saving. */
export const vehicleSchema = z.object({
  name: requiredText(200),
  kind: z.enum(VEHICLE_KINDS, message('validation.required')),
  // The backend saves it in capitals, without spaces or dashes
  plate: optionalText(20),
  model: optionalText(200),
  hourly_cost: optionalAmount,
  active: z.boolean(),
  notes: optionalText(2000),
}) satisfies z.ZodType<VehicleInput>

export type VehicleFormValues = z.input<typeof vehicleSchema>

/** In the order the form shows the fields: after a 422 the cursor goes to the first wrong one. */
export function vehicleFormValues(vehicle?: Vehicle): VehicleFormValues {
  return {
    name: vehicle?.name ?? '',
    kind: vehicle?.kind ?? 'vehicle',
    plate: vehicle?.plate ?? '',
    model: vehicle?.model ?? '',
    hourly_cost: amountInput(vehicle?.hourly_cost),
    active: vehicle?.active ?? true,
    notes: vehicle?.notes ?? '',
  }
}
