import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useIntl } from 'react-intl'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { ChoiceField, TextField } from '@/components/common/EntityForm'
import { SheetForm } from '@/components/common/SheetForm'
import {
  useSaveQuoteLine,
  VAT_RATES,
  type QuoteLine,
  type QuoteLineInput,
  type QuoteLineKind,
  type VatRate,
} from '../api'
import { quoteLineFormValues, quoteLineSchema, type QuoteLineFormValues } from '../schemas'

const Text = TextField<QuoteLineFormValues>
const Choice = ChoiceField<QuoteLineFormValues>

/** A new line of `kind`, or the changes of `line`, in a side panel. */
export function QuoteLineSheet({
  quoteId,
  kind,
  line,
  vatRate,
  onClose,
}: {
  quoteId: string
  kind: QuoteLineKind
  line?: QuoteLine
  vatRate?: VatRate
  onClose: () => void
}) {
  const intl = useIntl()
  const company = useCompany()
  const save = useSaveQuoteLine(company.slug, quoteId)
  const form = useForm<QuoteLineFormValues, unknown, QuoteLineInput>({
    resolver: zodResolver(quoteLineSchema),
    defaultValues: quoteLineFormValues(kind, line, vatRate),
  })
  const vatOptions = VAT_RATES.map((rate) => ({
    value: String(rate),
    text: intl.formatMessage({ id: 'quotes.vat.rate' }, { rate }),
  }))

  async function submit(input: QuoteLineInput) {
    await save.mutateAsync({ line, input })
    toast.success(intl.formatMessage({ id: line ? 'quotes.line.updated' : 'quotes.line.created' }))
  }

  return (
    <SheetForm
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={line ? `quotes.line.editTitle.${kind}` : `quotes.line.newTitle.${kind}`}
      form={form}
      onSubmit={submit}
    >
      <Text
        name="description"
        label={kind === 'section' ? 'quotes.line.sectionTitle' : 'quotes.line.description'}
        multiline={kind !== 'section'}
        maxLength={5000}
        required
      />
      {kind === 'item' && (
        <>
          <Text
            name="unit"
            label="quotes.line.unit"
            hint="quotes.line.unit.hint"
            maxLength={20}
            required
          />
          {/* Plain keyboard: a phone's number pad has no minus, and deductions need it */}
          <Text name="quantity" label="quotes.line.quantity" maxLength={16} required />
          <Text
            name="unit_price"
            label="quotes.line.unitPrice"
            hint="quotes.line.euro.hint"
            inputMode="decimal"
            maxLength={18}
            required
          />
          <Text
            name="discount_percent"
            label="quotes.line.discountPercent"
            inputMode="decimal"
            maxLength={6}
          />
          <Choice name="vat_rate" label="quotes.line.vat" options={vatOptions} required />
        </>
      )}
    </SheetForm>
  )
}
