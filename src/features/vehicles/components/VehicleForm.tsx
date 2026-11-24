import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  CheckboxField,
  EntityForm,
  FormSection,
  SelectField,
  TextField,
} from '@/components/common/EntityForm'
import { VEHICLE_KINDS, type Vehicle, type VehicleInput } from '../api'
import { vehicleFormValues, vehicleSchema, type VehicleFormValues } from '../schemas'

const Text = TextField<VehicleFormValues>

const KIND_OPTIONS = VEHICLE_KINDS.map((value) => ({
  value,
  label: `vehicles.kind.${value}` as const,
}))

/** New vehicle when `vehicle` is missing, otherwise its changes. */
export function VehicleForm({
  vehicle,
  onSubmit,
  cancelTo,
}: {
  vehicle?: Vehicle
  onSubmit: (input: VehicleInput) => Promise<void>
  cancelTo: string
}) {
  const form = useForm<VehicleFormValues, unknown, VehicleInput>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: vehicleFormValues(vehicle),
  })

  return (
    <EntityForm form={form} onSubmit={onSubmit} cancelTo={cancelTo}>
      <FormSection legend="vehicles.section.main">
        <Text
          name="name"
          label="vehicles.name"
          hint="vehicles.name.hint"
          maxLength={200}
          required
        />
        <SelectField<VehicleFormValues>
          name="kind"
          label="vehicles.kind"
          options={KIND_OPTIONS}
          required
        />
        <Text name="plate" label="vehicles.plate" maxLength={20} />
        <Text name="model" label="vehicles.model" maxLength={200} />
      </FormSection>
      <FormSection legend="vehicles.section.use">
        <Text
          name="hourly_cost"
          label="vehicles.hourlyCost"
          hint="vehicles.hourlyCost.hint"
          inputMode="decimal"
          maxLength={16}
        />
        <CheckboxField<VehicleFormValues>
          name="active"
          label="vehicles.active"
          hint="vehicles.active.hint"
        />
      </FormSection>
      <Text name="notes" label="vehicles.notes" multiline maxLength={2000} />
    </EntityForm>
  )
}
