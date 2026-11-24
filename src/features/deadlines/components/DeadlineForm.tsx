import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  EntityForm,
  FormSection,
  OptionsField,
  SelectField,
  TextField,
} from '@/components/common/EntityForm'
import {
  DEADLINE_KINDS,
  DEADLINE_RECURRENCES,
  useSubjects,
  type Deadline,
  type DeadlineInput,
} from '../api'
import { deadlineFormValues, deadlineSchema, type DeadlineFormValues } from '../schemas'

const Text = TextField<DeadlineFormValues>
const Select = SelectField<DeadlineFormValues>

const KIND_OPTIONS = DEADLINE_KINDS.map((value) => ({
  value,
  label: `deadlines.kind.${value}` as const,
}))
const RECURRENCE_OPTIONS = [
  { value: '', label: 'deadlines.recurrence.none' as const },
  ...DEADLINE_RECURRENCES.map((value) => ({
    value,
    label: `deadlines.recurrence.${value}` as const,
  })),
]

/** New deadline when `deadline` is missing, otherwise its changes. */
export function DeadlineForm({
  deadline,
  onSubmit,
  cancelTo,
}: {
  deadline?: Deadline
  onSubmit: (input: DeadlineInput) => Promise<void>
  cancelTo: string
}) {
  const form = useForm<DeadlineFormValues, unknown, DeadlineInput>({
    resolver: zodResolver(deadlineSchema),
    defaultValues: deadlineFormValues(deadline),
  })
  const subjects = useSubjects().data
  const clients = [...(subjects?.clients ?? [])]
  const suppliers = [...(subjects?.suppliers ?? [])]
  // The linked subject shows even when it is not among the options (archived, or past the
  // first page)
  if (deadline?.client && !clients.some((c) => c.id === deadline.client?.id)) {
    clients.unshift(deadline.client)
  }
  if (deadline?.supplier && !suppliers.some((s) => s.id === deadline.supplier?.id)) {
    suppliers.unshift(deadline.supplier)
  }

  return (
    <EntityForm form={form} onSubmit={onSubmit} cancelTo={cancelTo}>
      <FormSection legend="deadlines.section.main">
        <Text
          name="title"
          label="deadlines.titleField"
          hint="deadlines.titleField.hint"
          maxLength={200}
          required
        />
        <Text name="due_on" label="deadlines.dueOn" type="date" required />
        <Select name="kind" label="deadlines.kind" options={KIND_OPTIONS} required />
        <Text
          name="amount"
          label="deadlines.amount"
          hint="deadlines.amount.hint"
          inputMode="decimal"
          maxLength={16}
        />
        <Select
          name="recurrence"
          label="deadlines.recurrence"
          hint="deadlines.recurrence.hint"
          options={RECURRENCE_OPTIONS}
        />
      </FormSection>
      <FormSection legend="deadlines.section.subject">
        {/* Keyed on the options, so the saved choice is selected once they arrive */}
        <OptionsField<DeadlineFormValues>
          key={subjects ? 'loaded' : 'loading'}
          name="subject"
          label="deadlines.subject"
          hint="deadlines.subject.hint"
          empty="deadlines.subject.none"
          groups={[
            {
              label: 'deadlines.subject.clients' as const,
              options: clients.map((c) => ({ value: `client:${c.id}`, text: c.name })),
            },
            {
              label: 'deadlines.subject.suppliers' as const,
              options: suppliers.map((s) => ({ value: `supplier:${s.id}`, text: s.name })),
            },
          ].filter((group) => group.options.length > 0)}
        />
      </FormSection>
      <Text name="notes" label="deadlines.notes" multiline maxLength={2000} />
    </EntityForm>
  )
}
