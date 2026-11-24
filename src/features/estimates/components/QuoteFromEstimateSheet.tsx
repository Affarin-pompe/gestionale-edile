import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { useCan } from '@/auth/permissions'
import { ChoiceField, TextField } from '@/components/common/EntityForm'
import { SheetForm } from '@/components/common/SheetForm'
import { clientOptionsQuery, VAT_RATES } from '@/features/quotes/api'
import { quotePaths } from '@/features/quotes/paths'
import { useCreateQuoteFromEstimate, type Estimate, type QuoteFromEstimateInput } from '../api'
import {
  quoteFromEstimateFormValues,
  quoteFromEstimateSchema,
  type QuoteFromEstimateFormValues,
} from '../schemas'

const Text = TextField<QuoteFromEstimateFormValues>
const Choice = ChoiceField<QuoteFromEstimateFormValues>

/** A draft quote from the estimate's items; then the quote opens, to be checked and sent. */
export function QuoteFromEstimateSheet({
  estimate,
  onClose,
}: {
  estimate: Estimate
  onClose: () => void
}) {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const create = useCreateQuoteFromEstimate(company.slug, estimate.id)
  const canSeeClients = useCan('clients.view')
  const clients =
    useQuery({ ...clientOptionsQuery(company.slug), enabled: canSeeClients }).data ?? []
  const form = useForm<QuoteFromEstimateFormValues, unknown, QuoteFromEstimateInput>({
    resolver: zodResolver(quoteFromEstimateSchema),
    defaultValues: quoteFromEstimateFormValues(estimate),
  })

  const clientOptions = clients.map((client) => ({ value: client.id, text: client.name }))
  const current = estimate.client
  if (current && !clientOptions.some((option) => option.value === current.id)) {
    clientOptions.unshift({ value: current.id, text: current.name })
  }
  const vatOptions = VAT_RATES.map((rate) => ({
    value: String(rate),
    text: intl.formatMessage({ id: 'quotes.vat.rate' }, { rate }),
  }))

  async function submit(input: QuoteFromEstimateInput) {
    const { data: quote } = await create.mutateAsync(input)
    toast.success(intl.formatMessage({ id: 'estimates.quoteCreated' }))
    await navigate(quotePaths(company.slug).detail(quote.id))
  }

  return (
    <SheetForm
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="estimates.toQuote.title"
      description={intl.formatMessage({ id: 'estimates.toQuote.text' })}
      form={form}
      onSubmit={submit}
    >
      <Choice
        name="client_id"
        label="quotes.client"
        empty="quotes.client.choose"
        options={clientOptions}
        required
      />
      <Text name="subject" label="quotes.subject" maxLength={200} required />
      <Choice
        name="vat_rate"
        label="estimates.toQuote.vat"
        hint="estimates.toQuote.vat.hint"
        options={vatOptions}
        required
      />
      <Text
        name="validity_days"
        label="quotes.validityDays"
        inputMode="numeric"
        maxLength={3}
        required
      />
      <Text
        name="terms"
        label="quotes.terms"
        hint="quotes.terms.hint"
        multiline
        maxLength={10000}
      />
      <Text name="notes" label="quotes.notes" multiline maxLength={5000} />
    </SheetForm>
  )
}
