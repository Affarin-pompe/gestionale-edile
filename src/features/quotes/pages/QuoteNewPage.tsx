import { FormattedMessage, useIntl } from 'react-intl'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { PageHeader } from '@/components/common/PageHeader'
import { useCreateQuote, type QuoteInput } from '../api'
import { QuoteForm } from '../components/QuoteForm'
import { quotePaths } from '../paths'

export function QuoteNewPage() {
  const intl = useIntl()
  const navigate = useNavigate()
  const company = useCompany()
  const paths = quotePaths(company.slug)
  const create = useCreateQuote(company.slug)

  async function save(input: QuoteInput) {
    const { data: quote } = await create.mutateAsync(input)
    toast.success(intl.formatMessage({ id: 'quotes.created' }))
    // The lines are added on the quote's page
    await navigate(paths.detail(quote.id))
  }

  return (
    <div className="mx-auto flex w-full max-w-155 flex-col gap-5">
      <PageHeader
        back={{ to: paths.list, label: <FormattedMessage id="quotes.title" /> }}
        title={<FormattedMessage id="quotes.new" />}
      />
      <QuoteForm onSubmit={save} cancelTo={paths.list} />
    </div>
  )
}
