import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useCompany } from '@/auth/me'
import { useCan } from '@/auth/permissions'
import { ChoiceField, EntityForm, FormSection, TextField } from '@/components/common/EntityForm'
import { clientOptionsQuery, type Quote, type QuoteInput } from '../api'
import { quoteFormValues, quoteSchema, type QuoteFormValues } from '../schemas'

const Text = TextField<QuoteFormValues>
const Choice = ChoiceField<QuoteFormValues>

/** The header of a new quote when `quote` is missing, otherwise its changes. */
export function QuoteForm({
  quote,
  onSubmit,
  cancelTo,
}: {
  quote?: Quote
  onSubmit: (input: QuoteInput) => Promise<void>
  cancelTo: string
}) {
  const form = useForm<QuoteFormValues, unknown, QuoteInput>({
    resolver: zodResolver(quoteSchema),
    defaultValues: quoteFormValues(quote),
  })

  return (
    <EntityForm form={form} onSubmit={onSubmit} cancelTo={cancelTo}>
      <FormSection legend="quotes.section.main">
        <ClientChoice current={quote?.client} />
        <Text name="subject" label="quotes.subject" maxLength={200} required />
        <Text
          name="validity_days"
          label="quotes.validityDays"
          hint="quotes.validityDays.hint"
          inputMode="numeric"
          maxLength={3}
          required
        />
      </FormSection>
      <FormSection legend="quotes.section.texts">
        <Text
          name="terms"
          label="quotes.terms"
          hint="quotes.terms.hint"
          multiline
          maxLength={10000}
        />
        <Text name="notes" label="quotes.notes" multiline maxLength={5000} />
      </FormSection>
    </EntityForm>
  )
}

/** The clients by name; the quote's own client stays in the list even if it is not loaded. */
function ClientChoice({ current }: { current?: { id: string; name: string } }) {
  const company = useCompany()
  const canSeeClients = useCan('clients.view')
  const clients =
    useQuery({ ...clientOptionsQuery(company.slug), enabled: canSeeClients }).data ?? []
  const options = clients.map((client) => ({ value: client.id, text: client.name }))
  if (current && !options.some((option) => option.value === current.id)) {
    options.unshift({ value: current.id, text: current.name })
  }
  return (
    <Choice
      name="client_id"
      label="quotes.client"
      hint="quotes.client.hint"
      empty="quotes.client.choose"
      options={options}
      required
    />
  )
}
