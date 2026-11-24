import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { CheckboxField, EntityForm, FormSection, TextField } from '@/components/common/EntityForm'
import type { Employee, EmployeeInput } from '../api'
import { employeeFormValues, employeeSchema, type EmployeeFormValues } from '../schemas'

const Text = TextField<EmployeeFormValues>

/** New employee when `employee` is missing, otherwise its changes. */
export function EmployeeForm({
  employee,
  onSubmit,
  cancelTo,
}: {
  employee?: Employee
  onSubmit: (input: EmployeeInput) => Promise<void>
  cancelTo: string
}) {
  const form = useForm<EmployeeFormValues, unknown, EmployeeInput>({
    resolver: zodResolver(employeeSchema),
    defaultValues: employeeFormValues(employee),
  })

  return (
    <EntityForm form={form} onSubmit={onSubmit} cancelTo={cancelTo}>
      <FormSection legend="employees.section.main">
        <Text name="first_name" label="employees.firstName" maxLength={100} required />
        <Text name="last_name" label="employees.lastName" maxLength={100} required />
        <Text
          name="job_title"
          label="employees.jobTitle"
          hint="employees.jobTitle.hint"
          maxLength={100}
        />
        <Text name="tax_code" label="employees.taxCode" maxLength={20} />
      </FormSection>
      <FormSection legend="employees.section.work">
        <Text name="hired_on" label="employees.hiredOn" type="date" />
        <Text
          name="hourly_cost"
          label="employees.hourlyCost"
          hint="employees.hourlyCost.hint"
          inputMode="decimal"
          maxLength={16}
        />
        <CheckboxField<EmployeeFormValues>
          name="active"
          label="employees.active"
          hint="employees.active.hint"
        />
      </FormSection>
      <FormSection legend="employees.section.contacts">
        <Text name="phone" label="employees.phone" type="tel" maxLength={30} autoComplete="off" />
        <Text name="email" label="employees.email" type="email" autoComplete="off" />
      </FormSection>
      <Text name="notes" label="employees.notes" multiline maxLength={2000} />
    </EntityForm>
  )
}
